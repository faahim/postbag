import { newId } from "@postbag/core"
import {
  destinations,
  events,
  forms,
  organization,
  organizationSettings,
  projects,
  streams,
  submissions,
  systemWebhookDeliveries,
  type Database,
} from "@postbag/db"
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
  let manageOnlyKey: string

  beforeAll(async () => {
    harness = buildHarness()
    db = harness.db
    const orgA = await seedOrganization(db, "Org A")
    const orgB = await seedOrganization(db, "Org B")
    orgAId = orgA.organizationId
    orgBId = orgB.organizationId
    await db
      .update(organizationSettings)
      .set({ plan: "selfhost", planSource: "selfhost" })
      .where(eq(organizationSettings.organizationId, orgAId))
    keyA = await createTestApiKey(harness.auth, orgAId, orgA.userId, ["manage", "read", "submit"])
    keyB = await createTestApiKey(harness.auth, orgBId, orgB.userId, ["manage", "read", "submit"])
    readOnlyKey = await createTestApiKey(harness.auth, orgAId, orgA.userId, ["read"])
    manageOnlyKey = await createTestApiKey(harness.auth, orgAId, orgA.userId, ["manage"])
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

  it("reports only non-test submissions from the current month as monthly usage", async () => {
    const usageOrg = await seedOrganization(db, "Monthly Usage Org")
    const usageKey = await createTestApiKey(harness.auth, usageOrg.organizationId, usageOrg.userId)
    try {
      const [form] = await db
        .insert(forms)
        .values({
          id: newId("fm"),
          organizationId: usageOrg.organizationId,
          projectId: usageOrg.projectId,
          slug: "usage-form",
          name: "Usage form",
        })
        .returning()
      if (form === undefined) throw new Error("failed to create usage form")
      await db.insert(submissions).values([
        {
          id: newId("sb"),
          organizationId: usageOrg.organizationId,
          formId: form.id,
          data: { kind: "current" },
        },
        {
          id: newId("sb"),
          organizationId: usageOrg.organizationId,
          formId: form.id,
          data: { kind: "test" },
          test: true,
        },
        {
          id: newId("sb"),
          organizationId: usageOrg.organizationId,
          formId: form.id,
          data: { kind: "old" },
          receivedAt: new Date("2020-01-01T00:00:00.000Z"),
        },
      ])

      const response = await harness.app.request("/v1/me", authed(usageKey))
      expect(response.status).toBe(200)
      const body = (await response.json()) as { limits: { used: { submissions_this_month: number } } }
      expect(body.limits.used.submissions_this_month).toBe(1)
    } finally {
      await db.delete(organization).where(eq(organization.id, usageOrg.organizationId))
    }
  })

  it("enforces configured form and destination limits", async () => {
    const limitedOrg = await seedOrganization(db, "Limited Org")
    const limitedKey = await createTestApiKey(harness.auth, limitedOrg.organizationId, limitedOrg.userId)
    try {
      await db
        .update(organizationSettings)
        .set({ limits: { forms: 1, destinations: 1 } })
        .where(eq(organizationSettings.organizationId, limitedOrg.organizationId))

      const firstForm = await harness.app.request(
        "/v1/forms",
        authed(limitedKey, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Allowed form" }),
        }),
      )
      expect(firstForm.status).toBe(201)
      const secondForm = await harness.app.request(
        "/v1/forms",
        authed(limitedKey, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Blocked form" }),
        }),
      )
      expect(secondForm.status).toBe(402)
      expect(((await secondForm.json()) as { error: { code: string } }).error.code).toBe("plan_limit_reached")

      const destinationInput = { type: "email", config: { to: ["limits@example.com"] } }
      const firstDestination = await harness.app.request(
        "/v1/destinations",
        authed(limitedKey, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(destinationInput),
        }),
      )
      expect(firstDestination.status).toBe(201)
      const secondDestination = await harness.app.request(
        "/v1/destinations",
        authed(limitedKey, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(destinationInput),
        }),
      )
      expect(secondDestination.status).toBe(402)
      expect(((await secondDestination.json()) as { error: { code: string } }).error.code).toBe("plan_limit_reached")

      const rows = await db.select().from(destinations).where(eq(destinations.organizationId, limitedOrg.organizationId))
      expect(rows).toHaveLength(1)
    } finally {
      await db.delete(organization).where(eq(organization.id, limitedOrg.organizationId))
    }
  })

  // Job D 1a: a `manage`-only key is refused `read` in the production smoke test.
  // manage ⊇ read ⊇ submit — a manage key must satisfy every read-scoped call.
  it("a manage-only key satisfies read-scoped endpoints and /v1/me echoes the effective scopes", async () => {
    const listForms = await harness.app.request("/v1/forms", authed(manageOnlyKey))
    expect(listForms.status).toBe(200)

    const me = await harness.app.request("/v1/me", authed(manageOnlyKey))
    expect(me.status).toBe(200)
    const meBody = (await me.json()) as { key: { scopes: string[] } }
    expect(meBody.key.scopes.sort()).toEqual(["manage", "read", "submit"])
  })

  it("a read-only key does not satisfy manage-scoped endpoints", async () => {
    const me = await harness.app.request("/v1/me", authed(readOnlyKey))
    const meBody = (await me.json()) as { key: { scopes: string[] } }
    expect(meBody.key.scopes.sort()).toEqual(["read", "submit"])
  })

  it("POST /v1/api-keys defaults to [\"manage\"] when scopes is omitted", async () => {
    const email = `${newId("usr")}@example.test`
    const signUp = await harness.app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct horse battery staple", name: "Scope Default" }),
    })
    const cookie = signUp.headers.get("set-cookie")?.split(";")[0]

    const created = await harness.app.request("/v1/api-keys", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie ?? "" },
      body: JSON.stringify({ name: "default-scoped" }),
    })
    expect(created.status).toBe(201)
    const createdBody = (await created.json()) as { scopes: string[] }
    expect(createdBody.scopes).toEqual(["manage"])

    const me = await harness.app.request("/v1/me", { headers: { cookie: cookie ?? "" } })
    const meBody = (await me.json()) as { organization: { id: string } }
    await db.delete(organization).where(eq(organization.id, meBody.organization.id))
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

  it("quickstart verification exercises the configured browser origin", async () => {
    const response = await harness.app.request(
      "/v1/quickstart",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Origin verification", origin: "https://Example.com/contact/" }),
      }),
    )
    expect(response.status).toBe(201)
    const body = (await response.json()) as { verify: { curl: string } }
    expect(body.verify.curl).toContain("-H 'Origin: https://example.com'")
  })

  it("quickstart verification uses the existing form's persisted origin", async () => {
    const create = (origin?: string) =>
      harness.app.request(
        "/v1/quickstart",
        authed(keyA, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Persisted origin verification", origin }),
        }),
      )

    expect((await create("https://original.example/contact/")).status).toBe(201)
    const repeated = await create("https://different.example")
    expect(repeated.status).toBe(201)
    const body = (await repeated.json()) as { verify: { curl: string } }
    expect(body.verify.curl).toContain("-H 'Origin: https://original.example'")
    expect(body.verify.curl).not.toContain("different.example")
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

  it("derives a stream's first schema from the first attached form's published schema, with an identity mapping", async () => {
    const streamResponse = await harness.app.request(
      "/v1/streams",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Derived from form schema" }),
      }),
    )
    expect(streamResponse.status).toBe(201)
    const stream = (await streamResponse.json()) as { id: string; current_schema_version: number | null }
    expect(stream.current_schema_version).toBeNull()

    const formResponse = await harness.app.request(
      "/v1/forms",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Contact (published schema)",
          schema: {
            json_schema: { type: "object", properties: { name: { type: "string" }, email: { type: "string" } }, required: ["email"] },
          },
        }),
      }),
    )
    expect(formResponse.status).toBe(201)
    const form = (await formResponse.json()) as { id: string }

    // No mapping, no stream schema — the form supplies both.
    const attach = await harness.app.request(
      `/v1/streams/${stream.id}/sources`,
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ form_id: form.id }),
      }),
    )
    expect(attach.status).toBe(201)
    const source = (await attach.json()) as {
      mapping: Record<string, { from?: string }>
      mapping_status: string
      stream_schema_version: number
    }
    expect(source.stream_schema_version).toBe(1)
    expect(source.mapping_status).toBe("valid")
    expect(source.mapping).toEqual({ name: { from: "name" }, email: { from: "email" } })

    const detail = await harness.app.request(`/v1/streams/${stream.id}`, authed(keyA))
    const detailBody = (await detail.json()) as {
      current_schema_version: number | null
      schema?: { version: number; json_schema: { required?: string[] }; changelog?: string }
    }
    expect(detailBody.current_schema_version).toBe(1)
    expect(detailBody.schema?.json_schema.required).toEqual(["email"])
    expect(detailBody.schema?.changelog).toContain("Contact (published schema)")

    const changed = await db
      .select()
      .from(events)
      .where(eq(events.organizationId, orgAId))
    expect(
      changed.some((e) => e.type === "stream.schema.changed" && (e.subject as { stream_id?: string }).stream_id === stream.id),
    ).toBe(true)

    await db.delete(streams).where(eq(streams.id, stream.id))
  })

  it("previews a Form through a matching selector source", async () => {
    const formResponse = await harness.app.request(
      "/v1/forms",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Selector preview form", tags: ["selector-preview"] }),
      }),
    )
    const form = (await formResponse.json()) as { id: string }
    const streamResponse = await harness.app.request(
      "/v1/streams",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Selector preview stream",
          schema: {
            json_schema: {
              type: "object",
              properties: { email: { type: "string", format: "email" } },
              required: ["email"],
            },
          },
          sources: [{ selector: "tag:selector-preview", mapping: { email: { from: "contact.email" } } }],
        }),
      }),
    )
    expect(streamResponse.status).toBe(201)
    const stream = (await streamResponse.json()) as { id: string }

    const preview = await harness.app.request(
      `/v1/streams/${stream.id}/preview`,
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ form_id: form.id, data: { contact: { email: "hello@example.com" } } }),
      }),
    )
    expect(preview.status).toBe(200)
    expect(await preview.json()).toMatchObject({ payload: { email: "hello@example.com" }, problems: [] })

    await db.delete(streams).where(eq(streams.id, stream.id))
  })

  it("counts recent Submissions from tag and Project selector sources once per Stream", async () => {
    const countOrg = await seedOrganization(db, "Selector count Org")
    const countKey = await createTestApiKey(harness.auth, countOrg.organizationId, countOrg.userId)
    const taggedProjectId = newId("prj")
    try {
      await db.insert(projects).values({
        id: taggedProjectId,
        organizationId: countOrg.organizationId,
        slug: "selector-count-tags",
        name: "Selector count tags",
        tags: [],
      })
      const [taggedForm, projectForm, bothSelectorForm, unrelatedForm] = await db
        .insert(forms)
        .values([
          {
            id: newId("fm"),
            organizationId: countOrg.organizationId,
            projectId: taggedProjectId,
            slug: "tagged-selector-count",
            name: "Tagged selector count",
            tags: ["counted-by-selector"],
          },
          {
            id: newId("fm"),
            organizationId: countOrg.organizationId,
            projectId: countOrg.projectId,
            slug: "project-selector-count",
            name: "Project selector count",
            tags: [],
          },
          {
            id: newId("fm"),
            organizationId: countOrg.organizationId,
            projectId: countOrg.projectId,
            slug: "both-selector-count",
            name: "Both selector count",
            tags: ["counted-by-selector"],
          },
          {
            id: newId("fm"),
            organizationId: countOrg.organizationId,
            projectId: taggedProjectId,
            slug: "unrelated-selector-count",
            name: "Unrelated selector count",
            tags: [],
          },
        ])
        .returning()
      if (taggedForm === undefined || projectForm === undefined || bothSelectorForm === undefined || unrelatedForm === undefined)
        throw new Error("failed to seed count Forms")

      const streamResponse = await harness.app.request(
        "/v1/streams",
        authed(countKey, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Selector count stream",
            schema: { json_schema: { type: "object", properties: {} } },
            sources: [
              { selector: "tag:counted-by-selector", mapping: {} },
              { selector: `project:${countOrg.projectId}`, mapping: {} },
            ],
          }),
        }),
      )
      expect(streamResponse.status).toBe(201)
      const stream = (await streamResponse.json()) as { id: string }

      await db.insert(submissions).values([
        { id: newId("sb"), organizationId: countOrg.organizationId, formId: taggedForm.id, data: { source: "tag" } },
        { id: newId("sb"), organizationId: countOrg.organizationId, formId: projectForm.id, data: { source: "project" } },
        { id: newId("sb"), organizationId: countOrg.organizationId, formId: bothSelectorForm.id, data: { source: "both" } },
        { id: newId("sb"), organizationId: countOrg.organizationId, formId: unrelatedForm.id, data: { source: "unrelated" } },
        {
          id: newId("sb"),
          organizationId: countOrg.organizationId,
          formId: taggedForm.id,
          data: { source: "old tag" },
          receivedAt: new Date("2020-01-01T00:00:00.000Z"),
        },
      ])

      const detail = await harness.app.request(`/v1/streams/${stream.id}`, authed(countKey))
      expect(detail.status).toBe(200)
      expect(((await detail.json()) as { counts: { submissions_30d: number } }).counts.submissions_30d).toBe(3)
    } finally {
      await db.delete(organization).where(eq(organization.id, countOrg.organizationId))
    }
  })

  it("derives a stream's first schema from recent submissions when the form has no schema", async () => {
    const formResponse = await harness.app.request(
      "/v1/forms",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Observe-mode form with data" }),
      }),
    )
    const form = (await formResponse.json()) as { id: string }
    await db.insert(submissions).values({
      id: newId("sb"),
      organizationId: orgAId,
      formId: form.id,
      data: { fullName: "Eric", company: "Testing sites" },
    })

    const streamResponse = await harness.app.request(
      "/v1/streams",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Derived from submissions", sources: [{ form_id: form.id }] }),
      }),
    )
    expect(streamResponse.status).toBe(201)
    const stream = (await streamResponse.json()) as { id: string }

    const detail = await harness.app.request(`/v1/streams/${stream.id}`, authed(keyA))
    const detailBody = (await detail.json()) as {
      schema?: { version: number; json_schema: { properties: Record<string, unknown> } }
      sources?: { mapping: Record<string, unknown>; mapping_status: string }[]
    }
    expect(detailBody.schema?.version).toBe(1)
    expect(Object.keys(detailBody.schema?.json_schema.properties ?? {}).sort()).toEqual(["company", "fullName"])
    expect(detailBody.sources?.[0]?.mapping_status).toBe("valid")
    expect(detailBody.sources?.[0]?.mapping).toEqual({ fullName: { from: "fullName" }, company: { from: "company" } })

    await db.delete(streams).where(eq(streams.id, stream.id))
  })

  it("returns 422 stream_schema_missing when neither the stream nor the form has any fields", async () => {
    const streamResponse = await harness.app.request(
      "/v1/streams",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Nothing to derive" }),
      }),
    )
    const stream = (await streamResponse.json()) as { id: string }
    const formResponse = await harness.app.request(
      "/v1/forms",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Brand new form" }),
      }),
    )
    const form = (await formResponse.json()) as { id: string }

    const attach = await harness.app.request(
      `/v1/streams/${stream.id}/sources`,
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ form_id: form.id }),
      }),
    )
    expect(attach.status).toBe(422)
    const body = (await attach.json()) as { error: { code: string; hint: string; details?: { form_id?: string } } }
    expect(body.error.code).toBe("stream_schema_missing")
    expect(body.error.hint).toContain("POST /v1/streams/{id}/schema")
    expect(body.error.details?.form_id).toBe(form.id)

    // The stream stays schema-less — nothing half-published.
    const detail = await harness.app.request(`/v1/streams/${stream.id}`, authed(keyA))
    const detailBody = (await detail.json()) as { current_schema_version: number | null }
    expect(detailBody.current_schema_version).toBeNull()

    await db.delete(streams).where(eq(streams.id, stream.id))
  })

  it("names an unnamed destination after where it sends", async () => {
    const email = await harness.app.request(
      "/v1/destinations",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "email", config: { to: ["eric@example.com"] } }),
      }),
    )
    expect(email.status).toBe(201)
    expect(((await email.json()) as { name: string }).name).toBe("eric@example.com")

    const webhook = await harness.app.request(
      "/v1/destinations",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "webhook", config: { url: "https://hooks.example.com/postbag/leads" } }),
      }),
    )
    expect(webhook.status).toBe(201)
    expect(((await webhook.json()) as { name: string }).name).toBe("hooks.example.com")

    const named = await harness.app.request(
      "/v1/destinations",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "email", name: "Sales inbox", config: { to: ["sales@example.com"] } }),
      }),
    )
    expect(((await named.json()) as { name: string }).name).toBe("Sales inbox")
  })

  it("rejects incomplete digest Route updates without changing delivery mode", async () => {
    const formResponse = await harness.app.request(
      "/v1/forms",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Digest update validation" }),
      }),
    )
    expect(formResponse.status).toBe(201)
    const form = (await formResponse.json()) as { id: string }

    const destinationResponse = await harness.app.request(
      "/v1/destinations",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "email", config: { to: ["digest@example.com"] } }),
      }),
    )
    expect(destinationResponse.status).toBe(201)
    const destination = (await destinationResponse.json()) as { id: string }

    const routeResponse = await harness.app.request(
      "/v1/routes",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          form_id: form.id,
          destination_id: destination.id,
          mode: { type: "instant" },
        }),
      }),
    )
    expect(routeResponse.status).toBe(201)
    const route = (await routeResponse.json()) as { id: string }

    const incomplete = await harness.app.request(
      `/v1/routes/${route.id}`,
      authed(keyA, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: { type: "digest", cron: "0 9 * * *" } }),
      }),
    )
    expect(incomplete.status).toBe(422)

    const unchanged = await harness.app.request(`/v1/routes/${route.id}`, authed(keyA))
    expect(unchanged.status).toBe(200)
    expect(((await unchanged.json()) as { mode: { type: string } }).mode).toEqual({ type: "instant" })

    const complete = await harness.app.request(
      `/v1/routes/${route.id}`,
      authed(keyA, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: { type: "digest", cron: "0 9 * * *", timezone: "Asia/Dhaka" },
        }),
      }),
    )
    expect(complete.status).toBe(200)
    expect(((await complete.json()) as { mode: Record<string, string> }).mode).toEqual({
      type: "digest",
      cron: "0 9 * * *",
      timezone: "Asia/Dhaka",
    })
  })

  it("GET /v1/webhooks/{id}/deliveries returns cursor-paginated delivery history", async () => {
    const createWebhook = await harness.app.request(
      "/v1/webhooks",
      authed(keyA, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/hook", events: ["submission.received"] }),
      }),
    )
    expect(createWebhook.status).toBe(201)
    const webhook = (await createWebhook.json()) as { id: string }

    // Inserting a matching event is enough — the `dispatch_system_webhooks` trigger
    // (job D §2) enqueues the system_webhook_deliveries row itself.
    await db
      .insert(events)
      .values({ id: newId("ev"), organizationId: orgAId, type: "submission.received", subject: {}, data: {} })

    const list = await harness.app.request(`/v1/webhooks/${webhook.id}/deliveries`, authed(keyA))
    expect(list.status).toBe(200)
    const body = (await list.json()) as { data: { id: string; status: string; webhook_id: string }[] }
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.status).toBe("pending")
    expect(body.data[0]?.webhook_id).toBe(webhook.id)

    // Org B cannot see org A's webhook deliveries.
    const fromOrgB = await harness.app.request(`/v1/webhooks/${webhook.id}/deliveries`, authed(keyB))
    expect(fromOrgB.status).toBe(404)

    await db.delete(systemWebhookDeliveries).where(eq(systemWebhookDeliveries.webhookId, webhook.id))
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
