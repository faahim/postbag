import { describe, expect, it } from "vitest"

import { formsForSources, formsWithoutDirectSource, selectorDescription, sourceMatchesForm } from "./stream-sources"

const forms = [
  { id: "fm_one", name: "One", project_id: "pr_a", tags: ["lead", "site"] },
  { id: "fm_two", name: "Two", project_id: "pr_b", tags: ["support"] },
]

describe("Stream selector sources", () => {
  it("matches direct, tag, and project sources", () => {
    expect(sourceMatchesForm({ form_id: "fm_two" }, { id: "fm_two", name: "Two", project_id: "pr_b", tags: ["support"] })).toBe(true)
    expect(sourceMatchesForm({ selector: "tag:lead" }, { id: "fm_one", name: "One", project_id: "pr_a", tags: ["lead", "site"] })).toBe(true)
    expect(sourceMatchesForm({ selector: "project:pr_a" }, { id: "fm_two", name: "Two", project_id: "pr_b", tags: ["support"] })).toBe(false)
  })

  it("deduplicates the Forms represented by several sources", () => {
    expect(formsForSources([{ form_id: "fm_one" }, { selector: "tag:lead" }], forms).map((form) => form.id)).toEqual(["fm_one"])
  })

  it("keeps selector-matched Forms available as direct overrides", () => {
    expect(formsWithoutDirectSource([{ selector: "tag:lead" }], forms).map((form) => form.id)).toEqual(["fm_one", "fm_two"])
    expect(formsWithoutDirectSource([{ form_id: "fm_one" }, { selector: "tag:lead" }], forms).map((form) => form.id)).toEqual(["fm_two"])
  })

  it("gives supported selectors a readable label", () => {
    expect(selectorDescription("tag:lead")).toBe("Forms tagged “lead”")
    expect(selectorDescription("project:pr_a")).toBe("Forms in project pr_a")
  })
})
