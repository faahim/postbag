import { describe, expect, it } from "vitest"

import {
  formatMappingConstant,
  initialMappingConstant,
  isMappingSourcePathValid,
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
    expect(parseMappingConstant("pending", { type: "string", enum: ["open", "closed"] }).ok).toBe(false)
    expect(parseMappingConstant("not-an-email", { type: "string", format: "email" }).ok).toBe(false)
  })

  it("resolves local references from the complete Stream Schema", () => {
    const root = {
      $defs: { status: { type: "string", enum: ["open", "closed"] } },
      type: "object",
      properties: { status: { $ref: "#/$defs/status" } },
    }
    expect(parseMappingConstant("open", root.properties.status, root, "status")).toEqual({ ok: true, value: "open" })
    expect(parseMappingConstant("pending", root.properties.status, root, "status").ok).toBe(false)
  })

  it("keeps referenced string constants literal before trying JSON coercion", () => {
    const root = {
      $defs: {
        text: { type: "string" },
        count: { type: "integer" },
        enabled: { type: "boolean" },
        textOrCount: { type: ["string", "integer"] },
      },
      type: "object",
      properties: {
        leading: { $ref: "#/$defs/text" },
        wordTrue: { $ref: "#/$defs/text" },
        wordNull: { $ref: "#/$defs/text" },
        count: { $ref: "#/$defs/count" },
        enabled: { $ref: "#/$defs/enabled" },
        choice: { $ref: "#/$defs/textOrCount" },
      },
    }

    expect(parseMappingConstant("001", root.properties.leading, root, "leading")).toEqual({ ok: true, value: "001" })
    expect(parseMappingConstant("true", root.properties.wordTrue, root, "wordTrue")).toEqual({ ok: true, value: "true" })
    expect(parseMappingConstant("null", root.properties.wordNull, root, "wordNull")).toEqual({ ok: true, value: "null" })
    expect(parseMappingConstant("42", root.properties.count, root, "count")).toEqual({ ok: true, value: 42 })
    expect(parseMappingConstant("false", root.properties.enabled, root, "enabled")).toEqual({ ok: true, value: false })
    expect(parseMappingConstant("42", root.properties.choice, root, "choice")).toEqual({ ok: true, value: 42 })
    expect(parseMappingConstant("draft note", root.properties.choice, root, "choice")).toEqual({ ok: true, value: "draft note" })
  })

  it("resolves root-property references while validating only the selected field", () => {
    const root = {
      $id: "https://example.test/original-stream-schema",
      type: "object",
      required: ["base", "unrelated"],
      properties: {
        base: { type: "integer", minimum: 1 },
        alias: { $ref: "#/properties/base" },
        unrelated: { type: "string" },
      },
    }

    expect(parseMappingConstant("2", root.properties.alias, root, "alias")).toEqual({ ok: true, value: 2 })
    expect(parseMappingConstant("0", root.properties.alias, root, "alias").ok).toBe(false)
  })

  it("keeps local references inside nested Schema resources", () => {
    const root = {
      $id: "https://example.test/stream-schema",
      $defs: { value: { type: "integer" } },
      type: "object",
      properties: {
        nested: {
          $id: "nested-value",
          $defs: { value: { type: "string", minLength: 3 } },
          $ref: "#/$defs/value",
        },
      },
    }

    expect(parseMappingConstant("ready", root.properties.nested, root, "nested")).toEqual({ ok: true, value: "ready" })
    expect(parseMappingConstant("2", root.properties.nested, root, "nested").ok).toBe(false)
  })

  it("returns a validation result when a local reference cannot resolve", () => {
    const root = { type: "object", properties: { alias: { $ref: "#/properties/missing" } } }

    expect(parseMappingConstant("value", root.properties.alias, root, "alias")).toEqual({
      ok: false,
      message: "This field's Schema could not be resolved.",
    })
  })

  it("parses structured and union values before validating referenced constraints", () => {
    const root = { $defs: { settings: { type: "object", required: ["enabled"], properties: { enabled: { type: "boolean" } } } } }
    expect(parseMappingConstant('{"enabled":true}', { $ref: "#/$defs/settings" }, root)).toEqual({
      ok: true,
      value: { enabled: true },
    })
    expect(parseMappingConstant("42", { type: ["string", "integer"] })).toEqual({ ok: true, value: 42 })
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

  it("rejects empty selector source paths", () => {
    expect(isMappingSourcePathValid("")).toBe(false)
    expect(isMappingSourcePathValid("   ")).toBe(false)
    expect(isMappingSourcePathValid("contact.email")).toBe(true)
  })
})
