import { describe, expect, it } from "vitest"

import { timeZoneOptions } from "./timezones"

describe("timeZoneOptions", () => {
  it("always includes UTC and the current valid timezone without duplicates", () => {
    expect(timeZoneOptions(["Europe/Stockholm", "Asia/Dhaka"], "Etc/UTC")).toEqual([
      "UTC",
      "Etc/UTC",
      "Europe/Stockholm",
      "Asia/Dhaka",
    ])
    expect(timeZoneOptions(["UTC", "Europe/Stockholm"], "UTC")).toEqual(["UTC", "Europe/Stockholm"])
  })
})
