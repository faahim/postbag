import { describe, expect, it } from "vitest"

import {
  buildEditedSchema,
  editableFieldsFromSchema,
  hasUnsafeSchemaFieldRemoval,
  isEditableFieldName,
  retainUiHints,
  schemaFromKnownFields,
  UNSAFE_SCHEMA_FIELD_REMOVAL_MESSAGE,
} from "./schema-editing"

describe("dashboard schema editing", () => {
  it("seeds a Stream with published Form property constraints intact", () => {
    const seeded = schemaFromKnownFields(
      ["age", "email", "observed"],
      {
        properties: {
          age: { type: "integer", minimum: 0 },
          email: { type: "string", format: "email" },
        },
        required: ["email"],
      },
      {
        age: { type: "string" },
        email: { type: "boolean" },
        observed: { type: "boolean" },
      },
    )

    expect(seeded["properties"]).toEqual({
      age: { type: "integer", minimum: 0 },
      email: { type: "string", format: "email" },
      observed: { type: "boolean" },
    })
    expect(buildEditedSchema(editableFieldsFromSchema(seeded, undefined), seeded)["properties"]).toEqual(seeded["properties"])
  })

  it("carries definitions referenced by published Form properties", () => {
    const published = {
      $defs: { email: { type: "string", format: "email" } },
      properties: { email: { $ref: "#/$defs/email" } },
      required: ["email"],
      additionalProperties: false,
    }

    const seeded = schemaFromKnownFields(["email", "observed"], published)

    expect(seeded).toMatchObject({
      $defs: published.$defs,
      properties: { email: published.properties.email, observed: { type: "string" } },
      required: ["email"],
      additionalProperties: false,
    })
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

  it("blocks field removal when the published Schema has root cross-field constraints", () => {
    const fields = [
      { name: "company", type: "string" as const, required: true },
      { name: "email", type: "string" as const, required: true },
    ]
    const constraints = {
      dependentRequired: { company: ["vat"] },
      dependentSchemas: { company: { required: ["vat"] } },
      dependencies: { company: ["vat"] },
      allOf: [{ if: { required: ["company"] }, then: { required: ["vat"] } }],
      anyOf: [{ required: ["vat"] }],
      oneOf: [{ required: ["vat"] }],
      if: { required: ["company"] },
      then: { required: ["vat"] },
      else: { required: ["email"] },
      not: { required: ["vat"] },
      $ref: "#/$defs/cross-field-rule",
      $dynamicRef: "#cross-field-rule",
    }
    const base = {
      properties: {
        company: { type: "string" },
        vat: { type: "string" },
        email: { type: "string" },
      },
      $defs: { "cross-field-rule": { if: { required: ["company"] }, then: { required: ["vat"] } } },
    }

    for (const [keyword, constraint] of Object.entries(constraints)) {
      const previous = { ...base, [keyword]: constraint }
      expect(hasUnsafeSchemaFieldRemoval(fields, previous)).toBe(true)
      expect(() => buildEditedSchema(fields, previous)).toThrow(UNSAFE_SCHEMA_FIELD_REMOVAL_MESSAGE)
    }
  })

  it("allows removal when the published Schema has no root cross-field constraints", () => {
    const previous = {
      properties: { company: { type: "string" }, vat: { type: "string" } },
      required: ["company", "vat"],
      additionalProperties: false,
    }
    const fields = [{ name: "company", type: "string" as const, required: true }]

    expect(hasUnsafeSchemaFieldRemoval(fields, previous)).toBe(false)
    expect(buildEditedSchema(fields, previous)).toMatchObject({
      properties: { company: previous.properties.company },
      required: ["company"],
      additionalProperties: false,
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
