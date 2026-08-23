import { eq } from "drizzle-orm"
import { organization, user, type Database } from "@postbag/db"
import { afterEach, describe, expect, it } from "vitest"

import { buildHarness, seedOrganization, TEST_DATABASE_URL, type TestHarness } from "../../testUtils.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

type CapturedOtp = { readonly email: string; readonly otp: string }

/** A harness whose sendEmailOTP just records the OTP instead of hitting Resend. */
function harnessWithCapturingEmail(): { readonly harness: TestHarness; readonly captured: CapturedOtp[] } {
  const captured: CapturedOtp[] = []
  const harness = buildHarness(
    { RESEND_API_KEY: "test_resend_key" },
    {
      sendEmailOTP: ({ email, otp }) => {
        captured.push({ email, otp })
        return Promise.resolve()
      },
    },
  )
  return { harness, captured }
}

/** A harness whose sendEmailOTP fails like a dead mail provider would. */
function harnessWithFailingEmail(): TestHarness {
  return buildHarness(
    { RESEND_API_KEY: "test_resend_key" },
    { sendEmailOTP: () => Promise.reject(new Error("Unable to fetch data. The request could not be resolved.")) },
  )
}

async function requestJson(harness: TestHarness, path: string, body: unknown) {
  const response = await harness.app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = (await response.json().catch(() => undefined)) as unknown
  return { response, json }
}

