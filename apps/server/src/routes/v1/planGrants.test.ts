import { createHash } from "node:crypto"

import { newId } from "@postbag/core"
import { eq } from "drizzle-orm"
import { events, organization, organizationSettings, planGrants, user } from "@postbag/db"
import { afterEach, describe, expect, it } from "vitest"

import { buildHarness, createTestApiKey, seedOrganization, TEST_DATABASE_URL, type TestHarness } from "../../testUtils.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

function authed(key: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers)
  headers.set("authorization", `Bearer ${key}`)
  headers.set("content-type", "application/json")
  return { ...init, headers }
}

async function json(response: Response): Promise<unknown> {
  return response.json()
}

integration("POST/GET /v1/admin/plan-grants + POST /v1/plan/redeem (job K)", () => {
  let harness: TestHarness | undefined
  const orgIds: string[] = []

  afterEach(async () => {
    if (harness !== undefined) {
      for (const id of orgIds) {
        await harness.db.delete(organization).where(eq(organization.id, id))
      }
      await harness.close()
    }
    orgIds.length = 0
    harness = undefined
  })

  // PLATFORM_ADMIN_EMAILS is fixed at harness build time, but the admin's email is only
  // known after seeding the org that owns it — so seed with a throwaway harness first,
  // close it (this does not delete rows), then build the real harness against the same
  // Postgres with that email on (or off) the allowlist.
  async function setup(asAdmin: boolean) {
    const seedHarness = buildHarness()
    const adminOrg = await seedOrganization(seedHarness.db, "Admin Org")
    const targetOrg = await seedOrganization(seedHarness.db, "Target Org")
    const [adminUser] = await seedHarness.db.select({ email: user.email }).from(user).where(eq(user.id, adminOrg.userId)).limit(1)
    const adminEmail = adminUser?.email
    if (adminEmail === undefined) throw new Error("seeded admin user has no email")
    await seedHarness.close()

    const h = buildHarness({ PLATFORM_ADMIN_EMAILS: asAdmin ? [adminEmail] : [] })
    harness = h
    orgIds.push(adminOrg.organizationId, targetOrg.organizationId)
    const adminKey = await createTestApiKey(h.auth, adminOrg.organizationId, adminOrg.userId)
    const targetKey = await createTestApiKey(h.auth, targetOrg.organizationId, targetOrg.userId)
    return { h, adminOrg, targetOrg, adminEmail, adminKey, targetKey }
  }

  it("mint is 404 not_found when PLATFORM_ADMIN_EMAILS is empty (self-host default)", async () => {
    const { h, adminKey } = await setup(false)
    const response = await h.app.request(
      "/v1/admin/plan-grants",
      authed(adminKey, { method: "POST", body: JSON.stringify({ plan: "pro" }) }),
    )
    expect(response.status).toBe(404)
  })

  it("mint is 404 not_found for a key whose org owner is not on the allowlist", async () => {
    const { h, targetKey } = await setup(true)
    const response = await h.app.request(
      "/v1/admin/plan-grants",
      authed(targetKey, { method: "POST", body: JSON.stringify({ plan: "pro" }) }),
    )
    expect(response.status).toBe(404)
  })

  it("mints, lists (hash never returned) and revokes as the admin org's key", async () => {
    const { h, adminKey } = await setup(true)

    const minted = await h.app.request(
      "/v1/admin/plan-grants",
      authed(adminKey, {
        method: "POST",
        body: JSON.stringify({ plan: "pro", note: "friend", max_redemptions: 2, plan_duration_days: 30 }),
      }),
    )
    expect(minted.status).toBe(201)
    const mintedBody = (await json(minted)) as {
      id: string
      code: string
      plan: string
      note: string | null
      max_redemptions: number
      redeemed_count: number
      plan_duration_days: number | null
    }
    expect(mintedBody.code.length).toBeGreaterThanOrEqual(16)
    expect(mintedBody.plan).toBe("pro")
    expect(mintedBody.redeemed_count).toBe(0)
    expect(mintedBody.plan_duration_days).toBe(30)

    const listed = await h.app.request("/v1/admin/plan-grants", authed(adminKey))
    expect(listed.status).toBe(200)
    const listedBody = (await json(listed)) as Record<string, unknown>[]
    const found = listedBody.find((row) => row["id"] === mintedBody.id)
    expect(found).toBeDefined()
    expect(found?.["code"]).toBeUndefined()
    expect(found?.["code_hash"]).toBeUndefined()

    const revoked = await h.app.request(
      `/v1/admin/plan-grants/${mintedBody.id}/revoke`,
      authed(adminKey, { method: "POST" }),
    )
    expect(revoked.status).toBe(200)
    const revokedBody = (await json(revoked)) as { revoked_at: string | null }
    expect(revokedBody.revoked_at).not.toBeNull()

    // Idempotent: revoking again just returns the already-revoked grant.
    const revokedAgain = await h.app.request(
      `/v1/admin/plan-grants/${mintedBody.id}/revoke`,
      authed(adminKey, { method: "POST" }),
    )
    expect(revokedAgain.status).toBe(200)
  })

  it("redeem: happy path updates the org's plan and writes organization.plan.changed", async () => {
    const { h, adminKey, targetOrg, targetKey } = await setup(true)

    const minted = await h.app.request(
      "/v1/admin/plan-grants",
      authed(adminKey, { method: "POST", body: JSON.stringify({ plan: "pro", plan_duration_days: 7 }) }),
    )
    const { code } = (await json(minted)) as { code: string }

    const redeemed = await h.app.request(
      "/v1/plan/redeem",
      authed(targetKey, { method: "POST", body: JSON.stringify({ code }) }),
    )
    expect(redeemed.status).toBe(200)
    const body = (await json(redeemed)) as {
      plan: string
      plan_source: string
      plan_note: string | null
      plan_expires_at: string | null
    }
    expect(body.plan).toBe("pro")
    expect(body.plan_source).toBe("complimentary")
    expect(body.plan_note).toBe("Courtesy of Postbag")
    expect(body.plan_expires_at).not.toBeNull()

    const me = await h.app.request("/v1/me", authed(targetKey))
    const meBody = (await json(me)) as { organization: { plan: string; plan_source: string; plan_note: string | null } }
    expect(meBody.organization.plan).toBe("pro")
    expect(meBody.organization.plan_source).toBe("complimentary")
    expect(meBody.organization.plan_note).toBe("Courtesy of Postbag")

    const eventRows = await h.db
      .select()
      .from(events)
      .where(eq(events.organizationId, targetOrg.organizationId))
    expect(eventRows.some((row) => row.type === "organization.plan.changed")).toBe(true)
  })

  it("redeem: 404 grant_not_found for a bogus code", async () => {
    const { h, targetKey } = await setup(false)
    const response = await h.app.request(
      "/v1/plan/redeem",
      authed(targetKey, { method: "POST", body: JSON.stringify({ code: "not-a-real-code" }) }),
    )
    expect(response.status).toBe(404)
    expect(((await json(response)) as { error: { code: string } }).error.code).toBe("grant_not_found")
  })

  it("redeem: 410 grant_revoked", async () => {
    const { h, adminKey, targetKey } = await setup(true)
    const minted = await h.app.request(
      "/v1/admin/plan-grants",
      authed(adminKey, { method: "POST", body: JSON.stringify({ plan: "pro" }) }),
    )
    const { id, code } = (await json(minted)) as { id: string; code: string }
    await h.app.request(`/v1/admin/plan-grants/${id}/revoke`, authed(adminKey, { method: "POST" }))

    const response = await h.app.request(
      "/v1/plan/redeem",
      authed(targetKey, { method: "POST", body: JSON.stringify({ code }) }),
    )
    expect(response.status).toBe(410)
    expect(((await json(response)) as { error: { code: string } }).error.code).toBe("grant_revoked")
  })

  it("redeem: 410 grant_expired", async () => {
    const { h, adminOrg, targetKey } = await setup(false)
    const code = `expired-code-${newId("pg")}`
    await h.db.insert(planGrants).values({
      id: newId("pg"),
      codeHash: createHash("sha256").update(code, "utf8").digest("hex"),
      plan: "pro",
      createdByUserId: adminOrg.userId,
      expiresAt: new Date(Date.now() - 1000),
    })

    const response = await h.app.request(
      "/v1/plan/redeem",
      authed(targetKey, { method: "POST", body: JSON.stringify({ code }) }),
    )
    expect(response.status).toBe(410)
    expect(((await json(response)) as { error: { code: string } }).error.code).toBe("grant_expired")
  })

  it("redeem: 410 grant_exhausted after max_redemptions is reached", async () => {
    const { h, adminKey, targetKey, targetOrg } = await setup(true)
    const minted = await h.app.request(
      "/v1/admin/plan-grants",
      authed(adminKey, { method: "POST", body: JSON.stringify({ plan: "pro", max_redemptions: 1 }) }),
    )
    const { code } = (await json(minted)) as { code: string }

    const first = await h.app.request(
      "/v1/plan/redeem",
      authed(targetKey, { method: "POST", body: JSON.stringify({ code }) }),
    )
    expect(first.status).toBe(200)

    // Reset the org back to free so the second attempt fails on exhaustion, not plan_not_upgrade.
    await h.db
      .update(organizationSettings)
      .set({ plan: "free", planSource: "free" })
      .where(eq(organizationSettings.organizationId, targetOrg.organizationId))

    const second = await h.app.request(
      "/v1/plan/redeem",
      authed(targetKey, { method: "POST", body: JSON.stringify({ code }) }),
    )
    expect(second.status).toBe(410)
    expect(((await json(second)) as { error: { code: string } }).error.code).toBe("grant_exhausted")
  })

  it("redeem: 409 plan_is_billing for a paying org", async () => {
    const { h, adminKey, targetKey, targetOrg } = await setup(true)
    await h.db
      .update(organizationSettings)
      .set({ planSource: "billing" })
      .where(eq(organizationSettings.organizationId, targetOrg.organizationId))

    const minted = await h.app.request(
      "/v1/admin/plan-grants",
      authed(adminKey, { method: "POST", body: JSON.stringify({ plan: "pro" }) }),
    )
    const { code } = (await json(minted)) as { code: string }

    const response = await h.app.request(
      "/v1/plan/redeem",
      authed(targetKey, { method: "POST", body: JSON.stringify({ code }) }),
    )
    expect(response.status).toBe(409)
    expect(((await json(response)) as { error: { code: string } }).error.code).toBe("plan_is_billing")
  })

  it("redeem: 409 plan_not_upgrade when the code's plan is lower than the org's current plan", async () => {
    const { h, adminKey, targetKey, targetOrg } = await setup(true)
    await h.db
      .update(organizationSettings)
      .set({ plan: "team", planSource: "complimentary" })
      .where(eq(organizationSettings.organizationId, targetOrg.organizationId))

    const minted = await h.app.request(
      "/v1/admin/plan-grants",
      authed(adminKey, { method: "POST", body: JSON.stringify({ plan: "pro" }) }),
    )
    const { code } = (await json(minted)) as { code: string }

    const response = await h.app.request(
      "/v1/plan/redeem",
      authed(targetKey, { method: "POST", body: JSON.stringify({ code }) }),
    )
    expect(response.status).toBe(409)
    expect(((await json(response)) as { error: { code: string } }).error.code).toBe("plan_not_upgrade")
  })

  it("mint accepts a session whose user email is on the allowlist (not just an API key)", async () => {
    const captured: { email: string; otp: string }[] = []
    const h = buildHarness(
      { PLATFORM_ADMIN_EMAILS: [] },
      { sendEmailOTP: ({ email, otp }) => { captured.push({ email, otp }); return Promise.resolve() } },
    )
    harness = h
    const adminOrg = await seedOrganization(h.db, "Session Admin Org")
    orgIds.push(adminOrg.organizationId)
    const [adminUser] = await h.db.select({ email: user.email }).from(user).where(eq(user.id, adminOrg.userId)).limit(1)
    const email = adminUser?.email
    if (email === undefined) throw new Error("seeded admin user has no email")

    // Rebuild with the now-known email on the allowlist (env is fixed at harness build).
    await h.close()
    const h2 = buildHarness(
      { PLATFORM_ADMIN_EMAILS: [email] },
      { sendEmailOTP: ({ email: to, otp }) => { captured.push({ email: to, otp }); return Promise.resolve() } },
    )
    harness = h2

    await h2.auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } })
    const otp = captured.at(-1)?.otp
    expect(otp).toBeDefined()
    if (otp === undefined) throw new Error("no otp captured")

    const signInResponse = await h2.auth.api.signInEmailOTP({ body: { email, otp }, asResponse: true })
    const setCookie = signInResponse.headers.get("set-cookie")
    expect(setCookie).toBeTruthy()
    if (setCookie === null) throw new Error("no session cookie set")
    const cookie = setCookie.split(";")[0]

    const response = await h2.app.request("/v1/admin/plan-grants", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie ?? "" },
      body: JSON.stringify({ plan: "pro" }),
    })
    expect(response.status).toBe(201)
  })
})
