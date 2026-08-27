import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/queries/forms", () => ({ useFormSchema: vi.fn() }))
vi.mock("@/lib/queries/submissions", () => ({ useFormSubmissions: vi.fn() }))

import { observedFieldNames } from "./form-fields"

describe("observedFieldNames", () => {
  it("unions field names across every recent Submission", () => {
    expect(
      observedFieldNames([
        { data: { email: "ada@example.com", name: "Ada" } },
        { data: { company: "Postbag", email: "grace@example.com" } },
      ]),
    ).toEqual(["email", "name", "company"])
  })
})
