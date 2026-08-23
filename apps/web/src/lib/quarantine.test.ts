import { describe, expect, it } from "vitest"

import { quarantineReasonDetail } from "./quarantine"

describe("quarantineReasonDetail", () => {
  it("turns a known machine reason into a legible explanation", () => {
    expect(quarantineReasonDetail("origin_rejected")).toEqual({
      label: "Origin not allowed",
      description: "The posting site's hostname or port did not match this Form's allowed origins.",
    })
  })

  it("keeps an unknown future reason visible", () => {
    expect(quarantineReasonDetail("new_policy").label).toBe("new policy")
  })
})
