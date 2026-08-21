import { newId } from "@postbag/core"
import { invitation, member, organization } from "@postbag/db"
import { and, eq } from "drizzle-orm"
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

// Job L §2 — invitations: owner/admin can invite/revoke (a manage-scoped API key is
// admin-equivalent), a plain member cannot; accepting is session-only and requires the
// signed-in email to match the invitation; the public lookup never requires credentials.
const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

integration("/v1/invitations", () => {
  let harness: TestHarness
  let orgId: string
  let orgName: string
  let owner: SeededUser
  let plainMember: SeededUser
  let manageKey: string
  const extraOrgIds: string[] = []

  /** Every `signUpTestUser` also provisions a personal org (real signup flow) — tracked here
   * so `afterAll` can clean those up too, not just the shared `orgId`. */
  async function trackPersonalOrg(cookie: string): Promise<void> {
    const me = await harness.app.request("/v1/me", { headers: { cookie } })
    const body = (await me.json()) as { readonly organization: { readonly id: string } }
    extraOrgIds.push(body.organization.id)
  }

  function authed(cookie: string) {
    return { headers: { cookie } }
  }

  beforeAll(async () => {
    harness = buildHarness()
    const seeded = await seedOrganization(harness.db, "Invitations Test Org")
    orgId = seeded.organizationId
    orgName = "Invitations Test Org"

    owner = await signUpTestUser(harness.app, "Owner")
    await addMember(harness.db, orgId, owner.userId, "owner")
    await setActiveOrganizationForTest(harness.auth, owner.cookie, orgId)

    plainMember = await signUpTestUser(harness.app, "Member")
    await addMember(harness.db, orgId, plainMember.userId, "member")
    await setActiveOrganizationForTest(harness.auth, plainMember.cookie, orgId)

    manageKey = await createTestApiKey(harness.auth, orgId, seeded.userId, ["manage"])
  })

  afterAll(async () => {
    await harness.db.delete(organization).where(eq(organization.id, orgId))
    for (const id of extraOrgIds) {
      await harness.db.delete(organization).where(eq(organization.id, id))
    }
    await harness.close()
  })

  it("a plain member cannot invite; owner and a manage-scoped key can", async () => {
    const forbidden = await harness.app.request("/v1/invitations", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: plainMember.cookie },
      body: JSON.stringify({ email: "nope@example.test", role: "member" }),
    })
    expect(forbidden.status).toBe(403)

    const byOwner = await harness.app.request("/v1/invitations", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ email: "invitee-owner@example.test", role: "member" }),
    })
    expect(byOwner.status).toBe(201)
    const byOwnerBody = (await byOwner.json()) as { readonly id: string; readonly invited_by: { readonly id: string } | null }
    expect(byOwnerBody.invited_by?.id).toBe(owner.userId)

    const byKey = await harness.app.request("/v1/invitations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${manageKey}` },
      body: JSON.stringify({ email: "invitee-key@example.test", role: "member" }),
    })
    expect(byKey.status).toBe(201)
    const byKeyBody = (await byKey.json()) as { readonly invited_by: unknown }
    // An API key has no backing user (migration 0005) — nothing to attribute the invite to.
    expect(byKeyBody.invited_by).toBeNull()
  })

  it("re-inviting a pending email resends (same id, not a duplicate)", async () => {
    const email = "resend-me@example.test"
    const first = await harness.app.request("/v1/invitations", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ email, role: "member" }),
    })
    const firstBody = (await first.json()) as { readonly id: string }

    const second = await harness.app.request("/v1/invitations", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ email, role: "admin" }),
    })
    expect(second.status).toBe(201)
    const secondBody = (await second.json()) as { readonly id: string; readonly role: string }
    expect(secondBody.id).toBe(firstBody.id)
    expect(secondBody.role).toBe("admin")

    const list = await harness.app.request("/v1/invitations", authed(owner.cookie))
    const rows = (await list.json()) as { readonly email: string }[]
    expect(rows.filter((r) => r.email === email)).toHaveLength(1)
  })

  it("cannot invite an email that already belongs to a member", async () => {
    const res = await harness.app.request("/v1/invitations", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ email: plainMember.email, role: "member" }),
    })
    expect(res.status).toBe(409)
  })

  it("invitations_revoke: member forbidden, owner ok, revoked invitation no longer lists as pending", async () => {
    const created = await harness.app.request("/v1/invitations", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ email: "to-revoke@example.test", role: "member" }),
    })
    const { id } = (await created.json()) as { readonly id: string }

    const forbidden = await harness.app.request(`/v1/invitations/${id}`, { method: "DELETE", headers: { cookie: plainMember.cookie } })
    expect(forbidden.status).toBe(403)

    const ok = await harness.app.request(`/v1/invitations/${id}`, { method: "DELETE", headers: { cookie: owner.cookie } })
    expect(ok.status).toBe(204)

    const list = await harness.app.request("/v1/invitations", authed(owner.cookie))
    const rows = (await list.json()) as { readonly id: string }[]
    expect(rows.some((r) => r.id === id)).toBe(false)
  })

  it("GET /v1/invitations/{id} is public and masks the email", async () => {
    const created = await harness.app.request("/v1/invitations", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ email: "public-lookup@example.test", role: "member" }),
    })
    const { id } = (await created.json()) as { readonly id: string }

    const res = await harness.app.request(`/v1/invitations/${id}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { readonly organization: { readonly name: string }; readonly email_hint: string }
    expect(body.organization.name).toBe(orgName)
    expect(body.email_hint).not.toBe("public-lookup@example.test")
    expect(body.email_hint).toContain("@example.test")
  })

  it("GET /v1/invitations/{unknown} is 404", async () => {
    const res = await harness.app.request("/v1/invitations/iv_doesnotexist00")
    expect(res.status).toBe(404)
  })

  it("accept: email mismatch is forbidden; matching email joins and sets the active org", async () => {
    const acceptEmail = `accept-me-${newId("usr")}@example.test`
    const created = await harness.app.request("/v1/invitations", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ email: acceptEmail, role: "admin" }),
    })
    const { id } = (await created.json()) as { readonly id: string }

    // A different signed-in user (email doesn't match the invitation) is refused.
    const stranger = await signUpTestUser(harness.app, "Stranger")
    await trackPersonalOrg(stranger.cookie)
    const mismatch = await harness.app.request(`/v1/invitations/${id}/accept`, { method: "POST", headers: { cookie: stranger.cookie } })
    expect(mismatch.status).toBe(403)
    const mismatchBody = (await mismatch.json()) as { readonly error: { readonly code: string } }
    expect(mismatchBody.error.code).toBe("invitation_email_mismatch")

    // An API key (no session) cannot accept at all.
    const byKey = await harness.app.request(`/v1/invitations/${id}/accept`, { method: "POST", headers: { authorization: `Bearer ${manageKey}` } })
    expect(byKey.status).toBe(403)

    // The invited user signs up with exactly that email and accepts.
    const email = acceptEmail
    const signUp = await harness.app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct horse battery staple", name: "Invitee" }),
    })
    expect(signUp.status).toBeLessThan(400)
    const cookie = signUp.headers.get("set-cookie")?.split(";")[0]
    if (cookie === undefined) throw new Error("no cookie")
    const signUpBody = (await signUp.json()) as { readonly user: { readonly id: string } }
    const inviteeUserId = signUpBody.user.id
    await trackPersonalOrg(cookie)

    const accept = await harness.app.request(`/v1/invitations/${id}/accept`, { method: "POST", headers: { cookie } })
    expect(accept.status).toBe(200)
    const acceptBody = (await accept.json()) as { readonly organization: { readonly id: string }; readonly role: string }
    expect(acceptBody.organization.id).toBe(orgId)
    expect(acceptBody.role).toBe("admin")

    // The invitee's own personal org from signup needs cleanup too.
    const me = await harness.app.request("/v1/me", { headers: { cookie } })
    const meBody = (await me.json()) as { readonly organization: { readonly id: string } }
    expect(meBody.organization.id).toBe(orgId)

    const [memberRow] = await harness.db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, inviteeUserId)))
      .limit(1)
    expect(memberRow?.role).toBe("admin")

    // Accepting again is a no-op error, not a duplicate membership.
    const again = await harness.app.request(`/v1/invitations/${id}/accept`, { method: "POST", headers: { cookie } })
    expect(again.status).toBe(409)
  })

  it("accept: an expired invitation is refused (410)", async () => {
    const expiredEmail = `expired-${newId("usr")}@example.test`
    const id = newId("iv")
    await harness.db.insert(invitation).values({
      id,
      organizationId: orgId,
      email: expiredEmail,
      role: "member",
      status: "pending",
      expiresAt: new Date(Date.now() - 1000),
      inviterId: owner.userId,
    })
    const signUp = await harness.app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: expiredEmail, password: "correct horse battery staple", name: "Late" }),
    })
    const cookie = signUp.headers.get("set-cookie")?.split(";")[0]
    if (cookie === undefined) throw new Error("no cookie")
    await trackPersonalOrg(cookie)

    const res = await harness.app.request(`/v1/invitations/${id}/accept`, { method: "POST", headers: { cookie } })
    expect(res.status).toBe(410)
  })
})
