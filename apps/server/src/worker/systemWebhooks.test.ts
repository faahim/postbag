import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"

import { newId, verifyWebhookSignature } from "@postbag/core"
import { events, organization, systemWebhookDeliveries, systemWebhooks } from "@postbag/db"
import { and, eq, sql } from "drizzle-orm"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

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

// Job D §2: the EventDispatcher seam — every `events` insert fans out to
// `system_webhook_deliveries` for each enabled matching webhook (via the
// `dispatch_system_webhooks` Postgres trigger), delivered by the worker with the same
// HMAC signing / backoff / dead-lettering semantics as route webhooks.
integration("system webhook dispatch", () => {
  const harness: TestHarness = buildHarness()
  const workers: WorkerHandle[] = []
  const seededOrganizationIds: string[] = []

  beforeAll(async () => {
    await harness.db.execute(sql`truncate table system_webhook_deliveries`)
  })

  afterEach(async () => {
    while (workers.length > 0) {
      const worker = workers.pop()
      if (worker !== undefined) await worker.stop()
    }
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

  async function seedWebhook(url: string, subscribedEvents: readonly string[], secret = "whsec_test") {
    const org = await seedOrganization(harness.db, "System Webhook Fixture")
    seededOrganizationIds.push(org.organizationId)
    const [webhook] = await harness.db
      .insert(systemWebhooks)
      .values({ id: newId("wh"), organizationId: org.organizationId, url, events: [...subscribedEvents], secret })
      .returning()
    if (webhook === undefined) throw new Error("failed to create system webhook")
    return { organizationId: org.organizationId, webhookId: webhook.id }
  }

  async function emitEvent(organizationId: string, type: string) {
    const [row] = await harness.db
      .insert(events)
      .values({ id: newId("ev"), organizationId, type, subject: { x: 1 }, data: { y: 2 } })
      .returning()
    if (row === undefined) throw new Error("failed to insert event")
    return row.id
  }

  async function waitForStatus(organizationId: string, webhookId: string, timeoutMs = 18_000) {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const [row] = await harness.db
        .select()
        .from(systemWebhookDeliveries)
        .where(
          and(
            eq(systemWebhookDeliveries.organizationId, organizationId),
            eq(systemWebhookDeliveries.webhookId, webhookId),
          ),
        )
      if (row !== undefined && (row.status === "sent" || row.status === "dead" || row.status === "failed")) {
        return row
      }
      if (Date.now() > deadline) return row
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }

  it("dispatches a signed POST to a local listener when an event matches", async () => {
    let capturedHeaders: Record<string, string> | undefined
    let capturedBody: string | undefined
    const { server, port } = await startCatcher((req, res, body) => {
      capturedHeaders = Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key, String(value)]))
      capturedBody = body
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ ok: true }))
    })
    try {
      const secret = "whsec_dispatch_test"
      const fixture = await seedWebhook(`http://127.0.0.1:${String(port)}/hook`, ["submission.received"], secret)
      const eventId = await emitEvent(fixture.organizationId, "submission.received")
      runWorker()
      const row = await waitForStatus(fixture.organizationId, fixture.webhookId)
      expect(row?.status).toBe("sent")
      expect(row?.eventId).toBe(eventId)

      expect(capturedHeaders?.["postbag-event"]).toBe("submission.received")
      const signatureHeader = capturedHeaders?.["postbag-signature"]
      expect(signatureHeader).toBeDefined()
      if (signatureHeader !== undefined && capturedBody !== undefined) {
        expect(await verifyWebhookSignature(secret, signatureHeader, capturedBody)).toBe(true)
        const parsed = JSON.parse(capturedBody) as { type: string; id: string }
        expect(parsed.type).toBe("submission.received")
        expect(parsed.id).toBe(eventId)
      }
    } finally {
      server.close()
    }
  })

  it("does not dispatch for a non-matching event type", async () => {
    const fixture = await seedWebhook("http://127.0.0.1:1/unused", ["delivery.dead"])
    await emitEvent(fixture.organizationId, "submission.received")

    const rows = await harness.db
      .select()
      .from(systemWebhookDeliveries)
      .where(eq(systemWebhookDeliveries.organizationId, fixture.organizationId))
    expect(rows).toHaveLength(0)
  })

  it("retries a failing webhook and schedules a future next_attempt_at", async () => {
    const { server, port } = await startCatcher((_req, res) => {
      res.writeHead(500)
      res.end("boom")
    })
    try {
      const fixture = await seedWebhook(`http://127.0.0.1:${String(port)}/hook`, ["submission.received"])
      await emitEvent(fixture.organizationId, "submission.received")
      runWorker()
      const row = await waitForStatus(fixture.organizationId, fixture.webhookId)
      expect(row?.status).toBe("failed")
      expect(row?.attempts).toBe(1)
      expect(row?.nextAttemptAt).toBeDefined()
      expect(row?.nextAttemptAt?.getTime()).toBeGreaterThan(Date.now())
    } finally {
      server.close()
    }
  })
})
