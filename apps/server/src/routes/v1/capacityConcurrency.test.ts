import { count, eq } from "drizzle-orm"
import { destinations, forms, organization, organizationSettings, type Database } from "@postbag/db"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { buildHarness, createTestApiKey, seedOrganization, TEST_DATABASE_URL, type TestHarness } from "../../testUtils.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

integration("plan capacity concurrency", () => {
  let harness: TestHarness
  let db: Database

  beforeAll(() => {
    harness = buildHarness()
    db = harness.db
  })

  afterAll(async () => {
    await harness.close()
  })

  function authed(key: string, init: RequestInit): RequestInit {
    const headers = new Headers(init.headers)
    headers.set("authorization", `Bearer ${key}`)
    return { ...init, headers }
  }

  function concurrentRequest(path: string, init: RequestInit): Promise<Response> {
    return Promise.resolve().then(() => harness.app.request(path, init))
  }

  async function limitedOrganization(
    limits: Record<string, number>,
  ): Promise<{ readonly organizationId: string; readonly projectId: string; readonly key: string }> {
    const seeded = await seedOrganization(db, "Capacity concurrency")
    await db
      .update(organizationSettings)
      .set({ limits })
      .where(eq(organizationSettings.organizationId, seeded.organizationId))
    const key = await createTestApiKey(harness.auth, seeded.organizationId, seeded.userId)
    return { organizationId: seeded.organizationId, projectId: seeded.projectId, key }
  }

  async function resourceCount(table: typeof forms | typeof destinations, organizationId: string): Promise<number> {
    const [row] = await db.select({ value: count() }).from(table).where(eq(table.organizationId, organizationId))
    return row?.value ?? 0
  }

  it("allows only one concurrent form create at a one-form limit", async () => {
    const { organizationId, key } = await limitedOrganization({ forms: 1 })
    try {
      const responses = await Promise.all(
        ["First form", "Second form"].map((name) =>
          concurrentRequest(
            "/v1/forms",
            authed(key, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name }),
            }),
          ),
        ),
      )
      expect(responses.map((response) => response.status).sort()).toEqual([201, 402])
      expect(await resourceCount(forms, organizationId)).toBe(1)
    } finally {
      await db.delete(organization).where(eq(organization.id, organizationId))
    }
  })

  it("returns an existing form before checking capacity", async () => {
    const { organizationId, projectId, key } = await limitedOrganization({ forms: 0 })
    try {
      const [existing] = await db
        .insert(forms)
        .values({ organizationId, projectId, slug: "existing-form", name: "Existing form" })
        .returning()
      if (existing === undefined) throw new Error("Failed to seed existing form.")
      const response = await harness.app.request(
        "/v1/forms",
        authed(key, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Existing form", if_exists: "return" }),
        }),
      )
      expect(response.status).toBe(201)
      expect(((await response.json()) as { id: string }).id).toBe(existing.id)
    } finally {
      await db.delete(organization).where(eq(organization.id, organizationId))
    }
  })

  it("allows only one concurrent destination create at a one-destination limit", async () => {
    const { organizationId, key } = await limitedOrganization({ destinations: 1 })
    try {
      const responses = await Promise.all(
        ["first@example.com", "second@example.com"].map((email) =>
          concurrentRequest(
            "/v1/destinations",
            authed(key, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ type: "email", config: { to: [email] } }),
            }),
          ),
        ),
      )
      expect(responses.map((response) => response.status).sort()).toEqual([201, 402])
      expect(await resourceCount(destinations, organizationId)).toBe(1)
    } finally {
      await db.delete(organization).where(eq(organization.id, organizationId))
    }
  })

  it("rolls back a quickstart form when all requested destinations do not fit", async () => {
    const { organizationId, key } = await limitedOrganization({ forms: 1, destinations: 1 })
    try {
      const response = await harness.app.request(
        "/v1/quickstart",
        authed(key, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Atomic quickstart",
            notify_email: "quickstart@example.com",
            webhook: { url: "https://example.com/webhook" },
          }),
        }),
      )
      expect(response.status).toBe(402)
      expect(await resourceCount(forms, organizationId)).toBe(0)
      expect(await resourceCount(destinations, organizationId)).toBe(0)
    } finally {
      await db.delete(organization).where(eq(organization.id, organizationId))
    }
  })
})
