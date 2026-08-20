import { describe, expect, it } from "vitest"

import { ID_PREFIXES, newId, parseId } from "./ids.js"

describe("public ids", () => {
  it("creates a self-describing random id", () => {
    // Given a registered Form prefix
    // When a new id is generated
    const id = newId("fm")

    // Then it has the fixed, unambiguous shape
    expect(id).toMatch(/^fm_[23456789abcdefghjkmnpqrstuvwxyz]{12}$/)
  })

  it("parses every registered prefix", () => {
    // Given every public-id prefix
    // When a syntactically valid id is parsed
    // Then its prefix and value are returned
    for (const prefix of ID_PREFIXES) {
      expect(parseId(`${prefix}_23456789abcd`)).toEqual({ prefix, value: "23456789abcd" })
    }
  })

  it("rejects unknown and ambiguous ids", () => {
    expect(parseId("no_23456789abcd")).toBeNull()
    expect(parseId("fm_000000000000")).toBeNull()
    expect(parseId("fm23456789abcd")).toBeNull()
    expect(parseId("fm_2345")).toBeNull()
  })
})
