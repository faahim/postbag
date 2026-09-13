import { newId } from "@postbag/core"
import { eq } from "drizzle-orm"
import {
  anonymousSandboxes,
  deliveries,
  destinations,
  forms,
  organization,
  organizationSettings,
  routes,
  submissions,
  user,
} from "@postbag/db"
import { afterEach, describe, expect, it } from "vitest"

import { buildHarness, createTestApiKey, seedOrganization, TEST_DATABASE_URL, type TestHarness } from "../../testUtils.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

function authed(key: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers)
  headers.set("authorization", `Bearer ${key}`)
  headers.set("content-type", "application/json")
  return { ...init, headers }
}

type GrowthMetricsBody = {
  readonly generated_at: string
  readonly organizations: {
    readonly total: number
    readonly created_7d: number
    readonly created_30d: number
    readonly by_plan: { readonly free: number; readonly pro: number; readonly team: number; readonly selfhost: number }
  }
  readonly forms: {
    readonly total: number
    readonly created_7d: number
    readonly created_30d: number
    readonly active: number
  }
  readonly submissions: {
    readonly total: number
    readonly last_7d: number
    readonly last_30d: number
    readonly real_last_30d: number
    readonly test_last_30d: number
    readonly orgs_with_real_delivery_30d: number
  }
  readonly sandboxes: {
    readonly created_30d: number
    readonly claimed_30d: number
    readonly expired_or_blocked_30d: number
  }
  readonly destinations: { readonly by_type: Readonly<Record<string, number>> }
}

