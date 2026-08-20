import { describe, expect, it } from "vitest"

import { PostbagError } from "./errors.js"
import { detectDrift, inferSchema, validateAgainstSchema } from "./schema.js"

const contactSchema = {
  type: "object",
  required: ["email", "age"],
  properties: {
    email: { type: "string", format: "email" },
    age: { type: "number" },
  },
  additionalProperties: false,
} as const

describe("JSON Schema", () => {
  it("returns all validation problems", () => {
    const result = validateAgainstSchema({ email: "bad", age: "old", extra: true }, contactSchema)

    expect(result.valid).toBe(false)
    expect(result.problems.length).toBeGreaterThanOrEqual(3)
  })

  it("detects new, missing, and changed fields", () => {
    const drift = detectDrift({ email: 42, nickname: "Ada" }, contactSchema)

    expect(drift.map((finding) => finding.kind).sort()).toEqual([
      "missing_field",
      "new_field",
      "type_change",
    ])
  })

  it("infers deterministic schema and useful widgets", () => {
    const samples = [
      { email: "a@example.com", phone: "+46700000000", message: "x".repeat(140), active: true },
      { active: false, message: "hello", phone: "+4680000000", email: "b@example.com" },
    ]

    const first = inferSchema(samples)
    const second = inferSchema([...samples].reverse())

    expect(first).toEqual(second)
    expect(first.ui["email"]?.widget).toBe("email")
    expect(first.ui["phone"]?.widget).toBe("tel")
    expect(first.ui["message"]?.widget).toBe("textarea")
    expect(first.jsonSchema["required"]).toEqual(["active", "email", "message", "phone"])
  })

  it("detects nested drift and accepts integers for number fields", () => {
    const schema = {
      type: "object",
      properties: {
        profile: {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string" }, score: { type: "number" } },
        },
      },
    }

    expect(detectDrift({ profile: { score: 3, extra: true } }, schema)).toEqual([
      { kind: "new_field", field: "profile.extra", details: { actual_type: "boolean" } },
      { kind: "missing_field", field: "profile.name", details: {} },
    ])
  })

  it("rejects remote references before compilation", () => {
    expect(() =>
      validateAgainstSchema({}, { $ref: "https://example.test/remote-schema.json" }),
    ).toThrow(PostbagError)
  })

  it("infers arrays, numbers, dates, and URL-compatible text deterministically", () => {
    const inferred = inferSchema([
      {
        count: 2,
        birthday: "2026-08-21",
        website: "https://postbag.dev",
        tags: ["one"],
        optional: null,
      },
      {
        count: 3,
        birthday: "2026-08-22",
        website: "https://example.test",
        tags: ["two"],
        optional: null,
      },
    ])

    expect(inferred.ui["count"]?.widget).toBe("number")
    expect(inferred.ui["birthday"]?.widget).toBe("date")
    expect(inferred.ui["website"]?.widget).toBe("text")
    expect(inferred.ui["optional"]?.widget).toBe("text")
    expect(inferred.jsonSchema["properties"]).toMatchObject({
      tags: { type: "array", items: { type: "string" } },
    })
  })
})