integration("POST /v1/auth/request-code + /v1/auth/verify-code", () => {
  let harness: TestHarness | undefined
  let db: Database | undefined
  const cleanupEmails: string[] = []
  const cleanupOrgIds: string[] = []

  afterEach(async () => {
    if (db !== undefined) {
      for (const organizationId of cleanupOrgIds) {
        await db.delete(organization).where(eq(organization.id, organizationId))
      }
      for (const email of cleanupEmails) {
        await db.delete(user).where(eq(user.email, email))
      }
    }
    cleanupOrgIds.length = 0
    cleanupEmails.length = 0
    await harness?.close()
    harness = undefined
    db = undefined
  })

  it("full flow: request → captured OTP → verify → key works against /v1/me; new email gets a provisioned org", async () => {
    const { harness: h, captured } = harnessWithCapturingEmail()
    harness = h
    db = h.db
    const email = "new-agent-user@example.test"
    cleanupEmails.push(email)

    const requested = await requestJson(h, "/v1/auth/request-code", { email })
    expect(requested.response.status).toBe(200)
    expect(requested.json).toEqual({
      ok: true,
      expires_in: 600,
      next: "POST /v1/auth/verify-code with { email, code, key_name }",
    })
    expect(captured).toHaveLength(1)
    expect(captured[0]?.email).toBe(email)
    const otp = captured[0]?.otp
    expect(otp).toMatch(/^\d{6}$/)

    const verified = await requestJson(h, "/v1/auth/verify-code", { email, code: otp })
    expect(verified.response.status).toBe(201)
    const body = verified.json as {
      api_key: string
      key_id: string
      scopes: string[]
      organization: { id: string; slug: string; name: string }
      user: { email: string; created: boolean }
      next: string[]
    }
    expect(body.api_key.startsWith("pb_live_")).toBe(true)
    expect(body.scopes).toEqual(["manage"])
    expect(body.user).toEqual({ email, created: true })
    expect(body.organization.id).toMatch(/^org_/)
    expect(body.next.length).toBeGreaterThan(0)
    cleanupOrgIds.push(body.organization.id)

    // No session cookie was set — this is a key-minting endpoint, not a browser login.
    expect(verified.response.headers.get("set-cookie")).toBeNull()

    const me = await h.app.request("/v1/me", { headers: { authorization: `Bearer ${body.api_key}` } })
    expect(me.status).toBe(200)
    const meBody = (await me.json()) as { organization: { id: string } }
    expect(meBody.organization.id).toBe(body.organization.id)
  })

  it("rejects an overlong key name before consuming the email code", async () => {
    const { harness: h, captured } = harnessWithCapturingEmail()
    harness = h
    db = h.db
    const email = "bounded-key-name@example.test"
    cleanupEmails.push(email)

    await requestJson(h, "/v1/auth/request-code", { email })
    const otp = captured[0]?.otp
    expect(otp).toMatch(/^\d{6}$/)

    const invalid = await requestJson(h, "/v1/auth/verify-code", {
      email,
      code: otp,
      key_name: "x".repeat(33),
    })
    expect(invalid.response.status).toBe(422)
    expect((invalid.json as { error: { code: string } }).error.code).toBe("validation_failed")

    const valid = await requestJson(h, "/v1/auth/verify-code", {
      email,
      code: otp,
      key_name: "launch-canary",
    })
    expect(valid.response.status).toBe(201)
    const validBody = valid.json as { organization: { id: string } }
    cleanupOrgIds.push(validBody.organization.id)
  })

  it("an existing user keeps their existing organization and created: false", async () => {
    const { harness: h, captured } = harnessWithCapturingEmail()
    harness = h
    db = h.db
    const seeded = await seedOrganization(h.db, "Existing Org")
    cleanupOrgIds.push(seeded.organizationId)
    const [existing] = await h.db.select({ email: user.email }).from(user).where(eq(user.id, seeded.userId)).limit(1)
    const email = existing?.email
    expect(email).toBeDefined()
    if (email === undefined) throw new Error("seeded user has no email")

    await requestJson(h, "/v1/auth/request-code", { email })
    const otp = captured[0]?.otp
    const verified = await requestJson(h, "/v1/auth/verify-code", { email, code: otp })
    expect(verified.response.status).toBe(201)
    const body = verified.json as { organization: { id: string }; user: { created: boolean } }
    expect(body.organization.id).toBe(seeded.organizationId)
    expect(body.user.created).toBe(false)
  })

  it("wrong code is 401 invalid_code, and the 4th attempt is rejected even with the right code", async () => {
    const { harness: h, captured } = harnessWithCapturingEmail()
    harness = h
    db = h.db
    const email = "wrong-code-user@example.test"
    cleanupEmails.push(email)

    await requestJson(h, "/v1/auth/request-code", { email })
    const correctOtp = captured[0]?.otp
    expect(correctOtp).toBeDefined()
    const wrongOtp = correctOtp === "000000" ? "111111" : "000000"

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { response, json } = await requestJson(h, "/v1/auth/verify-code", { email, code: wrongOtp })
      expect(response.status).toBe(401)
      expect((json as { error: { code: string } }).error.code).toBe("invalid_code")
    }

    // 4th attempt — allowedAttempts is 3, so this is rejected regardless of the code.
    const fourth = await requestJson(h, "/v1/auth/verify-code", { email, code: correctOtp })
    expect(fourth.response.status).toBe(401)
    expect((fourth.json as { error: { code: string } }).error.code).toBe("invalid_code")
  })

  it("rate limits at 3 requests per email per 10 minutes", async () => {
    const { harness: h } = harnessWithCapturingEmail()
    harness = h
    db = h.db
    const email = "rate-limited-user@example.test"
    cleanupEmails.push(email)

    for (let i = 0; i < 3; i += 1) {
      const { response } = await requestJson(h, "/v1/auth/request-code", { email })
      expect(response.status).toBe(200)
    }
    const fourth = await requestJson(h, "/v1/auth/request-code", { email })
    expect(fourth.response.status).toBe(429)
    expect((fourth.json as { error: { code: string } }).error.code).toBe("rate_limited")
  })

  it("returns 501 email_not_configured when RESEND_API_KEY is unset", async () => {
    harness = buildHarness()
    db = harness.db
    const { response, json } = await requestJson(harness, "/v1/auth/request-code", {
      email: "no-mailer@example.test",
    })
    expect(response.status).toBe(501)
    const body = json as { error: { code: string; hint?: string } }
    expect(body.error.code).toBe("email_not_configured")
    expect(body.error.hint).toContain("RESEND_API_KEY")
  })

  it("answers 502 email_send_failed when the code email cannot be sent (never a false 200)", async () => {
    const failing = harnessWithFailingEmail()
    try {
      const { response, json } = await requestJson(failing, "/v1/auth/request-code", {
        email: "otp-send-fails@example.com",
      })
      expect(response.status).toBe(502)
      expect((json as { error: { code: string; details?: { reason?: string } } }).error.code).toBe("email_send_failed")
      expect((json as { error: { details?: { reason?: string } } }).error.details?.reason).toContain("Unable to fetch data")
    } finally {
      await failing.close()
    }
  })
})
