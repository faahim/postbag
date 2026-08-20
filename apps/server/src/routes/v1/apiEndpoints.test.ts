import { newId } from "@postbag/core"
import { organization, streams, type Database } from "@postbag/db"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { buildHarness, createTestApiKey, seedOrganization, TEST_DATABASE_URL, type TestHarness } from "../../testUtils.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

integration("/v1 API", () => {
  let harness: TestHarness
  let db: Database
  let orgAId: string
  let orgBId: string
  let keyA: string
  let keyB: string
  let readOnlyKey: string

  beforeAll(async () => {
    harness = buildHarness()
    db = harness.db
    const orgA = await seedOrganization(db, "Org A")
    const orgB = await seedOrganization(db, "Org B")
    orgAId = orgA.organizationId
    orgBId = orgB.organizationId
    keyA = await createTestApiKey(harness.auth, orgAId, orgA.userId, ["manage", "read", "submit"])
    keyB = await createTestApiKey(harness.auth, orgBId, orgB.userId, ["manage", "read", "submit"])
    readOnlyKey = await createTestApiKey(harness.auth, orgAId, orgA.userId, ["read"])
  })

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, orgAId))
    await db.delete(organization).where(eq(organization.id, orgBId))
    await harness.close()
  })

  function authed(key: string, init: RequestInit = {}): RequestInit {
    const headers = new Headers(init.headers)
    headers.set("authorization", `Bearer ${key}`)
    return { ...init, headers }
  }

  it("rejects missing credentials with 401", async () => {
    const response = await harness.app.request("/v1/me")
    expect(response.status).toBe(401)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe("unauthorized")
  })

  it("rejects an invalid API key with 401", async () => {
    const response = await harness.app.request("/v1/me", authed("pb_live_not_a_real_key"))
    expect(response.status).toBe(401)
  })

  it("returns org identity and scopes for a valid key", async () => {
    const response = await harness.app.request("/v1/me", authed(keyA))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { organization: { id: string }; key: { scopes: string[] } }
    expect(body.organization.id).toBe(orgAId)
    expect(body.key.scopes.sort()).toEqual(["manage", "read", "submit"])
  })

  it("rejects a manage-only action from a read-scoped key with 403", async () => {
    const response = await harness.app.request(
      "/v1/forms",
      authed(readOnlyKey, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Should fail" }),
      }),
    )
    expect(response.status).toBe(403)
  })

  it("creates a form for org A and hides it from org B (404, not 403)", async () => {
    const created = await harness.app.request(
      "/v1/forms",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Isolation test" }),
      }),
    )
    expect(created.status).toBe(201)
    const form = (await created.json()) as { id: string }

    const fromOrgB = await harness.app.request(`/v1/forms/${form.id}`, authed(keyB))
    expect(fromOrgB.status).toBe(404)

    const fromOrgA = await harness.app.request(`/v1/forms/${form.id}`, authed(keyA))
    expect(fromOrgA.status).toBe(200)
  })

  it("quickstart is idempotent by (project, name)", async () => {
    const body = { name: "Quickstart idempotency", notify_email: "me@example.com" }
    const first = await harness.app.request(
      "/v1/quickstart",
      authed(keyA, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    )
    expect(first.status).toBe(201)
    const firstBody = (await first.json()) as { form: { id: string } }

    const second = await harness.app.request(
      "/v1/quickstart",
      authed(keyA, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    )
    expect(second.status).toBe(201)
    const secondBody = (await second.json()) as { form: { id: string } }
    expect(secondBody.form.id).toBe(firstBody.form.id)
  })

  it("publishing a form schema bumps the version and resolves matching drift events", async () => {
    const createResponse = await harness.app.request(
      "/v1/forms",
      authed(keyA, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Schema publish test" }) }),
    )
    const form = (await createResponse.json()) as { id: string }

    const publishOne = await harness.app.request(
      `/v1/forms/${form.id}/schema`,
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json_schema: { type: "object", properties: { email: { type: "string" } }, required: ["email"] } }),
      }),
    )
    expect(publishOne.status).toBe(201)
    const publishedOne = (await publishOne.json()) as { version: number }
    expect(publishedOne.version).toBe(1)

    // A submission that drifts (new field) creates an open drift event.
    await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@example.com", phone: "12345" }),
    })

    const driftBefore = await harness.app.request(`/v1/forms/${form.id}/drift`, authed(keyA))
    const driftBeforeBody = (await driftBefore.json()) as { field: string }[]
    expect(driftBeforeBody.some((d) => d.field === "phone")).toBe(true)

    const publishTwo = await harness.app.request(
      `/v1/forms/${form.id}/schema`,
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          json_schema: {
            type: "object",
            properties: { email: { type: "string" }, phone: { type: "string" } },
            required: ["email"],
          },
        }),
      }),
    )
    expect(publishTwo.status).toBe(201)
    const publishedTwo = (await publishTwo.json()) as { version: number }
    expect(publishedTwo.version).toBe(2)

    const driftAfter = await harness.app.request(`/v1/forms/${form.id}/drift`, authed(keyA))
    const driftAfterBody = (await driftAfter.json()) as { field: string }[]
    expect(driftAfterBody.some((d) => d.field === "phone")).toBe(false)
  })

  it("rejects attaching an incomplete stream mapping with 422 mapping_incomplete", async () => {
    const streamResponse = await harness.app.request(
      "/v1/streams",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Leads",
          schema: { json_schema: { type: "object", properties: { name: { type: "string" }, phone: { type: "string" } }, required: ["name", "phone"] } },
        }),
      }),
    )
    expect(streamResponse.status).toBe(201)
    const stream = (await streamResponse.json()) as { id: string }

    const formResponse = await harness.app.request(
      "/v1/forms",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Incomplete mapping form", schema: { json_schema: { type: "object", properties: { name: { type: "string" } } } } }),
      }),
    )
    const form = (await formResponse.json()) as { id: string }

    const attach = await harness.app.request(
      `/v1/streams/${stream.id}/sources`,
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ form_id: form.id, mapping: { name: { from: "name" } } }),
      }),
    )
    expect(attach.status).toBe(422)
    const body = (await attach.json()) as { error: { code: string; details?: { missing?: string[] } } }
    expect(body.error.code).toBe("mapping_incomplete")
    expect(body.error.details?.missing).toContain("phone")

    await db.delete(streams).where(eq(streams.id, stream.id))
  })

  it("/health reports db up and a version", async () => {
    const response = await harness.app.request("/health")
    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean; db: string; worker: { alive: boolean }; version: string }
    expect(body.ok).toBe(true)
    expect(body.db).toBe("up")
    expect(typeof body.version).toBe("string")
  })

  it("/llms.txt and /openapi.json are served", async () => {
    const llms = await harness.app.request("/llms.txt")
    expect(llms.status).toBe(200)
    expect((await llms.text())).toContain("Postbag")

    const openapi = await harness.app.request("/openapi.json")
    expect(openapi.status).toBe(200)
    const doc = (await openapi.json()) as { openapi: string; paths: Record<string, unknown> }
    expect(doc.openapi).toBe("3.1.0")
    expect(doc.paths["/v1/me"]).toBeDefined()
  })

  it("creates a session, provisions an organization, and can mint an API key", async () => {
    const email = `${newId("usr")}@example.test`
    const signUp = await harness.app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct horse battery staple", name: "Test User" }),
    })
    expect(signUp.status).toBeLessThan(400)
    const setCookie = signUp.headers.get("set-cookie")
    expect(setCookie).toBeDefined()
    const cookie = setCookie?.split(";")[0]

    const me = await harness.app.request("/v1/me", { headers: { cookie: cookie ?? "" } })
    expect(me.status).toBe(200)
    const meBody = (await me.json()) as { organization: { id: string } }

    const createKey = await harness.app.request("/v1/api-keys", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie ?? "" },
      body: JSON.stringify({ name: "from session", scopes: ["read"] }),
    })
    expect(createKey.status).toBe(201)
    const keyBody = (await createKey.json()) as { key: string }
    expect(keyBody.key.startsWith("pb_live_")).toBe(true)

    await db.delete(organization).where(eq(organization.id, meBody.organization.id))
  })
})
