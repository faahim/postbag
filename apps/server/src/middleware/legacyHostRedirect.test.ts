import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { legacyHostRedirect } from "./legacyHostRedirect.js"

function buildApp(legacyHosts: readonly string[]): Hono {
  const app = new Hono()
  app.use("*", legacyHostRedirect(legacyHosts, "https://postbag.dev"))
  app.get("/pricing/", (c) => c.text("pricing"))
  app.get("/app/forms", (c) => c.text("forms"))
  app.get("/", (c) => c.text("home"))
  app.get("/s/fm_x", (c) => c.text("submit"))
  app.get("/v1/me", (c) => c.text("me"))
  app.get("/health", (c) => c.text("ok"))
  return app
}

describe("legacyHostRedirect", () => {
  it("301-redirects marketing/dashboard paths on a listed legacy host", async () => {
    const app = buildApp(["postbag.withfaahim.com"])
    for (const path of ["/pricing/", "/app/forms", "/"]) {
      const response = await app.request(path, { headers: { host: "postbag.withfaahim.com" } })
      expect(response.status).toBe(301)
      expect(response.headers.get("location")).toBe(`https://postbag.dev${path}`)
    }
  })

  it("never redirects /s/, /v1/ or /health, even on a legacy host", async () => {
    const app = buildApp(["postbag.withfaahim.com"])
    for (const path of ["/s/fm_x", "/v1/me", "/health"]) {
      const response = await app.request(path, { headers: { host: "postbag.withfaahim.com" } })
      expect(response.status).toBe(200)
    }
  })

  it("does not redirect when the host is not listed", async () => {
    const app = buildApp(["postbag.withfaahim.com"])
    const response = await app.request("/pricing/", { headers: { host: "postbag.dev" } })
    expect(response.status).toBe(200)
  })

  it("does not redirect when LEGACY_HOSTS is empty", async () => {
    const app = buildApp([])
    const response = await app.request("/pricing/", { headers: { host: "postbag.withfaahim.com" } })
    expect(response.status).toBe(200)
  })

  it("honours X-Forwarded-Host ahead of Host", async () => {
    const app = buildApp(["postbag.withfaahim.com"])
    const response = await app.request("/pricing/", {
      headers: { host: "internal-lb", "x-forwarded-host": "postbag.withfaahim.com" },
    })
    expect(response.status).toBe(301)
  })

  it("preserves the query string", async () => {
    const app = buildApp(["postbag.withfaahim.com"])
    const response = await app.request("/pricing/?ref=old", { headers: { host: "postbag.withfaahim.com" } })
    expect(response.status).toBe(301)
    expect(response.headers.get("location")).toBe("https://postbag.dev/pricing/?ref=old")
  })
})
