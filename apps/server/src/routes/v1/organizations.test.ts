import { organization, organizationSettings } from "@postbag/db"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  addMember,
  buildHarness,
  createTestApiKey,
  seedOrganization,
  setActiveOrganizationForTest,
  signUpTestUser,
  TEST_DATABASE_URL,
  type SeededUser,
  type TestHarness,
} from "../../testUtils.js"

// Job L §1/§3 — GET /v1/me `organizations`, POST /v1/me/active-organization, and
// POST /v1/organizations. All three are session concepts: an API key resolves to exactly
// one organization for its whole life and cannot switch or "own a list" of orgs.
const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

integration("organization switching and creation", () => {
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

  it("GET /v1/me.organizations lists every org a session user belongs to, with role and is_active", async () => {
    const person: SeededUser = await signUpTestUser(harness.app, "Multi Org")
    const initialMe = await harness.app.request("/v1/me", { headers: { cookie: person.cookie } })
    const initialBody = (await initialMe.json()) as {
      readonly organization: { readonly id: string }
    }
    const personalOrgId = initialBody.organization.id
    cleanupOrgIds.push(personalOrgId)

    const otherOrg = await seedOrganization(harness.db, "Second Org")
    cleanupOrgIds.push(otherOrg.organizationId)
    await addMember(harness.db, otherOrg.organizationId, person.userId, "admin")

    const me = await harness.app.request("/v1/me", { headers: { cookie: person.cookie } })
    const body = (await me.json()) as {
      readonly organization: { readonly id: string }
      readonly organizations: readonly {
        readonly id: string
        readonly role: string | null
        readonly is_active: boolean
      }[]
    }
    expect(body.organizations).toHaveLength(2)
    const personal = body.organizations.find((o) => o.id === personalOrgId)
    const other = body.organizations.find((o) => o.id === otherOrg.organizationId)
    expect(personal?.role).toBe("owner")
    expect(personal?.is_active).toBe(true)
    expect(other?.role).toBe("admin")
    expect(other?.is_active).toBe(false)
  })

  it("GET /v1/me.organizations for an API key is just that key's one organization, with a null role", async () => {
    const seeded = await seedOrganization(harness.db, "Key Org")
    cleanupOrgIds.push(seeded.organizationId)
    const key = await createTestApiKey(harness.auth, seeded.organizationId, seeded.userId, ["read"])

    const res = await harness.app.request("/v1/me", { headers: { authorization: `Bearer ${key}` } })
    const body = (await res.json()) as {
      readonly organizations: readonly { readonly id: string; readonly role: string | null }[]
    }
    expect(body.organizations).toHaveLength(1)
    expect(body.organizations[0]?.id).toBe(seeded.organizationId)
    expect(body.organizations[0]?.role).toBeNull()
  })

  it("me_set_active_organization switches for a member, refuses for a non-member, and refuses an API key", async () => {
    const person = await signUpTestUser(harness.app, "Switcher")
    const initialMe = await harness.app.request("/v1/me", { headers: { cookie: person.cookie } })
    const personalOrgId = (
      (await initialMe.json()) as { readonly organization: { readonly id: string } }
    ).organization.id
    cleanupOrgIds.push(personalOrgId)

    const targetOrg = await seedOrganization(harness.db, "Target Org")
    cleanupOrgIds.push(targetOrg.organizationId)
    await addMember(harness.db, targetOrg.organizationId, person.userId, "member")

    const nonMemberOrg = await seedOrganization(harness.db, "Not A Member Here")
    cleanupOrgIds.push(nonMemberOrg.organizationId)

    const forbidden = await harness.app.request("/v1/me/active-organization", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: person.cookie },
      body: JSON.stringify({ organization_id: nonMemberOrg.organizationId }),
    })
    expect(forbidden.status).toBe(403)

    const ok = await harness.app.request("/v1/me/active-organization", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: person.cookie },
      body: JSON.stringify({ organization_id: targetOrg.organizationId }),
    })
    expect(ok.status).toBe(200)

    const me = await harness.app.request("/v1/me", { headers: { cookie: person.cookie } })
    const meBody = (await me.json()) as { readonly organization: { readonly id: string } }
    expect(meBody.organization.id).toBe(targetOrg.organizationId)

    const key = await createTestApiKey(harness.auth, targetOrg.organizationId, targetOrg.userId, [
      "manage",
    ])
    const byKey = await harness.app.request("/v1/me/active-organization", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ organization_id: targetOrg.organizationId }),
    })
    expect(byKey.status).toBe(403)
  })

  it("organizations_create makes the caller owner and the new org active; refuses an API key", async () => {
    const person = await signUpTestUser(harness.app, "Creator")
    const initialMe = await harness.app.request("/v1/me", { headers: { cookie: person.cookie } })
    const personalOrgId = (
      (await initialMe.json()) as { readonly organization: { readonly id: string } }
    ).organization.id
    cleanupOrgIds.push(personalOrgId)

    const res = await harness.app.request("/v1/organizations", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: person.cookie },
      body: JSON.stringify({ name: "Brand New Org" }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      readonly id: string
      readonly role: string
      readonly is_active: boolean
    }
    expect(body.role).toBe("owner")
    expect(body.is_active).toBe(true)
    cleanupOrgIds.push(body.id)

    const me = await harness.app.request("/v1/me", { headers: { cookie: person.cookie } })
    const meBody = (await me.json()) as { readonly organization: { readonly id: string } }
    expect(meBody.organization.id).toBe(body.id)

    const seeded = await seedOrganization(harness.db, "Key Holder Org")
    cleanupOrgIds.push(seeded.organizationId)
    const key = await createTestApiKey(harness.auth, seeded.organizationId, seeded.userId, [
      "manage",
    ])
    const forbidden = await harness.app.request("/v1/organizations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ name: "Should Not Work" }),
    })
    expect(forbidden.status).toBe(403)
  })

  it("organizations_update_active validates and persists the workspace timezone for an owner", async () => {
    const owner = await signUpTestUser(harness.app, "Timezone Owner")
    const me = await harness.app.request("/v1/me", { headers: { cookie: owner.cookie } })
    const organizationId = ((await me.json()) as { readonly organization: { readonly id: string } })
      .organization.id
    cleanupOrgIds.push(organizationId)

    const invalid = await harness.app.request("/v1/organizations/active", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ timezone: "Not/A_Real_Zone" }),
    })
    expect(invalid.status).toBe(422)

    const updated = await harness.app.request("/v1/organizations/active", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ timezone: "Asia/Dhaka" }),
    })
    expect(updated.status).toBe(200)
    expect(await updated.json()).toEqual({ timezone: "Asia/Dhaka" })

    const [settings] = await harness.db
      .select({ timezone: organizationSettings.timezone })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1)
    expect(settings?.timezone).toBe("Asia/Dhaka")
  })

  it("organizations_update_active refuses a plain member", async () => {
    const target = await seedOrganization(harness.db, "Timezone Target")
    cleanupOrgIds.push(target.organizationId)
    const member = await signUpTestUser(harness.app, "Timezone Member")
    const personalMe = await harness.app.request("/v1/me", { headers: { cookie: member.cookie } })
    const personalOrganizationId = (
      (await personalMe.json()) as { readonly organization: { readonly id: string } }
    ).organization.id
    cleanupOrgIds.push(personalOrganizationId)
    await addMember(harness.db, target.organizationId, member.userId, "member")
    await setActiveOrganizationForTest(harness.auth, member.cookie, target.organizationId)

    const response = await harness.app.request("/v1/organizations/active", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: member.cookie },
      body: JSON.stringify({ timezone: "Asia/Dhaka" }),
    })
    expect(response.status).toBe(403)
  })

  it("org settings update (Better Auth's own organization.update) is owner/admin by default — a plain member is refused", async () => {
    // Job L: "existing routes get the check where it's cheap — org settings → owner/admin."
    // Settings → Workspace name calls `authClient.organization.update` directly
    // (apps/web/src/routes/_app/settings/index.tsx), which hits Better Auth's own
    // `/organization/update` endpoint. Better Auth's default role statements already give
    // `member` an empty `organization: []` permission set (see the organization plugin's
    // access/statement.ts) — this test pins that default so a future change can't silently
    // let a plain member rename the org.
    const seeded = await seedOrganization(harness.db, "Settings Org")
    cleanupOrgIds.push(seeded.organizationId)

    const member = await signUpTestUser(harness.app, "Settings Member")
    const memberPersonalOrgId = (
      (await (
        await harness.app.request("/v1/me", { headers: { cookie: member.cookie } })
      ).json()) as {
        readonly organization: { readonly id: string }
      }
    ).organization.id
    cleanupOrgIds.push(memberPersonalOrgId)
    await addMember(harness.db, seeded.organizationId, member.userId, "member")
    await setActiveOrganizationForTest(harness.auth, member.cookie, seeded.organizationId)

    const forbidden = await harness.app.request("/api/auth/organization/update", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: member.cookie },
      body: JSON.stringify({
        organizationId: seeded.organizationId,
        data: { name: "Renamed By Member" },
      }),
    })
    expect(forbidden.status).toBe(403)

    const owner = await signUpTestUser(harness.app, "Settings Owner")
    const ownerPersonalOrgId = (
      (await (
        await harness.app.request("/v1/me", { headers: { cookie: owner.cookie } })
      ).json()) as {
        readonly organization: { readonly id: string }
      }
    ).organization.id
    cleanupOrgIds.push(ownerPersonalOrgId)
    await addMember(harness.db, seeded.organizationId, owner.userId, "owner")
    await setActiveOrganizationForTest(harness.auth, owner.cookie, seeded.organizationId)

    const ok = await harness.app.request("/api/auth/organization/update", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({
        organizationId: seeded.organizationId,
        data: { name: "Renamed By Owner" },
      }),
    })
    expect(ok.status).toBeLessThan(300)
  })
})
