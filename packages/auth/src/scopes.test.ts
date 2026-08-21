import { describe, expect, it } from "vitest"

import { PostbagError } from "@postbag/core"

import { expandScopes, hasScope, requireScope } from "./scopes.js"

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

  it("implies manage ⊇ read ⊇ submit", () => {
    expect(expandScopes(["manage"])).toEqual(["manage", "read", "submit"])
    expect(expandScopes(["read"])).toEqual(["read", "submit"])
    expect(expandScopes(["submit"])).toEqual(["submit"])
    expect(expandScopes(["read", "manage"])).toEqual(["manage", "read", "submit"])
  })

  it("a manage-only key satisfies requireScope('read') and requireScope('submit')", () => {
    const key = { metadata: { scopes: ["manage"] } }

    expect(hasScope(key, "read")).toBe(true)
    expect(hasScope(key, "submit")).toBe(true)
    expect(() => requireScope(key, "read")).not.toThrow()
    expect(() => requireScope(key, "submit")).not.toThrow()
  })

  it("a read-only key does not satisfy requireScope('manage')", () => {
    const key = { metadata: { scopes: ["read"] } }

    expect(hasScope(key, "submit")).toBe(true)
    expect(hasScope(key, "manage")).toBe(false)
  })
})
