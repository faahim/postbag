import { describe, expect, it } from "vitest"

import { ExpressionsNotEnabled } from "./errors.js"
import { applyMapping, validateMapping } from "./mapping.js"

const streamSchema = {
  type: "object",
  required: ["name", "phone"],
  properties: { name: { type: "string" }, phone: { type: ["string", "null"] } },
} as const

describe("mapping", () => {
  it("maps dot paths, defaults, constants, and preserves extras", () => {
    const result = applyMapping(
      { person: { name: "Ada" }, company: "Postbag", unused: 7 },
      {
        name: { from: "person.name" },
        phone: { from: "person.phone", default: null },
        source: { const: "website" },
      },
      streamSchema,
    )

    expect(result.payload).toEqual({ name: "Ada", phone: null, source: "website" })
    expect(result.extras).toEqual({ company: "Postbag", unused: 7 })
    expect(result.problems).toEqual([])
  })

  it("keeps the expression seam closed", () => {
    expect(() => applyMapping({}, { name: { expr: "$name" } }, streamSchema)).toThrow(
      ExpressionsNotEnabled,
    )
  })

  it("reports required fields missing from a mapping", () => {
    expect(validateMapping({ name: { from: "full_name" } }, streamSchema)).toEqual({
      status: "incomplete",
      missing: ["phone"],
    })
  })

  it("validates constants, defaults, and form paths", () => {
    const formSchema = {
      type: "object",
      properties: { full_name: { type: "string" } },
    }

    expect(
      validateMapping(
        { name: { from: "full_name" }, phone: { default: null } },
        streamSchema,
        formSchema,
      ),
    ).toEqual({ status: "valid", missing: [] })
    expect(
      validateMapping(
        { name: { from: "unknown" }, phone: { const: "+46000" } },
        streamSchema,
        formSchema,
      ),
    ).toEqual({ status: "incomplete", missing: ["name"] })
  })
})
