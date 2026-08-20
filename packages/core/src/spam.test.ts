import { describe, expect, it } from "vitest"

import { scoreSpam } from "./spam.js"

describe("scoreSpam", () => {
  it("assigns certainty to a filled honeypot without dropping the submission", () => {
    const result = scoreSpam({
      data: { email: "person@example.com" },
      control: { _gotcha: "bot" },
      meta: {},
      honeypotField: "_gotcha",
    })

    expect(result).toEqual({ score: 1, reasons: ["honeypot_filled"] })
  })

  it("combines deterministic content heuristics", () => {
    const result = scoreSpam({
      data: {
        email: "bot@mailinator.com",
        message: `BUY NOW ${"A".repeat(40)} https://a.test https://b.test`,
      },
      control: {},
      meta: {},
      honeypotField: "_gotcha",
    })

    expect(result.score).toBeGreaterThan(0.5)
    expect(result.reasons).toContain("disposable_email")
    expect(result.reasons).toContain("repeated_characters")
  })

  it("scores link density, excessive length, and all-caps content at fixed thresholds", () => {
    const result = scoreSpam({
      data: { message: `${"BUY".repeat(4_000)} https://a.test https://b.test` },
      control: {},
      meta: { ip: "192.0.2.1" },
      honeypotField: "trap",
    })

    expect(result.reasons).toContain("high_link_density")
    expect(result.reasons).toContain("excessive_length")
    expect(result.reasons).toContain("high_all_caps_ratio")
  })
})
