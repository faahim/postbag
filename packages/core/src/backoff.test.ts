import { describe, expect, it } from "vitest"

import { maxAttemptsFor, nextAttemptAt } from "./backoff.js"

describe("delivery backoff", () => {
  it("applies bounded exponential delay with injected jitter", () => {
    const now = new Date("2026-08-21T00:00:00.000Z")

    expect(nextAttemptAt(2, now, {}, () => 0.5)).toEqual(new Date("2026-08-21T00:02:00.000Z"))
    expect(nextAttemptAt(30, now, {}, () => 0.5)).toEqual(new Date("2026-08-21T06:00:00.000Z"))
  })

  it("uses destination-specific retry budgets", () => {
    expect(maxAttemptsFor("email")).toBe(8)
    expect(maxAttemptsFor("webhook")).toBe(10)
    expect(maxAttemptsFor("telegram")).toBe(8)
    expect(maxAttemptsFor("discord")).toBe(8)
  })
})
