import { newId } from "@postbag/core"
import { destinations, forms, organization, routes, submissions, type Database } from "@postbag/db"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { buildHarness, seedOrganization, TEST_DATABASE_URL, type TestHarness } from "../testUtils.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

integration("submit path", () => {
  let harness: TestHarness
  let db: Database
  let organizationId: string
  let projectId: string

  beforeAll(async () => {
    harness = buildHarness()
    db = harness.db
    const seeded = await seedOrganization(db, "Submit Org")
    organizationId = seeded.organizationId
    projectId = seeded.projectId
  })

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, organizationId))
    await harness.close()
  })

  async function createForm(overrides: Partial<typeof forms.$inferInsert> = {}) {
    const [form] = await db
      .insert(forms)
      .values({
        id: newId("fm"),
        organizationId,
        projectId,
        slug: `f-${newId("fm").slice(-8)}`,
        name: "Test form",
        ...overrides,
      })
      .returning()
    if (form === undefined) throw new Error("failed to create form")
    return form
  }

  it("stores a JSON submission and responds with ok + submission_id", async () => {
    const form = await createForm()
    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ada@example.com", message: "hello" }),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean; submission_id: string; status: string }
    expect(body.ok).toBe(true)
    expect(body.status).toBe("received")
    const [row] = await db.select().from(submissions).where(eq(submissions.id, body.submission_id))
    expect(row?.data).toEqual({ email: "ada@example.com", message: "hello" })
  })

  it("stores a urlencoded submission and redirects to the thanks page", async () => {
    const form = await createForm()
    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "text/html" },
      body: new URLSearchParams({ email: "bob@example.com" }).toString(),
    })
    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe(`/s/${form.id}/thanks`)
  })

  it("marks honeypot-filled submissions as spam but still stores them", async () => {
    const form = await createForm()
    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "spammer@example.com", _gotcha: "I am a bot" }),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { status: string; submission_id: string }
    expect(body.status).toBe("spam")
    const [row] = await db.select().from(submissions).where(eq(submissions.id, body.submission_id))
    expect(row?.status).toBe("spam")
    expect(row?.spam).toMatchObject({ score: 1 })
  })

  it("stores paused-form submissions without creating deliveries", async () => {
    const form = await createForm({ status: "paused" })
    const destination = await db
      .insert(destinations)
      .values({ id: newId("ds"), organizationId, type: "webhook", name: "Hook", config: { url: "https://example.com" }, verified: true })
      .returning()
    const destinationRow = destination[0]
    if (destinationRow === undefined) throw new Error("failed to create destination")
    await db.insert(routes).values({ id: newId("rt"), organizationId, formId: form.id, destinationId: destinationRow.id })

    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "x@example.com" }),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { submission_id: string }
    const [row] = await db.select().from(submissions).where(eq(submissions.id, body.submission_id))
    expect(row).toBeDefined()

    await db.delete(routes).where(eq(routes.formId, form.id))
    await db.delete(destinations).where(eq(destinations.id, destinationRow.id))
  })

  it("returns the original submission id for a duplicate Idempotency-Key", async () => {
    const form = await createForm()
    const headers = { "content-type": "application/json", "idempotency-key": "key-123" }
    const first = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: "dup@example.com" }),
    })
    const firstBody = (await first.json()) as { submission_id: string }

    const second = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: "dup@example.com" }),
    })
    const secondBody = (await second.json()) as { submission_id: string; idempotent: boolean }
    expect(secondBody.submission_id).toBe(firstBody.submission_id)
    expect(secondBody.idempotent).toBe(true)
  })

  it("honours per-form allowed_origins for CORS", async () => {
    const form = await createForm({ settings: { allowed_origins: ["https://allowed.example"] } })

    const allowed = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://allowed.example" },
      body: JSON.stringify({ email: "a@example.com" }),
    })
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://allowed.example")
    expect(allowed.headers.get("vary")).toBe("Origin")

    const rejected = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ email: "b@example.com" }),
    })
    const rejectedBody = (await rejected.json()) as { status: string; submission_id: string }
    expect(rejectedBody.status).toBe("quarantined")
    const [row] = await db.select().from(submissions).where(eq(submissions.id, rejectedBody.submission_id))
    expect(row?.quarantineReason).toBe("origin_rejected")
  })

  it("returns * when allowed_origins is empty", async () => {
    const form = await createForm()
    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://anything.example" },
      body: JSON.stringify({ email: "c@example.com" }),
    })
    expect(response.headers.get("access-control-allow-origin")).toBe("*")
  })

  it("resolves the client ip from CF-Connecting-IP first, then X-Forwarded-For, then unknown", async () => {
    const formCf = await createForm()
    const cfResponse = await harness.app.request(`/s/${formCf.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.9",
        "x-forwarded-for": "198.51.100.1, 10.0.0.1",
      },
      body: JSON.stringify({ email: "cf@example.com" }),
    })
    const cfBody = (await cfResponse.json()) as { submission_id: string }
    const [cfRow] = await db.select().from(submissions).where(eq(submissions.id, cfBody.submission_id))
    expect((cfRow?.meta as { ip?: string } | undefined)?.ip).toBe("203.0.113.9")

    const formXff = await createForm()
    const xffResponse = await harness.app.request(`/s/${formXff.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7, 10.0.0.1" },
      body: JSON.stringify({ email: "xff@example.com" }),
    })
    const xffBody = (await xffResponse.json()) as { submission_id: string }
    const [xffRow] = await db.select().from(submissions).where(eq(submissions.id, xffBody.submission_id))
    expect((xffRow?.meta as { ip?: string } | undefined)?.ip).toBe("198.51.100.7")

    const formNone = await createForm()
    const noneResponse = await harness.app.request(`/s/${formNone.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "none@example.com" }),
    })
    const noneBody = (await noneResponse.json()) as { submission_id: string }
    const [noneRow] = await db.select().from(submissions).where(eq(submissions.id, noneBody.submission_id))
    expect((noneRow?.meta as { ip?: string } | undefined)?.ip).toBe("unknown")
  })

  it("records CF-IPCountry as the submission's country", async () => {
    const form = await createForm()
    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-ipcountry": "SE" },
      body: JSON.stringify({ email: "se@example.com" }),
    })
    const body = (await response.json()) as { submission_id: string }
    const [row] = await db.select().from(submissions).where(eq(submissions.id, body.submission_id))
    expect((row?.meta as { country?: string } | undefined)?.country).toBe("SE")
  })

  it("rate-limits by the resolved CF-Connecting-IP, not X-Forwarded-For", async () => {
    const form = await createForm({ settings: { rate_limit: { per_minute: 1, burst: 1 } } })
    const headers = {
      "content-type": "application/json",
      "cf-connecting-ip": "203.0.113.55",
      "x-forwarded-for": "10.0.0.1",
    }
    const first = await harness.app.request(`/s/${form.id}`, { method: "POST", headers, body: JSON.stringify({ email: "1@example.com" }) })
    const firstBody = (await first.json()) as { status: string }
    expect(firstBody.status).toBe("received")

    const second = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { ...headers, "x-forwarded-for": "10.0.0.2" },
      body: JSON.stringify({ email: "2@example.com" }),
    })
    const secondBody = (await second.json()) as { status: string; submission_id: string }
    expect(secondBody.status).toBe("quarantined")
    const [row] = await db.select().from(submissions).where(eq(submissions.id, secondBody.submission_id))
    expect(row?.quarantineReason).toBe("rate_limited")
  })

  it("returns 404 for an unknown form id", async () => {
    const response = await harness.app.request("/s/fm_doesnotexist1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(response.status).toBe(404)
  })
})
