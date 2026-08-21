import { describe, expect, it } from "vitest"

import { loadEnv } from "./env.js"

const BASE = {
  DATABASE_URL: "postgres://postbag:postbag@localhost:5433/postbag",
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "devsecretdevsecretdevsecret1234",
}

describe("loadEnv — social login (job G)", () => {
  it("with neither Google nor GitHub set, both are absent and boot succeeds", () => {
    const env = loadEnv(BASE)
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined()
    expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined()
    expect(env.GITHUB_CLIENT_ID).toBeUndefined()
    expect(env.GITHUB_CLIENT_SECRET).toBeUndefined()
  })

  it("with a full Google pair and a full GitHub pair, both load", () => {
    const env = loadEnv({
      ...BASE,
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
      GITHUB_CLIENT_ID: "github-id",
      GITHUB_CLIENT_SECRET: "github-secret",
    })
    expect(env.GOOGLE_CLIENT_ID).toBe("google-id")
    expect(env.GOOGLE_CLIENT_SECRET).toBe("google-secret")
    expect(env.GITHUB_CLIENT_ID).toBe("github-id")
    expect(env.GITHUB_CLIENT_SECRET).toBe("github-secret")
  })

  it("rejects a Google id with no secret, naming the missing variable", () => {
    expect(() => loadEnv({ ...BASE, GOOGLE_CLIENT_ID: "google-id" })).toThrow(/GOOGLE_CLIENT_SECRET/)
  })

  it("rejects a Google secret with no id, naming the missing variable", () => {
    expect(() => loadEnv({ ...BASE, GOOGLE_CLIENT_SECRET: "google-secret" })).toThrow(/GOOGLE_CLIENT_ID/)
  })

  it("rejects a GitHub id with no secret, naming the missing variable", () => {
    expect(() => loadEnv({ ...BASE, GITHUB_CLIENT_ID: "github-id" })).toThrow(/GITHUB_CLIENT_SECRET/)
  })

  it("rejects a GitHub secret with no id, naming the missing variable", () => {
    expect(() => loadEnv({ ...BASE, GITHUB_CLIENT_SECRET: "github-secret" })).toThrow(/GITHUB_CLIENT_ID/)
  })
})
