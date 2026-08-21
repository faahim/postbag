import { describe, expect, it } from "vitest"

import { DEFAULT_API_URL, resolveConfig } from "./config.js"

describe("resolveConfig", () => {
  it("defaults apiUrl to the hosted product", () => {
    const result = resolveConfig([], { POSTBAG_API_KEY: "pb_live_x" })
    expect(result).toEqual({ apiKey: "pb_live_x", apiUrl: DEFAULT_API_URL })
  })

  it("prefers argv flags over env vars", () => {
    const result = resolveConfig(["--api-key", "pb_live_flag", "--api-url", "http://localhost:3000"], {
      POSTBAG_API_KEY: "pb_live_env",
      POSTBAG_API_URL: "https://env.example",
    })
    expect(result).toEqual({ apiKey: "pb_live_flag", apiUrl: "http://localhost:3000" })
  })

  it("supports --flag=value form", () => {
    const result = resolveConfig(["--api-key=pb_live_eq"], {})
    expect(result).toEqual({ apiKey: "pb_live_eq", apiUrl: DEFAULT_API_URL })
  })

  it("errors with a clear message when no key is available", () => {
    const result = resolveConfig([], {})
    expect("error" in result).toBe(true)
    if ("error" in result) {
      expect(result.error).toContain("POSTBAG_API_KEY")
    }
  })
})
