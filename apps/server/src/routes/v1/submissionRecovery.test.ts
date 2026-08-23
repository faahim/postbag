import { createServer, type Server } from "node:http"

import { newId } from "@postbag/core"
import { deliveries, destinations, forms, organization, routes } from "@postbag/db"
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  buildHarness,
  createTestApiKey,
  seedOrganization,
  TEST_DATABASE_URL,
  type TestHarness,
} from "../../testUtils.js"
import { startWorker, type WorkerHandle } from "../../worker/index.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

function startWebhookCatcher(): Promise<{
  readonly server: Server
  readonly port: number
  readonly bodies: string[]
}> {
  return new Promise((resolve) => {
    const bodies: string[] = []
    const server = createServer((request, response) => {
      const chunks: Buffer[] = []
      request.on("data", (chunk: Buffer) => chunks.push(chunk))
      request.on("end", () => {
        bodies.push(Buffer.concat(chunks).toString("utf8"))
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({ ok: true }))
      })
    })
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      resolve({
        server,
        port: typeof address === "object" && address !== null ? address.port : 0,
        bodies,
      })
    })
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) resolve()
      else reject(error)
    })
  })
}

integration("quarantined submission recovery", () => {
  let harness: TestHarness
  let organizationId: string
  let projectId: string
  let apiKey: string

  beforeAll(async () => {
    harness = buildHarness()
    const seeded = await seedOrganization(harness.db, "Submission recovery")
    organizationId = seeded.organizationId
    projectId = seeded.projectId
    apiKey = await createTestApiKey(harness.auth, organizationId, seeded.userId)
  })

  afterAll(async () => {
    await harness.db.delete(organization).where(eq(organization.id, organizationId))
    await harness.close()
  })

  it("releases a quality-skipped delivery and the worker sends it", async () => {
    // Given: an origin-rejected submission whose route recorded a quality skip.
    const catcher = await startWebhookCatcher()
    let worker: WorkerHandle | undefined
    try {
      const [form] = await harness.db
        .insert(forms)
        .values({
          id: newId("fm"),
          organizationId,
          projectId,
          slug: `recovery-${newId("fm").slice(-8)}`,
          name: "Recovery form",
          settings: { allowed_origins: ["https://allowed.example"] },
        })
        .returning()
      if (form === undefined) throw new Error("Failed to create recovery form.")
      const [destination] = await harness.db
        .insert(destinations)
        .values({
          id: newId("ds"),
          organizationId,
          type: "webhook",
          name: "Recovery catcher",
          config: { url: `http://127.0.0.1:${catcher.port.toString()}/hook`, headers: {} },
          verified: true,
        })
        .returning()
      if (destination === undefined) throw new Error("Failed to create recovery destination.")
      const [route] = await harness.db
        .insert(routes)
        .values({ id: newId("rt"), organizationId, formId: form.id, destinationId: destination.id })
        .returning()
      if (route === undefined) throw new Error("Failed to create recovery route.")

      const submitted = await harness.app.request(`/s/${form.id}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://rejected.example" },
        body: JSON.stringify({ email: "human@example.com", message: "Please call me" }),
      })
      const submittedBody = (await submitted.json()) as {
        readonly submission_id: string
        readonly status: string
      }
      expect(submittedBody.status).toBe("quarantined")
      const [skipped] = await harness.db
        .select()
        .from(deliveries)
        .where(
          and(
            eq(deliveries.submissionId, submittedBody.submission_id),
            eq(deliveries.routeId, route.id),
          ),
        )
      expect(skipped).toMatchObject({ status: "skipped", skipReason: "quality" })

      // When: a manager releases the stored submission for delivery.
      const released = await harness.app.request(`/v1/submissions/${submittedBody.submission_id}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ status: "received" }),
      })

      // Then: the existing Delivery becomes claimable and is sent exactly once.
      expect(released.status).toBe(200)
      const [pending] = await harness.db
        .select()
        .from(deliveries)
        .where(
          and(
            eq(deliveries.submissionId, submittedBody.submission_id),
            eq(deliveries.routeId, route.id),
          ),
        )
      expect(pending).toMatchObject({
        id: skipped?.id,
        status: "pending",
        skipReason: null,
        payload: { email: "human@example.com", message: "Please call me" },
      })

      worker = startWorker(harness.db, harness.env, harness.logger, harness.destinations)
      const deadline = Date.now() + 18_000
      let sentStatus = pending?.status
      while (sentStatus !== "sent" && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 150))
        const [delivery] = await harness.db
          .select({ status: deliveries.status })
          .from(deliveries)
          .where(eq(deliveries.id, pending?.id ?? ""))
        sentStatus = delivery?.status
      }
      expect(sentStatus).toBe("sent")
      expect(catcher.bodies).toHaveLength(1)
    } finally {
      if (worker !== undefined) await worker.stop()
      await closeServer(catcher.server)
    }
  }, 25_000)
})
