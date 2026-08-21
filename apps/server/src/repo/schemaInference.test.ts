import { newId } from "@postbag/core"
import { forms, organization, submissions, type Database } from "@postbag/db"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { buildHarness, createTestApiKey, seedOrganization, TEST_DATABASE_URL, type TestHarness } from "../testUtils.js"
import { inferFormSchemaDraft } from "./schemaInference.js"
import { runSchemaInferenceSweep } from "../worker/housekeeping.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

// Job D §4: observe-mode schema inference. `inferFormSchemaDraft` (called by the on-demand
// route and the 10-minute housekeeping sweep) writes a `form_schema_drafts` row from the
// last 200 non-spam submissions; publishing a real schema version stays a separate,
// explicit act.
integration("observe-mode schema inference", () => {
  let harness: TestHarness
  let db: Database
  let organizationId: string
  let projectId: string
  let apiKey: string

  beforeAll(async () => {
    harness = buildHarness()
    db = harness.db
    const seeded = await seedOrganization(db, "Inference Org")
    organizationId = seeded.organizationId
    projectId = seeded.projectId
    apiKey = await createTestApiKey(harness.auth, organizationId, seeded.userId, ["manage", "read", "submit"])
  })

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, organizationId))
    await harness.close()
  })

  function authed(init: RequestInit = {}): RequestInit {
    const headers = new Headers(init.headers)
    headers.set("authorization", `Bearer ${apiKey}`)
    return { ...init, headers }
  }

  async function createForm() {
    const [form] = await db
      .insert(forms)
      .values({ id: newId("fm"), organizationId, projectId, slug: `inf-${newId("fm").slice(-8)}`, name: "Inference form" })
      .returning()
    if (form === undefined) throw new Error("failed to create form")
    return form
  }

  it("has nothing to infer before any submissions exist", async () => {
    const form = await createForm()
    const response = await harness.app.request(`/v1/forms/${form.id}/schema/infer`, authed({ method: "POST" }))
    expect(response.status).toBe(404)
  })

  it("infers a draft from recent submissions and serves it as GET .../schema with inferred: true", async () => {
    const form = await createForm()
    for (const data of [{ email: "a@example.com", plan: "pro" }, { email: "b@example.com", plan: "free" }]) {
      const response = await harness.app.request(`/s/${form.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      })
      expect(response.status).toBe(200)
    }

    const inferResponse = await harness.app.request(`/v1/forms/${form.id}/schema/infer`, authed({ method: "POST" }))
    expect(inferResponse.status).toBe(200)
    const inferred = (await inferResponse.json()) as {
      inferred: boolean
      json_schema: { properties: Record<string, unknown> }
    }
    expect(inferred.inferred).toBe(true)
    expect(Object.keys(inferred.json_schema.properties).sort()).toEqual(["email", "plan"])

    const getResponse = await harness.app.request(`/v1/forms/${form.id}/schema`, authed())
    expect(getResponse.status).toBe(200)
    const served = (await getResponse.json()) as { inferred: boolean; version?: number }
    expect(served.inferred).toBe(true)
    expect(served.version).toBeUndefined()
  })

  it("refuses to infer once a schema is published", async () => {
    const form = await createForm()
    await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "c@example.com" }),
    })
    const publish = await harness.app.request(
      `/v1/forms/${form.id}/schema`,
      authed({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json_schema: { type: "object", properties: { email: { type: "string" } } } }),
      }),
    )
    expect(publish.status).toBe(201)

    const inferResponse = await harness.app.request(`/v1/forms/${form.id}/schema/infer`, authed({ method: "POST" }))
    expect(inferResponse.status).toBe(409)
  })

  it("the housekeeping sweep infers drafts for every eligible observe-mode form", async () => {
    const form = await createForm()
    await db.insert(submissions).values({
      id: newId("sb"),
      organizationId,
      formId: form.id,
      data: { name: "Ada" },
    })

    await runSchemaInferenceSweep(db, harness.logger)

    const getResponse = await harness.app.request(`/v1/forms/${form.id}/schema`, authed())
    expect(getResponse.status).toBe(200)
    const served = (await getResponse.json()) as { inferred: boolean; json_schema: { properties: Record<string, unknown> } }
    expect(served.inferred).toBe(true)
    expect(Object.keys(served.json_schema.properties)).toEqual(["name"])
  })

  it("inferFormSchemaDraft returns null when there are no non-spam submissions", async () => {
    const form = await createForm()
    const result = await inferFormSchemaDraft(db, organizationId, form.id)
    expect(result).toBeNull()
  })
})