function expectMetricsShape(body: GrowthMetricsBody): void {
  expect(body.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  expect(Number.isNaN(Date.parse(body.generated_at))).toBe(false)

  const groups = [body.organizations, body.forms, body.submissions, body.sandboxes] as const
  for (const group of groups) {
    for (const [key, value] of Object.entries(group)) {
      if (key === "by_plan") continue
      expect(Number.isInteger(value), key).toBe(true)
      expect(value, key).toBeGreaterThanOrEqual(0)
    }
  }
  for (const plan of ["free", "pro", "team", "selfhost"] as const) {
    expect(body.organizations.by_plan[plan]).toBeGreaterThanOrEqual(0)
  }
  for (const type of ["email", "telegram", "webhook", "slack", "discord"]) {
    expect(body.destinations.by_type[type]).toBeGreaterThanOrEqual(0)
  }
}

integration("GET /v1/admin/growth-metrics", () => {
  let harness: TestHarness | undefined
  const orgIds: string[] = []
  const sandboxIds: string[] = []

  afterEach(async () => {
    if (harness !== undefined) {
      for (const id of sandboxIds) {
        await harness.db.delete(anonymousSandboxes).where(eq(anonymousSandboxes.id, id))
      }
      for (const id of orgIds) {
        await harness.db.delete(organization).where(eq(organization.id, id))
      }
      await harness.close()
    }
    orgIds.length = 0
    sandboxIds.length = 0
    harness = undefined
  })

  async function setup(asAdmin: boolean) {
    const seedHarness = buildHarness()
    const adminOrg = await seedOrganization(seedHarness.db, "Growth Admin Org")
    const otherOrg = await seedOrganization(seedHarness.db, "Growth Other Org")
    const [adminUser] = await seedHarness.db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, adminOrg.userId))
      .limit(1)
    const adminEmail = adminUser?.email
    if (adminEmail === undefined) throw new Error("seeded admin user has no email")
    await seedHarness.close()

    const h = buildHarness({ PLATFORM_ADMIN_EMAILS: asAdmin ? [adminEmail] : [] })
    harness = h
    orgIds.push(adminOrg.organizationId, otherOrg.organizationId)
    const adminKey = await createTestApiKey(h.auth, adminOrg.organizationId, adminOrg.userId)
    const otherKey = await createTestApiKey(h.auth, otherOrg.organizationId, otherOrg.userId)
    return { h, adminOrg, otherOrg, adminKey, otherKey }
  }

  it("is 404 not_found when PLATFORM_ADMIN_EMAILS is empty (self-host default)", async () => {
    const { h, adminKey } = await setup(false)
    const response = await h.app.request("/v1/admin/growth-metrics", authed(adminKey))
    expect(response.status).toBe(404)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe("not_found")
  })

  it("is 404 not_found for a key whose org owner is not on the allowlist", async () => {
    const { h, otherKey } = await setup(true)
    const response = await h.app.request("/v1/admin/growth-metrics", authed(otherKey))
    expect(response.status).toBe(404)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe("not_found")
  })

  it("returns aggregate KPIs for a platform admin and reflects seeded rows", async () => {
    const { h, adminKey, adminOrg, otherOrg } = await setup(true)

    const beforeResponse = await h.app.request("/v1/admin/growth-metrics", authed(adminKey))
    expect(beforeResponse.status).toBe(200)
    const before = (await beforeResponse.json()) as GrowthMetricsBody
    expectMetricsShape(before)

    await h.db
      .update(organizationSettings)
      .set({ plan: "pro" })
      .where(eq(organizationSettings.organizationId, otherOrg.organizationId))

    const formId = newId("fm")
    await h.db.insert(forms).values({
      id: formId,
      organizationId: adminOrg.organizationId,
      projectId: adminOrg.projectId,
      slug: `growth-${formId.slice(-8)}`,
      name: "Growth form",
    })

    const destinationId = newId("ds")
    await h.db.insert(destinations).values({
      id: destinationId,
      organizationId: adminOrg.organizationId,
      type: "email",
      name: "Growth inbox",
      config: { to: ["growth@example.test"] },
    })
    const routeId = newId("rt")
    await h.db.insert(routes).values({
      id: routeId,
      organizationId: adminOrg.organizationId,
      formId,
      destinationId,
    })
    const realSubmissionId = newId("sb")
    await h.db.insert(submissions).values({
      id: realSubmissionId,
      organizationId: adminOrg.organizationId,
      formId,
      data: { n: 1 },
      test: false,
    })
    await h.db.insert(submissions).values({
      id: newId("sb"),
      organizationId: adminOrg.organizationId,
      formId,
      data: { n: 2 },
      test: true,
    })
    await h.db.insert(deliveries).values({
      id: newId("dl"),
      organizationId: adminOrg.organizationId,
      submissionId: realSubmissionId,
      routeId,
      destinationId,
      status: "sent",
      sentAt: new Date(),
      payload: { n: 1 },
      dedupeKey: `${realSubmissionId}:${routeId}`,
    })

    const createdSandboxId = newId("fm")
    const claimedSandboxId = newId("fm")
    const blockedSandboxId = newId("fm")
    sandboxIds.push(createdSandboxId, claimedSandboxId, blockedSandboxId)
    await h.db.insert(anonymousSandboxes).values([
      {
        id: createdSandboxId,
        name: "Created",
        slug: createdSandboxId,
        tokenHash: `th_${createdSandboxId}`,
        status: "active",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        creationIdempotencyKeyHash: `ci_${createdSandboxId}`,
        requestBodyHash: `rb_${createdSandboxId}`,
        abuseSourceKey: `src_${createdSandboxId}`,
      },
      {
        id: claimedSandboxId,
        name: "Claimed",
        slug: claimedSandboxId,
        tokenHash: `th_${claimedSandboxId}`,
        status: "claimed",
        claimedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        creationIdempotencyKeyHash: `ci_${claimedSandboxId}`,
        requestBodyHash: `rb_${claimedSandboxId}`,
        abuseSourceKey: `src_${claimedSandboxId}`,
      },
      {
        id: blockedSandboxId,
        name: "Blocked",
        slug: blockedSandboxId,
        tokenHash: `th_${blockedSandboxId}`,
        status: "blocked",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        creationIdempotencyKeyHash: `ci_${blockedSandboxId}`,
        requestBodyHash: `rb_${blockedSandboxId}`,
        abuseSourceKey: `src_${blockedSandboxId}`,
      },
    ])

    const afterResponse = await h.app.request("/v1/admin/growth-metrics", authed(adminKey))
    expect(afterResponse.status).toBe(200)
    const after = (await afterResponse.json()) as GrowthMetricsBody
    expectMetricsShape(after)

    expect(JSON.stringify(after)).not.toMatch(/@example\.test/)
    expect(after).not.toHaveProperty("email")
    expect(Object.keys(after).sort()).toEqual([
      "destinations",
      "forms",
      "generated_at",
      "organizations",
      "sandboxes",
      "submissions",
    ])

    expect(after.organizations.total).toBeGreaterThanOrEqual(before.organizations.total)
    expect(after.organizations.by_plan.pro).toBe(before.organizations.by_plan.pro + 1)
    expect(after.forms.total).toBe(before.forms.total + 1)
    expect(after.forms.active).toBe(before.forms.active + 1)
    expect(after.submissions.total).toBe(before.submissions.total + 2)
    expect(after.submissions.real_last_30d).toBe(before.submissions.real_last_30d + 1)
    expect(after.submissions.test_last_30d).toBe(before.submissions.test_last_30d + 1)
    expect(after.submissions.orgs_with_real_delivery_30d).toBe(
      before.submissions.orgs_with_real_delivery_30d + 1,
    )
    expect(after.destinations.by_type["email"]).toBe((before.destinations.by_type["email"] ?? 0) + 1)
    expect(after.sandboxes.created_30d).toBe(before.sandboxes.created_30d + 3)
    expect(after.sandboxes.claimed_30d).toBe(before.sandboxes.claimed_30d + 1)
    expect(after.sandboxes.expired_or_blocked_30d).toBe(before.sandboxes.expired_or_blocked_30d + 1)
  })
})
