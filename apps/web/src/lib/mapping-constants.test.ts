import { describe, expect, it } from "vitest"

import {
  formatMappingConstant,
  initialMappingConstant,
  mappingRuleWithConstant,
  mappingRuleWithSource,
  parseMappingConstant,
} from "@/lib/mapping-constants"

describe("mapping constants", () => {
  it("preserves strings without JSON coercion", () => {
    expect(parseMappingConstant("001", { type: "string" })).toEqual({ ok: true, value: "001" })
  })

  it("parses constants according to their target schema", () => {
    expect(parseMappingConstant("42", { type: "integer" })).toEqual({ ok: true, value: 42 })
    expect(parseMappingConstant("false", { type: "boolean" })).toEqual({ ok: true, value: false })
    expect(parseMappingConstant('{"team":"ops"}', { type: "object" })).toEqual({
      ok: true,
      value: { team: "ops" },
    })
  })

  it("rejects values that do not match the target schema", () => {
    expect(parseMappingConstant("4.2", { type: "integer" }).ok).toBe(false)
    expect(parseMappingConstant("yes", { type: "boolean" }).ok).toBe(false)
  })

  it("round-trips non-string drafts", () => {
    expect(formatMappingConstant(true)).toBe("true")
    expect(initialMappingConstant({ type: "array" })).toBe("[]")
  })

  it("keeps API-provided defaults while changing the source path", () => {
    expect(mappingRuleWithSource({ from: "old.email", default: "unknown" }, "contact.email")).toEqual({
      from: "contact.email",
      default: "unknown",
    })
  })

  it("removes a source path when switching to a fixed value", () => {
    expect(mappingRuleWithConstant({ from: "count", default: 0 }, 12)).toEqual({ const: 12, default: 0 })
  })
})
