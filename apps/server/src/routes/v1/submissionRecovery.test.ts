import { newId } from "@postbag/core"
import {
  deliveries,
  destinations,
  forms,
  organization,
  organizationSettings,
  routes,
  submissions,
} from "@postbag/db"
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { countMonthlySubmissions } from "../../lib/planUsage.js"
import {
  buildHarness,
  createTestApiKey,
  seedOrganization,
  TEST_DATABASE_URL,
  type TestHarness,
} from "../../testUtils.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

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

  it("requeues a quality-skipped delivery with its original payload", async () => {
    // Given: an origin-rejected submission whose route recorded a quality skip.
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
        name: "Recovery destination",
        config: { url: "https://example.com/hook", headers: {} },
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

    // Then: the existing Delivery is the pending outbox row the worker can claim.
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
  })

  it("requeues a window-skipped delivery after the route window changes", async () => {
    const [form] = await harness.db
      .insert(forms)
      .values({
        id: newId("fm"),
        organizationId,
        projectId,
        slug: `window-recovery-${newId("fm").slice(-8)}`,
        name: "Window recovery form",
        settings: { allowed_origins: ["https://allowed.example"] },
      })
      .returning()
    if (form === undefined) throw new Error("Failed to create window recovery form.")
    const [destination] = await harness.db
      .insert(destinations)
      .values({
        id: newId("ds"),
        organizationId,
        type: "webhook",
        name: "Window recovery destination",
        config: { url: "https://example.com/hook", headers: {} },
        verified: true,
      })
      .returning()
    if (destination === undefined) throw new Error("Failed to create window recovery destination.")
    const [route] = await harness.db
      .insert(routes)
      .values({
        id: newId("rt"),
        organizationId,
        formId: form.id,
        destinationId: destination.id,
        window: { from: "9999-01-01T00:00:00.000Z" },
      })
      .returning()
    if (route === undefined) throw new Error("Failed to create window recovery route.")

    const submitted = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://rejected.example" },
      body: JSON.stringify({ email: "window@example.com" }),
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
    expect(skipped).toMatchObject({ status: "skipped", skipReason: "window" })

    await harness.db.update(routes).set({ window: {} }).where(eq(routes.id, route.id))
    const released = await harness.app.request(`/v1/submissions/${submittedBody.submission_id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ status: "received" }),
    })

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
    expect(pending).toMatchObject({ id: skipped?.id, status: "pending", skipReason: null })
  })

  it("keeps an over-quota delivery parked through intermediate status changes", async () => {
    const [form] = await harness.db
      .insert(forms)
      .values({
        id: newId("fm"),
        organizationId,
        projectId,
        slug: `quota-recovery-${newId("fm").slice(-8)}`,
        name: "Quota recovery form",
      })
      .returning()
    if (form === undefined) throw new Error("Failed to create quota recovery form.")
    const [destination] = await harness.db
      .insert(destinations)
      .values({
        id: newId("ds"),
        organizationId,
        type: "webhook",
        name: "Quota recovery destination",
        config: { url: "https://example.com/hook", headers: {} },
        verified: true,
      })
      .returning()
    if (destination === undefined) throw new Error("Failed to create quota recovery destination.")
    const [route] = await harness.db
      .insert(routes)
      .values({ id: newId("rt"), organizationId, formId: form.id, destinationId: destination.id })
      .returning()
    if (route === undefined) throw new Error("Failed to create quota recovery route.")
    const usedBefore = await countMonthlySubmissions(harness.db, organizationId)
    await harness.db
      .update(organizationSettings)
      .set({ limits: { submissions_per_month: usedBefore + 1 } })
      .where(eq(organizationSettings.organizationId, organizationId))

    const submit = async (email: string) => {
      const response = await harness.app.request(`/s/${form.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      })
      return (await response.json()) as { readonly submission_id: string; readonly status: string }
    }
    expect((await submit("first@example.com")).status).toBe("received")
    const quarantined = await submit("held@example.com")
    expect(quarantined.status).toBe("quarantined")

    const release = () =>
      harness.app.request(`/v1/submissions/${quarantined.submission_id}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ status: "received" }),
      })

    const markedSpam = await harness.app.request(`/v1/submissions/${quarantined.submission_id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ status: "spam" }),
    })
    expect(markedSpam.status).toBe(200)

    const blocked = await release()
    expect(blocked.status).toBe(402)
    expect((await blocked.json()) as { error: { code: string } }).toMatchObject({
      error: { code: "plan_limit_reached" },
    })
    const [stillHeld] = await harness.db
      .select()
      .from(submissions)
      .where(eq(submissions.id, quarantined.submission_id))
    const [stillSkipped] = await harness.db
      .select()
      .from(deliveries)
      .where(
        and(
          eq(deliveries.submissionId, quarantined.submission_id),
          eq(deliveries.routeId, route.id),
        ),
      )
    expect(stillHeld).toMatchObject({ status: "spam", quarantineReason: null })
    expect(stillSkipped).toMatchObject({ status: "skipped", skipReason: "quality" })

    await harness.db
      .update(organizationSettings)
      .set({ limits: { submissions_per_month: usedBefore + 2 } })
      .where(eq(organizationSettings.organizationId, organizationId))
    expect((await release()).status).toBe(200)
    const [pending] = await harness.db
      .select()
      .from(deliveries)
      .where(
        and(
          eq(deliveries.submissionId, quarantined.submission_id),
          eq(deliveries.routeId, route.id),
        ),
      )
    expect(pending).toMatchObject({ id: stillSkipped?.id, status: "pending", skipReason: null })
  })
})
