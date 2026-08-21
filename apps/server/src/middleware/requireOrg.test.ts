import { organization } from "@postbag/db"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  addMember,
  buildHarness,
  seedOrganization,
  signUpTestUser,
  TEST_DATABASE_URL,
  type TestHarness,
} from "../testUtils.js"

// Job L §1 — with no `activeOrganizationId` on the session (a brand-new sign-in that never
// switched), `requireOrg` must fall back to the organization the user *owns* (oldest owner
// membership), never the most recently joined one. Being invited into someone else's org
// must not change a user's default dashboard.
const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

integration("requireOrg owner-first fallback", () => {
  let harness: TestHarness
  const cleanupOrgIds: string[] = []

  beforeAll(() => {
    harness = buildHarness()
  })

  afterAll(async () => {
    for (const id of cleanupOrgIds) {
      await harness.db.delete(organization).where(eq(organization.id, id))
    }
    await harness.close()
  })

  it("resolves to the personal (owned) org, not a more recently joined membership", async () => {
    const { userId, cookie } = await signUpTestUser(harness.app)
    // Sign-up already made the user owner of a personal org (provisionPersonalOrganization).
    // Discover it via /v1/me before adding a second, more-recently-joined membership.
    const initialMe = await harness.app.request("/v1/me", { headers: { cookie } })
    expect(initialMe.status).toBe(200)
    const initialBody = (await initialMe.json()) as { organization: { id: string } }
    const personalOrgId = initialBody.organization.id
    cleanupOrgIds.push(personalOrgId)

    // A second organization the user later joins as admin (e.g. accepted an invitation).
    // Its membership row is newer than the personal org's, so the old "most recent
    // membership" fallback would have picked this one instead.
    const otherOrg = await seedOrganization(harness.db, "Someone Else's Org")
    cleanupOrgIds.push(otherOrg.organizationId)
    await addMember(harness.db, otherOrg.organizationId, userId, "admin")

    // No explicit active-organization switch was ever made for this session.
    const me = await harness.app.request("/v1/me", { headers: { cookie } })
    expect(me.status).toBe(200)
    const body = (await me.json()) as { organization: { id: string } }
    expect(body.organization.id).toBe(personalOrgId)
  })

  it("falls back to the most recent membership when the user owns no organization at all", async () => {
    const { userId, cookie } = await signUpTestUser(harness.app)
    const initialMe = await harness.app.request("/v1/me", { headers: { cookie } })
    const initialBody = (await initialMe.json()) as { organization: { id: string } }
    const personalOrgId = initialBody.organization.id

    // Simulate the personal org having been deleted/left (pathological/legacy data): the
    // user now owns nothing, but still has a plain membership elsewhere.
    await harness.db.delete(organization).where(eq(organization.id, personalOrgId))
    const otherOrg = await seedOrganization(harness.db, "A Member-Only Org")
    cleanupOrgIds.push(otherOrg.organizationId)
    await addMember(harness.db, otherOrg.organizationId, userId, "member")

    const me = await harness.app.request("/v1/me", { headers: { cookie } })
    expect(me.status).toBe(200)
    const body = (await me.json()) as { organization: { id: string } }
    expect(body.organization.id).toBe(otherOrg.organizationId)
  })
})
