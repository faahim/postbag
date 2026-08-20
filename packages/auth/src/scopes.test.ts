import { describe, expect, it } from "vitest"

import { PostbagError } from "@postbag/core"

import { hasScope, requireScope } from "./scopes.js"

describe("API key scopes", () => {
  it("reads scopes only from valid metadata", () => {
    const key = { metadata: { scopes: ["read", "submit"] } }

    expect(hasScope(key, "read")).toBe(true)
    expect(hasScope(key, "manage")).toBe(false)
  })

  it("fails closed when a required scope is absent", () => {
    expect(() => requireScope({ metadata: { scopes: ["read"] } }, "manage")).toThrow(PostbagError)
    expect(() => requireScope({ metadata: "invalid" }, "read")).toThrow(PostbagError)
  })
})
