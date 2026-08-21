import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"

import { newId } from "@postbag/core"
import { destinations, digests, deliveries, forms, organization, routes } from "@postbag/db"
import { eq, sql } from "drizzle-orm"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { buildHarness, seedOrganization, TEST_DATABASE_URL, type TestHarness } from "../testUtils.js"
import { runDigestSweep } from "./digests.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

function startCatcher(
  handler: (req: IncomingMessage, res: ServerResponse, body: string) => void,
): Promise<{ readonly server: Server; readonly port: number }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on("data", (chunk: Buffer) => chunks.push(chunk))
      req.on("end", () => {
        handler(req, res, Buffer.concat(chunks).toString("utf8"))
      })
    })
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      const port = typeof address === "object" && address !== null ? address.port : 0
      resolve({ server, port })
    })
  })
}

// Job D §3: `mode: { type: 'digest', cron, timezone }` — one delivery row is created per
// matching submission (parked far in the future so the instant worker never claims it,
// job D 1d/3), and the digest loop groups them by (route_id, digest_period_key) once the
// period has closed, sending exactly one payload per destination.
integration("digest routes", () => {
  const harness: TestHarness = buildHarness()
  const seededOrganizationIds: string[] = []

  beforeAll(async () => {
    await harness.db.execute(sql`truncate table deliveries, digests`)
  })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
  })

  afterEach(async () => {
    vi.useRealTimers()
    while (seededOrganizationIds.length > 0) {
      const organizationId = seededOrganizationIds.pop()
      if (organizationId !== undefined) {
        await harness.db.delete(organization).where(eq(organization.id, organizationId))
      }
    }
  })

  afterAll(async () => {
    await harness.close()
  })

  async function seedDigestRoute(url: string) {
    const org = await seedOrganization(harness.db, "Digest Fixture")
    seededOrganizationIds.push(org.organizationId)
    const [form] = await harness.db
      .insert(forms)
      .values({ id: newId("fm"), organizationId: org.organizationId, projectId: org.projectId, slug: `df-${newId("fm").slice(-8)}`, name: "Digest form" })
      .returning()
    if (form === undefined) throw new Error("failed to create form")
    const [destination] = await harness.db
      .insert(destinations)
      .values({ id: newId("ds"), organizationId: org.organizationId, type: "webhook", name: "Digest hook", config: { url, headers: {} }, verified: true })
      .returning()
    if (destination === undefined) throw new Error("failed to create destination")
    const [route] = await harness.db
      .insert(routes)
      .values({
        id: newId("rt"),
        organizationId: org.organizationId,
        formId: form.id,
        destinationId: destination.id,
        mode: { type: "digest", cron: "0 9 * * *", timezone: "UTC" },
      })
      .returning()
    if (route === undefined) throw new Error("failed to create route")
    return { organizationId: org.organizationId, formId: form.id, routeId: route.id }
  }

  it("bundles every submission in a closed daily period into one webhook POST", async () => {
    let callCount = 0
    let capturedBody: string | undefined
    let capturedHeaders: Record<string, string> | undefined
    const { server, port } = await startCatcher((req, res, body) => {
      callCount += 1
      capturedBody = body
      capturedHeaders = Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key, String(value)]))
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ ok: true }))
    })
    try {
      const fixture = await seedDigestRoute(`http://127.0.0.1:${String(port)}/digest`)

      // Two submissions inside the same still-open daily period (9:00 UTC boundary).
      vi.setSystemTime(new Date("2026-08-21T10:00:00.000Z"))
      const first = await harness.app.request(`/s/${fixture.formId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "a@example.com" }),
      })
      expect(first.status).toBe(200)

      vi.setSystemTime(new Date("2026-08-21T14:00:00.000Z"))
      const second = await harness.app.request(`/s/${fixture.formId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "b@example.com" }),
      })
      expect(second.status).toBe(200)

      // Still inside the period: the sweep must not send anything yet.
      await runDigestSweep(harness.db, harness.logger, harness.destinations)
      expect(callCount).toBe(0)

      // Cross the next day's 9:00 UTC boundary — the period has closed.
      vi.setSystemTime(new Date("2026-08-22T09:05:00.000Z"))
      await runDigestSweep(harness.db, harness.logger, harness.destinations)

      expect(callCount).toBe(1) // one payload for the whole period, not one per submission
      expect(capturedHeaders?.["postbag-event"]).toBe("digest.ready")
      const parsed = JSON.parse(capturedBody ?? "{}") as { digest: { route_id: string }; submissions: unknown[] }
      expect(parsed.digest.route_id).toBe(fixture.routeId)
      expect(parsed.submissions).toHaveLength(2)

      const [digestRow] = await harness.db.select().from(digests).where(eq(digests.routeId, fixture.routeId))
      expect(digestRow?.status).toBe("sent")

      const deliveryRows = await harness.db.select().from(deliveries).where(eq(deliveries.routeId, fixture.routeId))
      expect(deliveryRows).toHaveLength(2)
      for (const row of deliveryRows) {
        expect(row.status).toBe("sent")
        expect(row.digestId).toBe(digestRow?.id)
      }

      // Re-running the sweep after the period is already sent must not send again.
      await runDigestSweep(harness.db, harness.logger, harness.destinations)
      expect(callCount).toBe(1)
    } finally {
      server.close()
    }
  })

  it("sends nothing for a period with no submissions", async () => {
    const fixture = await seedDigestRoute("http://127.0.0.1:1/unused")
    vi.setSystemTime(new Date("2026-08-25T09:05:00.000Z"))
    await runDigestSweep(harness.db, harness.logger, harness.destinations)
    const digestRows = await harness.db.select().from(digests).where(eq(digests.routeId, fixture.routeId))
    expect(digestRows).toHaveLength(0)
  })
})
