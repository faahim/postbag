import { describe, expect, it } from "vitest"

import { buildEditedSchema, editableFieldsFromSchema, isEditableFieldName, retainUiHints, schemaFromKnownFields } from "./schema-editing"

describe("dashboard schema editing", () => {
  it("seeds a Stream with published Form property constraints intact", () => {
    const seeded = schemaFromKnownFields(
      ["age", "email", "observed"],
      ["email"],
      {
        age: { type: "integer", minimum: 0 },
        email: { type: "string", format: "email" },
      },
    )

    expect(seeded["properties"]).toEqual({
      age: { type: "integer", minimum: 0 },
      email: { type: "string", format: "email" },
      observed: { type: "string" },
    })
    expect(buildEditedSchema(editableFieldsFromSchema(seeded, undefined), seeded)["properties"]).toEqual(seeded["properties"])
  })

  it("replaces editable fields without dropping advanced top-level constraints", () => {
    const previous = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      title: "Lead",
      properties: { email: { type: "string", format: "email" } },
      required: ["email"],
      $defs: { country: { enum: ["SE", "BD"] } },
      allOf: [{ if: { required: ["company"] }, then: { required: ["vat"] } }],
      patternProperties: { "^meta_": { type: "string" } },
      dependentRequired: { company: ["vat"] },
      unevaluatedProperties: false,
      additionalProperties: false,
    }

    const next = buildEditedSchema(
      [
        { name: "email", type: "string", required: true, original: previous.properties.email },
        { name: "company", type: "string", required: false },
      ],
      previous,
    )

    expect(next).toMatchObject({
      title: "Lead",
      $defs: previous.$defs,
      allOf: previous.allOf,
      patternProperties: previous.patternProperties,
      dependentRequired: previous.dependentRequired,
      unevaluatedProperties: false,
      additionalProperties: false,
      properties: {
        email: { type: "string", format: "email" },
        company: { type: "string" },
      },
      required: ["email"],
    })
  })

  it("keeps UI hints for retained fields and their published order", () => {
    const schema = {
      properties: {
        email: { type: "string" },
        company: { type: "string" },
      },
      required: ["email"],
    }
    const ui = {
      email: { label: "Work email", order: 2 },
      company: { label: "Company", order: 1 },
      removed: { label: "Old field", order: 3 },
    }
    const fields = editableFieldsFromSchema(schema, ui)

    expect(fields.map((field) => field.name)).toEqual(["company", "email"])
    expect(retainUiHints(ui, fields)).toEqual({
      email: ui.email,
      company: ui.company,
    })
  })

  it("does not invent UI hints when a Schema has none", () => {
    expect(retainUiHints(undefined, [{ name: "email" }])).toBeUndefined()
  })

  it("reserves dotted names for nested mapping paths", () => {
    expect(isEditableFieldName("contact.email")).toBe(false)
    expect(isEditableFieldName("contact_email")).toBe(true)
    expect(isEditableFieldName("contact-email")).toBe(true)
    expect(isEditableFieldName("_metadata")).toBe(true)
  })
})
