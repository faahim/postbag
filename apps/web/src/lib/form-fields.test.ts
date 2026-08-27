import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/queries/forms", () => ({ useFormSchema: vi.fn() }))
vi.mock("@/lib/queries/submissions", () => ({ useFormSubmissions: vi.fn() }))

import { observedFieldNames, observedPropertySchemas } from "./form-fields"

describe("observedFieldNames", () => {
  it("unions field names across every recent Submission", () => {
    expect(
      observedFieldNames([
        { data: { email: "ada@example.com", name: "Ada" } },
        { data: { company: "Postbag", email: "grace@example.com" } },
      ]),
    ).toEqual(["email", "name", "company"])
  })

  it("infers the observed Submission values that a Stream seed must accept", () => {
    const properties = observedPropertySchemas([
      {
        data: {
          amount: 12.5,
          active: true,
          tags: ["agent"],
          profile: { source: "site" },
          mixed: "unknown",
          nullable: null,
        },
      },
      {
        data: {
          amount: 8.25,
          active: false,
          tags: ["form"],
          profile: { source: "embed" },
          mixed: 3.5,
          nullable: "known",
        },
      },
    ])

    expect(properties).toMatchObject({
      amount: { type: "number" },
      active: { type: "boolean" },
      tags: { type: "array", items: { type: "string" } },
      profile: { type: "object", properties: { source: { type: "string" } } },
      mixed: { type: ["number", "string"] },
      nullable: { type: ["null", "string"] },
    })
  })
})
