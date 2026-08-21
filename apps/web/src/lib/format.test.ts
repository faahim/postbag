import { describe, expect, it } from "vitest"

import { formatCount, formatRelativeTime, splitPrefixedId } from "./format.js"

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-21T12:00:00.000Z")

  it("says 'just now' for very recent times", () => {
    expect(formatRelativeTime("2026-08-21T11:59:40.000Z", now)).toBe("just now")
  })

  it("formats minutes ago", () => {
    expect(formatRelativeTime("2026-08-21T11:55:00.000Z", now)).toBe("5 minutes ago")
  })

  it("formats future times", () => {
    expect(formatRelativeTime("2026-08-21T12:10:00.000Z", now)).toBe("in 10 minutes")
  })
})

describe("splitPrefixedId", () => {
  it("splits the prefix from the rest", () => {
    expect(splitPrefixedId("fm_8f3kq2")).toEqual({ prefix: "fm_", rest: "8f3kq2" })
  })

  it("returns the whole id as rest when there is no underscore", () => {
    expect(splitPrefixedId("noprefix")).toEqual({ prefix: "", rest: "noprefix" })
  })
})

describe("formatCount", () => {
  it("adds thousands separators", () => {
    expect(formatCount(12345)).toBe("12,345")
  })
})
