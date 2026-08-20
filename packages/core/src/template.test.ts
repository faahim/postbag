import { describe, expect, it } from "vitest"

import { TemplateSyntaxError } from "./errors.js"
import { renderTemplate } from "./template.js"

describe("safe templates", () => {
  it("escapes values unless a triple-brace tag is explicit", () => {
    const result = renderTemplate("{{name}} {{{trusted}}}", {
      name: "<Ada>",
      trusted: "<strong>ok</strong>",
    })

    expect(result).toBe("&lt;Ada&gt; <strong>ok</strong>")
  })

  it("renders nested if and each blocks without executing code", () => {
    const result = renderTemplate("{{#if people}}{{#each people}}[{{name}}]{{/each}}{{/if}}", {
      people: [{ name: "Ada" }, { name: "Lin" }],
    })

    expect(result).toBe("[Ada][Lin]")
  })

  it("renders missing values and false blocks as empty", () => {
    expect(renderTemplate("A{{missing}}B{{#if no}}bad{{/if}}", {})).toBe("AB")
  })

  it("resolves parent context inside each blocks", () => {
    expect(
      renderTemplate("{{#each people}}{{team}}:{{this}};{{/each}}", {
        team: "Core",
        people: ["Ada", "Lin"],
      }),
    ).toBe("Core:Ada;Core:Lin;")
  })

  it("rejects unknown, mismatched, and unclosed blocks", () => {
    expect(() => renderTemplate("{{#unless value}}x{{/unless}}", {})).toThrow(TemplateSyntaxError)
    expect(() => renderTemplate("{{#if value}}x{{/each}}", {})).toThrow(TemplateSyntaxError)
    expect(() => renderTemplate("{{#each values}}x", { values: [] })).toThrow(TemplateSyntaxError)
  })
})
