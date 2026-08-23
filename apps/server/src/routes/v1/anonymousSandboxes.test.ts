import { newId } from "@postbag/core"
import {
  anonymousSandboxes,
  anonymousSubmissions,
  deliveries,
  destinations,
  events,
  forms,
  organization,
  organizationSettings,
  routes,
  submissions,
  user,
  type Database,
} from "@postbag/db"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  buildHarness,
  createTestApiKey,
  seedOrganization,
  signUpTestUser,
  TEST_DATABASE_URL,
  type TestHarness,
} from "../../testUtils.js"
import { runAnonymousSandboxCleanup } from "../../worker/housekeeping.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

type CreatedSandbox = {
  readonly sandbox: { readonly id: string; readonly submit_url: string }
  readonly sandbox_token: string
  readonly claim_url: string
}

integration("anonymous claimable quickstart", () => {
  let harness: TestHarness
  let db: Database
  const otpByEmail = new Map<string, string>()

  beforeAll(() => {
    harness = buildHarness(
      { ANONYMOUS_QUICKSTART_ENABLED: true, RESEND_API_KEY: "test_resend_key" },
      {
        sendEmailOTP: ({ email, otp }) => {
          otpByEmail.set(email, otp)
          return Promise.resolve()
        },
      },
    )
    db = harness.db
  })

  afterAll(async () => {
    await db.delete(anonymousSandboxes)
    await harness.close()
  })

  async function createSandbox(
    body: { readonly name: string; readonly origin?: string; readonly claim_email?: string },
    key: string = globalThis.crypto.randomUUID(),
    extraHeaders: Readonly<Record<string, string>> = {},
  ): Promise<{
    readonly response: Response
    readonly body: CreatedSandbox | { readonly error: { readonly code: string } }
  }> {
    const response = await harness.app.request("/v1/public/sandboxes", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": key, ...extraHeaders },
      body: JSON.stringify(body),
    })
    return {
      response,
      body: (await response.json()) as
        CreatedSandbox | { readonly error: { readonly code: string } },
    }
  }

  function created(
    value: CreatedSandbox | { readonly error: { readonly code: string } },
  ): CreatedSandbox {
    if ("error" in value) throw new Error(`Expected sandbox creation, got ${value.error.code}`)
    return value
  }

  function withApiKey(apiKey: string, token: string): HeadersInit {
    return { authorization: `Bearer ${apiKey}`, "postbag-sandbox-token": token }
  }

  it("keeps the kill switch on creation only", async () => {
    const disabled = buildHarness({ ANONYMOUS_QUICKSTART_ENABLED: false })
    try {
      const response = await disabled.app.request("/v1/public/sandboxes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": globalThis.crypto.randomUUID(),
        },
        body: JSON.stringify({ name: "Disabled" }),
      })
      expect(response.status).toBe(503)
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
        "anonymous_quickstart_disabled",
      )
    } finally {
      await disabled.close()
    }
  })

  it("requires a canonical UUIDv4 and rejects extra provisioning fields", async () => {
    const invalidKey = await createSandbox({ name: "Bad key" }, "not-a-uuid")
    expect(invalidKey.response.status).toBe(422)
    expect("error" in invalidKey.body && invalidKey.body.error.code).toBe("validation_failed")

    const response = await harness.app.request("/v1/public/sandboxes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": globalThis.crypto.randomUUID(),
      },
      body: JSON.stringify({ name: "Too much", destination: { type: "email" } }),
    })
    expect(response.status).toBe(422)
  })

  it("replays the same encrypted token and conflicts on a changed body", async () => {
    const key = globalThis.crypto.randomUUID()
    const first = await createSandbox({ name: "Replay me" }, key)
    const replay = await createSandbox({ name: "Replay me" }, key)
    const conflict = await createSandbox({ name: "Changed" }, key)

    expect(first.response.status).toBe(201)
    expect(replay.response.status).toBe(201)
    expect(created(replay.body).sandbox_token).toBe(created(first.body).sandbox_token)
    expect(conflict.response.status).toBe(409)
    expect("error" in conflict.body && conflict.body.error.code).toBe("idempotency_conflict")

    const rows = await db
      .select()
      .from(anonymousSandboxes)
      .where(eq(anonymousSandboxes.id, created(first.body).sandbox.id))
    expect(rows).toHaveLength(1)
  })

  it("stores at most five concurrent Submissions and creates no outbound rows", async () => {
    const value = created((await createSandbox({ name: "Five only" })).body)
    const attempts = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        Promise.resolve().then(() =>
          harness.app.request(`/s/${value.sandbox.id}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ index }),
          }),
        ),
      ),
    )
    expect(attempts.filter((response) => response.status === 200)).toHaveLength(5)
    expect(attempts.filter((response) => response.status === 409)).toHaveLength(7)

    const stored = await db
      .select()
      .from(anonymousSubmissions)
      .where(eq(anonymousSubmissions.sandboxId, value.sandbox.id))
    expect(stored).toHaveLength(5)
    expect(
      await db
        .select()
        .from(deliveries)
        .where(eq(deliveries.submissionId, stored[0]?.id ?? "missing")),
    ).toHaveLength(0)
    expect(
      await db
        .select()
        .from(events)
        .where(eq(events.subject, { form_id: value.sandbox.id })),
    ).toHaveLength(0)

    const status = await harness.app.request(`/v1/public/sandboxes/${value.sandbox.id}`, {
      headers: { authorization: `Sandbox ${value.sandbox_token}` },
    })
    expect(status.status).toBe(200)
    const body = (await status.json()) as {
      accepted_count: number
      remaining: number
      submissions: unknown[]
    }
    expect(body).toMatchObject({ accepted_count: 5, remaining: 0 })
    expect(body.submissions).toHaveLength(5)
  })

  it("replays one anonymous Submission under a concurrent idempotency key", async () => {
    const value = created((await createSandbox({ name: "Submit retry" })).body)
    const key = globalThis.crypto.randomUUID()
    const attempts = await Promise.all(
      Array.from({ length: 4 }, () =>
        Promise.resolve().then(() =>
          harness.app.request(`/s/${value.sandbox.id}`, {
            method: "POST",
            headers: { "content-type": "application/json", "idempotency-key": key },
            body: JSON.stringify({ message: "same" }),
          }),
        ),
      ),
    )
    expect(attempts.map((response) => response.status)).toEqual([200, 200, 200, 200])
    const receipts = await Promise.all(
      attempts.map(
        (response) => response.json() as Promise<{ submission_id: string; idempotent?: boolean }>,
      ),
    )
    expect(new Set(receipts.map((receipt) => receipt.submission_id)).size).toBe(1)
    expect(receipts.filter((receipt) => receipt.idempotent === true)).toHaveLength(3)

    const [sandbox] = await db
      .select({ acceptedCount: anonymousSandboxes.acceptedCount })
      .from(anonymousSandboxes)
      .where(eq(anonymousSandboxes.id, value.sandbox.id))
    expect(sandbox?.acceptedCount).toBe(1)
  })

  it("rejects over-deep and over-size anonymous payloads without storing them", async () => {
    const value = created((await createSandbox({ name: "Bounded" })).body)
    const deep = await harness.app.request(`/s/${value.sandbox.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ a: { b: { c: { d: { e: true } } } } }),
    })
    expect(deep.status).toBe(413)
    const large = await harness.app.request(`/s/${value.sandbox.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "x".repeat(17 * 1024) }),
    })
    expect(large.status).toBe(413)
    expect(
      await db
        .select()
        .from(anonymousSubmissions)
        .where(eq(anonymousSubmissions.sandboxId, value.sandbox.id)),
    ).toHaveLength(0)
  })

  it("requires both the capability and an authenticated manage actor to claim", async () => {
    const value = created((await createSandbox({ name: "Two factors" })).body)
    const noAuth = await harness.app.request(`/v1/sandboxes/${value.sandbox.id}/claim`, {
      method: "POST",
      headers: { "postbag-sandbox-token": value.sandbox_token },
    })
    expect(noAuth.status).toBe(401)

    const org = await seedOrganization(db, "Read only claimant")
    try {
      const readKey = await createTestApiKey(harness.auth, org.organizationId, org.userId, ["read"])
      const noManage = await harness.app.request(`/v1/sandboxes/${value.sandbox.id}/claim`, {
        method: "POST",
        headers: withApiKey(readKey, value.sandbox_token),
      })
      expect(noManage.status).toBe(403)
    } finally {
      await db.delete(organization).where(eq(organization.id, org.organizationId))
    }
  })

  it("claims atomically, preserves ids/timestamps, and never routes old tests", async () => {
    const value = created(
      (await createSandbox({ name: "Claimed Form", origin: "https://example.com/path" })).body,
    )
    const submitted = await harness.app.request(`/s/${value.sandbox.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.com" },
      body: JSON.stringify({ email: "test@example.com" }),
    })
    const submittedBody = (await submitted.json()) as { submission_id: string }
    const [anonymousBefore] = await db
      .select()
      .from(anonymousSubmissions)
      .where(eq(anonymousSubmissions.id, submittedBody.submission_id))

    const org = await seedOrganization(db, "Claim target")
    try {
      const apiKey = await createTestApiKey(harness.auth, org.organizationId, org.userId)
      const first = await harness.app.request(`/v1/sandboxes/${value.sandbox.id}/claim`, {
        method: "POST",
        headers: withApiKey(apiKey, value.sandbox_token),
      })
      const second = await harness.app.request(`/v1/sandboxes/${value.sandbox.id}/claim`, {
        method: "POST",
        headers: withApiKey(apiKey, value.sandbox_token),
      })
      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expect((await second.json()) as { idempotent: boolean }).toMatchObject({ idempotent: true })

      const [claimedForm] = await db.select().from(forms).where(eq(forms.id, value.sandbox.id))
      const [copied] = await db
        .select()
        .from(submissions)
        .where(eq(submissions.id, submittedBody.submission_id))
      expect(claimedForm?.organizationId).toBe(org.organizationId)
      expect(claimedForm?.settings).toEqual({ allowed_origins: ["https://example.com"] })
      expect(copied).toMatchObject({ formId: value.sandbox.id, test: true })
      expect(copied?.receivedAt.toISOString()).toBe(anonymousBefore?.receivedAt.toISOString())
      expect(
        await db
          .select()
          .from(deliveries)
          .where(eq(deliveries.submissionId, copied?.id ?? "missing")),
      ).toHaveLength(0)

      const consumedRead = await harness.app.request(`/v1/public/sandboxes/${value.sandbox.id}`, {
        headers: { authorization: `Sandbox ${value.sandbox_token}` },
      })
      expect(consumedRead.status).toBe(410)
    } finally {
      await db.delete(organization).where(eq(organization.id, org.organizationId))
    }
  })

  it("leaves a capacity-blocked sandbox claimable", async () => {
    const value = created((await createSandbox({ name: "Capacity retry" })).body)
    const org = await seedOrganization(db, "Full target")
    try {
      await db
        .update(organizationSettings)
        .set({ limits: { forms: 0 } })
        .where(eq(organizationSettings.organizationId, org.organizationId))
      const apiKey = await createTestApiKey(harness.auth, org.organizationId, org.userId)
      const blocked = await harness.app.request(`/v1/sandboxes/${value.sandbox.id}/claim`, {
        method: "POST",
        headers: withApiKey(apiKey, value.sandbox_token),
      })
      expect(blocked.status).toBe(402)
      await db
        .update(organizationSettings)
        .set({ limits: { forms: 1 } })
        .where(eq(organizationSettings.organizationId, org.organizationId))
      const retried = await harness.app.request(`/v1/sandboxes/${value.sandbox.id}/claim`, {
        method: "POST",
        headers: withApiKey(apiKey, value.sandbox_token),
      })
      expect(retried.status).toBe(200)
    } finally {
      await db.delete(organization).where(eq(organization.id, org.organizationId))
    }
  })

  it("enforces a verified claim-email match for browser sessions", async () => {
    const claimant = await signUpTestUser(harness.app, "Claimant")
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, claimant.userId))

    const mismatch = created(
      (await createSandbox({ name: "Mismatch", claim_email: "other@example.com" })).body,
    )
    const denied = await harness.app.request(`/v1/sandboxes/${mismatch.sandbox.id}/claim`, {
      method: "POST",
      headers: { cookie: claimant.cookie, "postbag-sandbox-token": mismatch.sandbox_token },
    })
    expect(denied.status).toBe(403)
    expect(((await denied.json()) as { error: { code: string } }).error.code).toBe(
      "sandbox_claim_email_mismatch",
    )

    const matching = created(
      (await createSandbox({ name: "Matching", claim_email: claimant.email })).body,
    )
    const accepted = await harness.app.request(`/v1/sandboxes/${matching.sandbox.id}/claim`, {
      method: "POST",
      headers: { cookie: claimant.cookie, "postbag-sandbox-token": matching.sandbox_token },
    })
    expect(accepted.status).toBe(200)
  })

  it("email-code onboarding mints an identity-bound key that claims without a browser", async () => {
    const email = `${newId("usr")}@example.test`
    const value = created((await createSandbox({ name: "OTP claim", claim_email: email })).body)
    const requested = await harness.app.request("/v1/auth/request-code", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": `192.0.2.${String(otpByEmail.size + 10)}`,
      },
      body: JSON.stringify({ email }),
    })
    expect(requested.status).toBe(200)
    const otp = otpByEmail.get(email)
    expect(otp).toMatch(/^\d{6}$/u)
    const verified = await harness.app.request("/v1/auth/verify-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code: otp }),
    })
    expect(verified.status).toBe(201)
    const key = ((await verified.json()) as { api_key: string }).api_key
    const claim = await harness.app.request(`/v1/sandboxes/${value.sandbox.id}/claim`, {
      method: "POST",
      headers: withApiKey(key, value.sandbox_token),
    })
    expect(claim.status).toBe(200)
  })

  it("serializes submit-vs-claim and claim-vs-claim races", async () => {
    const value = created((await createSandbox({ name: "Race" })).body)
    const org = await seedOrganization(db, "Race target")
    try {
      const apiKey = await createTestApiKey(harness.auth, org.organizationId, org.userId)
      const [submitResponse, claimResponse] = await Promise.all([
        harness.app.request(`/s/${value.sandbox.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ race: true }),
        }),
        harness.app.request(`/v1/sandboxes/${value.sandbox.id}/claim`, {
          method: "POST",
          headers: withApiKey(apiKey, value.sandbox_token),
        }),
      ])
      expect(submitResponse.status).toBe(200)
      expect(claimResponse.status).toBe(200)
      const submitId = ((await submitResponse.json()) as { submission_id: string }).submission_id
      const [stored] = await db.select().from(submissions).where(eq(submissions.id, submitId))
      expect(stored?.formId).toBe(value.sandbox.id)

      const secondValue = created((await createSandbox({ name: "Double claim" })).body)
      const claims = await Promise.all(
        Array.from({ length: 2 }, () =>
          Promise.resolve().then(() =>
            harness.app.request(`/v1/sandboxes/${secondValue.sandbox.id}/claim`, {
              method: "POST",
              headers: withApiKey(apiKey, secondValue.sandbox_token),
            }),
          ),
        ),
      )
      expect(claims.map((response) => response.status)).toEqual([200, 200])
      const bodies = await Promise.all(
        claims.map((response) => response.json() as Promise<{ idempotent: boolean }>),
      )
      expect(bodies.map((body) => body.idempotent).sort()).toEqual([false, true])
      expect(
        await db.select().from(forms).where(eq(forms.id, secondValue.sandbox.id)),
      ).toHaveLength(1)
    } finally {
      await db.delete(organization).where(eq(organization.id, org.organizationId))
    }
  })

  it("deletes expired sandboxes and cascades their Submissions", async () => {
    const value = created((await createSandbox({ name: "Cleanup" })).body)
    await harness.app.request(`/s/${value.sandbox.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cleanup: true }),
    })
    await db
      .update(anonymousSandboxes)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(anonymousSandboxes.id, value.sandbox.id))

    const read = await harness.app.request(`/v1/public/sandboxes/${value.sandbox.id}`, {
      headers: { authorization: `Sandbox ${value.sandbox_token}` },
    })
    const submit = await harness.app.request(`/s/${value.sandbox.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ late: true }),
    })
    expect(read.status).toBe(410)
    expect(submit.status).toBe(410)

    await runAnonymousSandboxCleanup(db, harness.logger)
    expect(
      await db.select().from(anonymousSandboxes).where(eq(anonymousSandboxes.id, value.sandbox.id)),
    ).toHaveLength(0)
    expect(
      await db
        .select()
        .from(anonymousSubmissions)
        .where(eq(anonymousSubmissions.sandboxId, value.sandbox.id)),
    ).toHaveLength(0)
  })

  it("keeps pre-claim tests inert while new real Submissions can route", async () => {
    const value = created((await createSandbox({ name: "Route after claim" })).body)
    const oldResponse = await harness.app.request(`/s/${value.sandbox.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phase: "before" }),
    })
    const oldId = ((await oldResponse.json()) as { submission_id: string }).submission_id
    const org = await seedOrganization(db, "Delivery target")
    try {
      const apiKey = await createTestApiKey(harness.auth, org.organizationId, org.userId)
      await harness.app.request(`/v1/sandboxes/${value.sandbox.id}/claim`, {
        method: "POST",
        headers: withApiKey(apiKey, value.sandbox_token),
      })
      const destinationId = newId("ds")
      await db.insert(destinations).values({
        id: destinationId,
        organizationId: org.organizationId,
        type: "webhook",
        name: "Test webhook",
        config: { url: "https://example.com/hook", secret: "test", headers: {} },
        verified: true,
      })
      await db.insert(routes).values({
        id: newId("rt"),
        organizationId: org.organizationId,
        formId: value.sandbox.id,
        destinationId,
      })
      const current = await harness.app.request(`/s/${value.sandbox.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phase: "after" }),
      })
      const currentId = ((await current.json()) as { submission_id: string }).submission_id
      expect(
        await db.select().from(deliveries).where(eq(deliveries.submissionId, oldId)),
      ).toHaveLength(0)
      expect(
        await db.select().from(deliveries).where(eq(deliveries.submissionId, currentId)),
      ).toHaveLength(1)
    } finally {
      await db.delete(organization).where(eq(organization.id, org.organizationId))
    }
  })
})
