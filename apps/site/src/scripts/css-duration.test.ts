import { describe, expect, it } from "vitest"

import { parseCssDurationMs } from "./css-duration.js"

describe("parseCssDurationMs", () => {
  it("preserves millisecond tokens used in development", () => {
    expect(parseCssDurationMs("1600ms", 500)).toBe(1600)
  })

  it("converts second tokens emitted by production CSS minification", () => {
    expect(parseCssDurationMs("1.6s", 500)).toBe(1600)
    expect(parseCssDurationMs("2.4s", 500)).toBe(2400)
  })

  it("uses the fallback for missing or malformed tokens", () => {
    expect(parseCssDurationMs("", 1600)).toBe(1600)
    expect(parseCssDurationMs("slow", 1600)).toBe(1600)
  })
})
