import { describe, expect, it } from "vitest"

import { formLabel } from "./submissions-table"

describe("formLabel", () => {
  it("keeps the Form id visible when the workspace name lookup is incomplete", () => {
    expect(formLabel("fm_later", { fm_first: "First Form" })).toBe("fm_later")
    expect(formLabel("fm_first", { fm_first: "First Form" })).toBe("First Form")
  })

  it("omits the redundant label on a single Form detail page", () => {
    expect(formLabel("fm_current", undefined)).toBeUndefined()
  })
})
