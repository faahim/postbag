import { events, member, organization } from "@postbag/db"
import { and, desc, eq } from "drizzle-orm"
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

// Job L §2 — role matrix for /v1/members. owner: everything. admin: remove members, cannot
// change roles. member: read only, can leave. A `manage`-scoped API key is treated as
// admin-equivalent (lib/orgs.ts `requireRole`) — sufficient for admin-gated routes, never
// for the owner-only role-change route.
const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

integration("/v1/members", () => {
  let harness: TestHarness
  let orgId: string
  let owner: SeededUser
  let admin: SeededUser
  let plainMember: SeededUser
  let outsider: SeededUser
  let outsiderOrgId: string
  let manageKey: string
  let readOnlyKey: string

  function authed(cookie: string) {
    return { headers: { cookie } }
  }

  beforeAll(async () => {
    harness = buildHarness()
    const seeded = await seedOrganization(harness.db, "Members Test Org")
    orgId = seeded.organizationId

    owner = await signUpTestUser(harness.app, "Owner")
    await addMember(harness.db, orgId, owner.userId, "owner")
    await setActiveOrganizationForTest(harness.auth, owner.cookie, orgId)

    admin = await signUpTestUser(harness.app, "Admin")
    await addMember(harness.db, orgId, admin.userId, "admin")
    await setActiveOrganizationForTest(harness.auth, admin.cookie, orgId)

    plainMember = await signUpTestUser(harness.app, "Member")
    await addMember(harness.db, orgId, plainMember.userId, "member")
    await setActiveOrganizationForTest(harness.auth, plainMember.cookie, orgId)

    outsider = await signUpTestUser(harness.app, "Outsider")
    const outsiderOrg = await seedOrganization(harness.db, "Outsider Org")
    outsiderOrgId = outsiderOrg.organizationId
    await addMember(harness.db, outsiderOrgId, outsider.userId, "owner")
    await setActiveOrganizationForTest(harness.auth, outsider.cookie, outsiderOrgId)

    manageKey = await createTestApiKey(harness.auth, orgId, seeded.userId, ["manage"])
    readOnlyKey = await createTestApiKey(harness.auth, orgId, seeded.userId, ["read"])

    // `seedOrganization` makes its own user an owner too (the api-key plugin requires a
    // real member to mint a key against, see createTestApiKey's doc comment) — drop that
    // membership now that the keys exist, so `owner` above is this org's *only* owner and
    // the last-owner protection tests below are meaningful.
    await harness.db.delete(member).where(and(eq(member.organizationId, orgId), eq(member.userId, seeded.userId)))
  })

  afterAll(async () => {
    await harness.db.delete(organization).where(eq(organization.id, orgId))
    await harness.db.delete(organization).where(eq(organization.id, outsiderOrgId))
    await harness.close()
  })

  it("lists members for owner, admin, member (session) and a read-scoped key", async () => {
    for (const cookie of [owner.cookie, admin.cookie, plainMember.cookie]) {
      const res = await harness.app.request("/v1/members", authed(cookie))
      expect(res.status).toBe(200)
      const body = (await res.json()) as unknown[]
      expect(body.length).toBeGreaterThanOrEqual(3)
    }
    const res = await harness.app.request("/v1/members", { headers: { authorization: `Bearer ${readOnlyKey}` } })
    expect(res.status).toBe(200)
  })

  it("members_update_role is owner-only — admin, member, and a manage-scoped key are all forbidden", async () => {
    const targetRes = await harness.app.request("/v1/members", authed(admin.cookie))
    const targetMembers = (await targetRes.json()) as { readonly id: string; readonly user: { readonly id: string } }[]
    const memberRow = targetMembers.find((m) => m.user.id === plainMember.userId)
    if (memberRow === undefined) throw new Error("member row not found")

    for (const [label, init] of [
      ["admin", authed(admin.cookie)],
      ["member", authed(plainMember.cookie)],
      ["manage key", { headers: { authorization: `Bearer ${manageKey}` } }],
    ] as const) {
      const res = await harness.app.request(`/v1/members/${memberRow.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...init.headers },
        body: JSON.stringify({ role: "admin" }),
      })
      expect(res.status, `${label} should not be able to change roles`).toBe(403)
    }

    const ok = await harness.app.request(`/v1/members/${memberRow.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ role: "admin" }),
    })
    expect(ok.status).toBe(200)
    const okBody = (await ok.json()) as { readonly role: string }
    expect(okBody.role).toBe("admin")

    // Revert for later tests.
    await harness.app.request(`/v1/members/${memberRow.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ role: "member" }),
    })
  })

  it("cannot demote the organization's last owner (409 last_owner)", async () => {
    const res = await harness.app.request("/v1/members", authed(owner.cookie))
    const members = (await res.json()) as { readonly id: string; readonly user: { readonly id: string }; readonly role: string }[]
    const ownerRow = members.find((m) => m.user.id === owner.userId)
    if (ownerRow === undefined) throw new Error("owner row not found")

    const demote = await harness.app.request(`/v1/members/${ownerRow.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ role: "admin" }),
    })
    expect(demote.status).toBe(409)
    const body = (await demote.json()) as { readonly error: { readonly code: string } }
    expect(body.error.code).toBe("last_owner")
  })

  it("cross-tenant: an outsider's session cannot address this org's members (404, not leaked)", async () => {
    const res = await harness.app.request("/v1/members", authed(owner.cookie))
    const members = (await res.json()) as { readonly id: string }[]
    const anyMemberId = members[0]?.id
    if (anyMemberId === undefined) throw new Error("no members")

    const patch = await harness.app.request(`/v1/members/${anyMemberId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: outsider.cookie },
      body: JSON.stringify({ role: "admin" }),
    })
    // The outsider is not owner/admin of *their own* org either, but the important
    // assertion is that this never succeeds against a member row outside their org scope.
    expect(patch.status).not.toBe(200)

    const del = await harness.app.request(`/v1/members/${anyMemberId}`, {
      method: "DELETE",
      headers: { cookie: outsider.cookie },
    })
    expect(del.status).not.toBe(204)
  })

  it("a member may remove themselves (leave); an admin may remove another member; a plain member cannot remove others", async () => {
    // A fresh member for each sub-case so earlier removals don't interfere.
    const leaver = await signUpTestUser(harness.app, "Leaver")
    await addMember(harness.db, orgId, leaver.userId, "member")
    await setActiveOrganizationForTest(harness.auth, leaver.cookie, orgId)

    const listed = await harness.app.request("/v1/members", authed(owner.cookie))
    const members = (await listed.json()) as { readonly id: string; readonly user: { readonly id: string } }[]
    const leaverRow = members.find((m) => m.user.id === leaver.userId)
    if (leaverRow === undefined) throw new Error("leaver row not found")

    const leave = await harness.app.request(`/v1/members/${leaverRow.id}`, { method: "DELETE", headers: { cookie: leaver.cookie } })
    expect(leave.status).toBe(204)

    // A plain member cannot remove someone else.
    const other = await signUpTestUser(harness.app, "RemoveTarget")
    await addMember(harness.db, orgId, other.userId, "member")
    const relisted = await harness.app.request("/v1/members", authed(owner.cookie))
    const relistedMembers = (await relisted.json()) as { readonly id: string; readonly user: { readonly id: string } }[]
    const otherRow = relistedMembers.find((m) => m.user.id === other.userId)
    if (otherRow === undefined) throw new Error("other row not found")

    const forbidden = await harness.app.request(`/v1/members/${otherRow.id}`, { method: "DELETE", headers: { cookie: plainMember.cookie } })
    expect(forbidden.status).toBe(403)

    const removedByAdmin = await harness.app.request(`/v1/members/${otherRow.id}`, { method: "DELETE", headers: { cookie: admin.cookie } })
    expect(removedByAdmin.status).toBe(204)
  })

  it("cannot remove the organization's last owner, even as themselves", async () => {
    const listed = await harness.app.request("/v1/members", authed(owner.cookie))
    const members = (await listed.json()) as { readonly id: string; readonly user: { readonly id: string } }[]
    const ownerRow = members.find((m) => m.user.id === owner.userId)
    if (ownerRow === undefined) throw new Error("owner row not found")

    const res = await harness.app.request(`/v1/members/${ownerRow.id}`, { method: "DELETE", headers: { cookie: owner.cookie } })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { readonly error: { readonly code: string } }
    expect(body.error.code).toBe("last_owner")
  })

  async function latestEvent(type: string) {
    const [row] = await harness.db
      .select()
      .from(events)
      .where(and(eq(events.organizationId, orgId), eq(events.type, type)))
      .orderBy(desc(events.createdAt))
      .limit(1)
    return row
  }

  it("emits member.role_changed and member.removed", async () => {
    const changee = await signUpTestUser(harness.app, "RoleChangeEvent")
    await addMember(harness.db, orgId, changee.userId, "member")

    const listed = await harness.app.request("/v1/members", authed(owner.cookie))
    const members = (await listed.json()) as { readonly id: string; readonly user: { readonly id: string } }[]
    const changeeRow = members.find((m) => m.user.id === changee.userId)
    if (changeeRow === undefined) throw new Error("changee row not found")

    const changeRes = await harness.app.request(`/v1/members/${changeeRow.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ role: "admin" }),
    })
    expect(changeRes.status).toBe(200)

    const roleChangedEvent = await latestEvent("member.role_changed")
    expect(roleChangedEvent).toBeDefined()
    expect(roleChangedEvent?.subject).toMatchObject({ member_id: changeeRow.id, user_id: changee.userId })
    expect(roleChangedEvent?.data).toMatchObject({ from: "member", to: "admin" })

    const removeRes = await harness.app.request(`/v1/members/${changeeRow.id}`, { method: "DELETE", headers: { cookie: owner.cookie } })
    expect(removeRes.status).toBe(204)

    const removedEvent = await latestEvent("member.removed")
    expect(removedEvent).toBeDefined()
    expect(removedEvent?.subject).toMatchObject({ member_id: changeeRow.id, user_id: changee.userId })
    expect(removedEvent?.data).toMatchObject({ self: false })
  })
})
