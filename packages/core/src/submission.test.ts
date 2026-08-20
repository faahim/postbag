import { describe, expect, it } from "vitest"

import { PayloadTooLarge } from "./errors.js"
import { normalizeBody } from "./submission.js"

describe("normalizeBody", () => {
  it("separates control fields, trims strings, and builds arrays", () => {
    const input = {
      name: "  Ada  ",
      "interest[]": [" forms ", "routing"],
      "codes[1]": " B ",
      "codes[0]": " A ",
      _redirect: " /thanks ",
      _test: "true",
    }

    const normalized = normalizeBody(input, "application/x-www-form-urlencoded")

    expect(normalized).toEqual({
      data: { name: "Ada", interest: ["forms", "routing"], codes: ["A", "B"] },
      control: { _redirect: "/thanks", _test: "true" },
    })
  })

  it("rejects payloads beyond the depth boundary", () => {
    let value: unknown = "leaf"
    for (let index = 0; index < 14; index += 1) value = { nested: value }

    expect(() => normalizeBody({ value }, "application/json")).toThrow(PayloadTooLarge)
  })

  it("rejects non-objects and circular parsed values with the typed boundary error", () => {
    const circular: Record<string, unknown> = {}
    circular["self"] = circular

    expect(() => normalizeBody("not-an-object", "application/json")).toThrow(PayloadTooLarge)
    expect(() => normalizeBody(circular, "application/json")).toThrow(PayloadTooLarge)
  })

  it("collects repeated empty-bracket scalar fields in insertion order", () => {
    expect(
      normalizeBody({ "items[]": "first", "items[1]": "second" }, "multipart/form-data"),
    ).toEqual({ data: { items: ["first", "second"] }, control: {} })
  })

  it("counts stripped control fields toward the payload-size boundary", () => {
    expect(() => normalizeBody({ _subject: "x".repeat(1_000_001) }, "application/json")).toThrow(
      PayloadTooLarge,
    )
  })

  it("rejects more than one thousand top-level fields", () => {
    const fields = Object.fromEntries(
      Array.from({ length: 1_001 }, (_, index) => [`field_${index}`, index]),
    )
    expect(() => normalizeBody(fields, "application/json")).toThrow(PayloadTooLarge)
  })
})
