import { afterEach, describe, expect, it } from "vitest"

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
    const body = (await response.json()) as { email_password: boolean; social: string[]; sign_in_url: string }
    expect(body).toEqual({
      email_password: true,
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
})
