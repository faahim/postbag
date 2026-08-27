import { describe, expect, it } from "vitest"

import { isCadenceComplete, isCadenceReady, modeFor } from "@/lib/cadence"

describe("digest cadence validation", () => {
  it("accepts instant delivery without a time", () => {
    expect(isCadenceComplete({ cadence: "instant", time: "", weekday: 1 })).toBe(true)
  })

  it("requires a complete 24-hour time for digests", () => {
    expect(isCadenceComplete({ cadence: "daily", time: "", weekday: 1 })).toBe(false)
    expect(isCadenceComplete({ cadence: "daily", time: "8:00", weekday: 1 })).toBe(false)
    expect(isCadenceComplete({ cadence: "daily", time: "23:59", weekday: 1 })).toBe(true)
    expect(() => modeFor({ cadence: "daily", time: "", weekday: 1 }, "UTC")).toThrow("complete digest time")
  })

  it("requires a real weekday for weekly digests", () => {
    expect(isCadenceComplete({ cadence: "weekly", time: "08:00", weekday: 7 })).toBe(false)
    expect(modeFor({ cadence: "weekly", time: "08:05", weekday: 1 }, "UTC")).toEqual({
      type: "digest",
      cron: "5 8 * * 1",
      timezone: "UTC",
    })
  })

  it("waits for the workspace timezone before enabling a digest", () => {
    expect(isCadenceReady({ cadence: "daily", time: "08:00", weekday: 1 }, undefined)).toBe(false)
    expect(isCadenceReady({ cadence: "daily", time: "08:00", weekday: 1 }, "Europe/Stockholm")).toBe(true)
    expect(isCadenceReady({ cadence: "instant", time: "", weekday: 1 }, undefined)).toBe(true)
  })
})
