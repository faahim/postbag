import { afterEach, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { user } from "@postbag/db"

import { buildHarness, TEST_DATABASE_URL, type TestHarness } from "../../testUtils.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

integration("GET /v1/auth/providers", () => {
  let harness: TestHarness | undefined

  afterEach(async () => {
    await harness?.close()
    harness = undefined
  })

  it("is reachable with no credentials at all and lists no social providers when none are configured", async () => {
    harness = buildHarness()
    const response = await harness.app.request("/v1/auth/providers")
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("public, max-age=60")
    const body = (await response.json()) as {
      email_password: { sign_in: boolean; sign_up: boolean }
      email_code: { sign_in: boolean; sign_up: boolean }
      social: string[]
      sign_in_url: string
    }
    expect(body).toEqual({
      email_password: { sign_in: true, sign_up: true },
      email_code: { sign_in: false, sign_up: false },
      social: [],
      sign_in_url: `${harness.env.APP_URL}/app/sign-in`,
    })
  })

  it("lists both providers, in order, once both are configured", async () => {
    harness = buildHarness({
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
      GITHUB_CLIENT_ID: "github-id",
      GITHUB_CLIENT_SECRET: "github-secret",
    })
    const response = await harness.app.request("/v1/auth/providers")
    expect(response.status).toBe(200)
    const body = (await response.json()) as { social: string[] }
    expect(body.social).toEqual(["google", "github"])
  })

  it("lists only Google when only Google is configured", async () => {
    harness = buildHarness({ GOOGLE_CLIENT_ID: "google-id", GOOGLE_CLIENT_SECRET: "google-secret" })
    const response = await harness.app.request("/v1/auth/providers")
    const body = (await response.json()) as { social: string[] }
    expect(body.social).toEqual(["google"])
  })

  it("reports hosted signup separately and disables it server-side while password sign-in remains", async () => {
    const local = buildHarness()
    const email = `hosted-capability-${globalThis.crypto.randomUUID()}@example.test`
    try {
      const existing = await local.app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password: "correct horse battery staple",
          name: "Existing user",
        }),
      })
      expect(existing.status).toBe(200)

      harness = buildHarness({
        APP_URL: "https://postbag.dev",
        GOOGLE_CLIENT_ID: "google-id",
        GOOGLE_CLIENT_SECRET: "google-secret",
      })
      const providers = await harness.app.request("/v1/auth/providers")
      expect(await providers.json()).toMatchObject({
        email_password: { sign_in: true, sign_up: false },
        social: ["google"],
      })

      const rejectedSignup = await harness.app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://postbag.dev" },
        body: JSON.stringify({
          email: `new-${email}`,
          password: "correct horse battery staple",
          name: "New password user",
        }),
      })
      expect(rejectedSignup.status).toBeGreaterThanOrEqual(400)

      const signIn = await harness.app.request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://postbag.dev" },
        body: JSON.stringify({ email, password: "correct horse battery staple" }),
      })
      expect(signIn.status).toBe(200)
    } finally {
      await local.db.delete(user).where(eq(user.email, email))
      await local.close()
    }
  })
})
