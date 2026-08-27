import { describe, expect, it } from "vitest"

import { resolveStreamSourcesForForm } from "./routing.js"

const form = {
  id: "frm_contact",
  organizationId: "org_example",
  projectId: "prj_site",
  tags: ["lead", "public"],
} as const

describe("resolveStreamSourcesForForm", () => {
  it("uses the newest matching selector for preview and delivery", () => {
    const oldest = { id: "src_old", streamId: "stm_leads", formId: null, selector: "tag:lead" }
    const newest = { id: "src_new", streamId: "stm_leads", formId: null, selector: "project:prj_site" }

    expect(resolveStreamSourcesForForm([oldest, newest], form).get("stm_leads")?.id).toBe("src_new")
  })

  it("gives a direct Form source precedence over matching selectors", () => {
    const direct = { id: "src_direct", streamId: "stm_leads", formId: form.id, selector: null }
    const selector = { id: "src_selector", streamId: "stm_leads", formId: null, selector: "tag:lead" }

    expect(resolveStreamSourcesForForm([direct, selector], form).get("stm_leads")?.id).toBe("src_direct")
  })
})
