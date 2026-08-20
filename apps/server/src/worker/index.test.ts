import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"

import { newId, verifyWebhookSignature } from "@postbag/core"
import { deliveries, destinations, forms, organization, routes, submissions } from "@postbag/db"
import { and, eq } from "drizzle-orm"
import { afterAll, afterEach, describe, expect, it } from "vitest"

import { buildHarness, seedOrganization, TEST_DATABASE_URL, type TestHarness } from "../testUtils.js"
import { startWorker, type WorkerHandle } from "./index.js"

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

integration("worker webhook delivery", () => {
  const harness: TestHarness = buildHarness()
  const workers: WorkerHandle[] = []
  const seededOrganizationIds: string[] = []

  afterEach(async () => {
    while (workers.length > 0) {
      const worker = workers.pop()
      if (worker !== undefined) await worker.stop()
    }
    // Deliveries are claimed globally (not scoped to org) — leftover rows from one
    // test would otherwise race with the next test's freshly-seeded delivery.
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

  function runWorker(): void {
    workers.push(startWorker(harness.db, harness.env, harness.logger, harness.destinations))
  }

  async function seedFixture(config: Readonly<Record<string, unknown>>, attempts = 0) {
    const org = await seedOrganization(harness.db, "Worker Fixture")
    seededOrganizationIds.push(org.organizationId)
    const [form] = await harness.db
      .insert(forms)
      .values({ id: newId("fm"), organizationId: org.organizationId, projectId: org.projectId, slug: `wf-${newId("fm").slice(-8)}`, name: "wf" })
      .returning()
    if (form === undefined) throw new Error("failed to create form")
    const [destination] = await harness.db
      .insert(destinations)
      .values({ id: newId("ds"), organizationId: org.organizationId, type: "webhook", name: "Hook", config, verified: true })
      .returning()
    if (destination === undefined) throw new Error("failed to create destination")
    const [route] = await harness.db
      .insert(routes)
      .values({ id: newId("rt"), organizationId: org.organizationId, formId: form.id, destinationId: destination.id })
      .returning()
    if (route === undefined) throw new Error("failed to create route")
    const [submission] = await harness.db
      .insert(submissions)
      .values({ id: newId("sb"), organizationId: org.organizationId, formId: form.id, data: { email: "a@example.com" } })
      .returning()
    if (submission === undefined) throw new Error("failed to create submission")
    const [delivery] = await harness.db
      .insert(deliveries)
      .values({
        id: newId("dl"),
        organizationId: org.organizationId,
        submissionId: submission.id,
        routeId: route.id,
        destinationId: destination.id,
        status: attempts > 0 ? "failed" : "pending",
        attempts,
        payload: { email: "a@example.com" },
        nextAttemptAt: new Date(),
        dedupeKey: `${submission.id}:${route.id}`,
      })
      .returning()
    if (delivery === undefined) throw new Error("failed to create delivery")
    return { organizationId: org.organizationId, destinationId: destination.id, routeId: route.id, deliveryId: delivery.id }
  }

  /**
   * Polls until the delivery reaches a truly terminal state ('sent'/'dead') or its
   * `attempts` counter has moved past `initialAttempts` (a fresh 'failed' from the
   * claim increment, not the seed's initial 'failed' state used to simulate a retry).
   */
  async function waitForOutcome(organizationId: string, deliveryId: string, initialAttempts: number, timeoutMs = 8_000) {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const [row] = await harness.db
        .select()
        .from(deliveries)
        .where(and(eq(deliveries.organizationId, organizationId), eq(deliveries.id, deliveryId)))
      if (
        row !== undefined &&
        (row.status === "sent" || row.status === "dead" || (row.status === "failed" && row.attempts > initialAttempts))
      ) {
        return row
      }
      if (Date.now() > deadline) return row
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }

  it("delivers a webhook with a valid Postbag-Signature and marks it sent", async () => {
    let capturedHeaders: Record<string, string> | undefined
    let capturedBody: string | undefined
    const { server, port } = await startCatcher((req, res, body) => {
      capturedHeaders = Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key, String(value)]))
      capturedBody = body
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ ok: true }))
    })
    try {
      const secret = "whsec_test"
      const fixture = await seedFixture({ url: `http://127.0.0.1:${String(port)}/hook`, secret, headers: {} })
      runWorker()
      const row = await waitForOutcome(fixture.organizationId, fixture.deliveryId, 0)
      expect(row?.status).toBe("sent")
      expect(capturedHeaders).toBeDefined()
      const signatureHeader = capturedHeaders?.["postbag-signature"]
      expect(signatureHeader).toBeDefined()
      if (signatureHeader !== undefined && capturedBody !== undefined) {
        expect(await verifyWebhookSignature(secret, signatureHeader, capturedBody)).toBe(true)
      }
    } finally {
      server.close()
    }
  })

  it("retries on a 500 response and schedules a future next_attempt_at", async () => {
    const { server, port } = await startCatcher((_req, res) => {
      res.writeHead(500)
      res.end("boom")
    })
    try {
      const fixture = await seedFixture({ url: `http://127.0.0.1:${String(port)}/hook`, headers: {} })
      runWorker()
      const row = await waitForOutcome(fixture.organizationId, fixture.deliveryId, 0)
      expect(row?.status).toBe("failed")
      expect(row?.attempts).toBe(1)
      expect(row?.nextAttemptAt).toBeDefined()
      expect(row?.nextAttemptAt?.getTime()).toBeGreaterThan(Date.now())
    } finally {
      server.close()
    }
  })

  it("goes dead once the max attempts for a webhook is reached", async () => {
    const { server, port } = await startCatcher((_req, res) => {
      res.writeHead(500)
      res.end("boom")
    })
    try {
      // maxAttemptsFor('webhook') is 10; claimDeliveries increments attempts to 10 on claim.
      const fixture = await seedFixture({ url: `http://127.0.0.1:${String(port)}/hook`, headers: {} }, 9)
      runWorker()
      const row = await waitForOutcome(fixture.organizationId, fixture.deliveryId, 9)
      expect(row?.status).toBe("dead")
    } finally {
      server.close()
    }
  })

  it("disables the destination and its routes on a 410 response", async () => {
    const { server, port } = await startCatcher((_req, res) => {
      res.writeHead(410)
      res.end("gone")
    })
    try {
      const fixture = await seedFixture({ url: `http://127.0.0.1:${String(port)}/hook`, headers: {} })
      runWorker()
      const row = await waitForOutcome(fixture.organizationId, fixture.deliveryId, 0)
      expect(row?.status).toBe("dead")
      const [destination] = await harness.db
        .select()
        .from(destinations)
        .where(and(eq(destinations.organizationId, fixture.organizationId), eq(destinations.id, fixture.destinationId)))
      expect(destination?.health).toBe("failing")
      const [route] = await harness.db
        .select()
        .from(routes)
        .where(and(eq(routes.organizationId, fixture.organizationId), eq(routes.id, fixture.routeId)))
      expect(route?.enabled).toBe(false)
    } finally {
      server.close()
    }
  })
})
