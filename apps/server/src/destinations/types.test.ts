import { renderTemplate } from "@postbag/core"
import { describe, expect, it } from "vitest"

import { templateContext, type DeliveryContext } from "./types.js"

const baseCtx: DeliveryContext = {
  deliveryId: "dl_test",
  eventType: "submission.received",
  schemaVersion: null,
  form: { id: "fm_abc", name: "Overnight smoke test", slug: "overnight-smoke-test" },
  project: { id: "prj_abc", name: "Default", slug: "default" },
  stream: null,
  submission: { id: "sb_abc", received_at: "2026-08-21T09:00:00.000Z" },
  extras: {},
  meta: { ip: "203.0.113.9" },
  attachments: [],
}

describe("templateContext", () => {
  it("carries form, project, stream, submission, data, extras and meta", () => {
    const ctx = templateContext(baseCtx, { email: "ada@example.com" })
    expect(ctx).toEqual({
      form: baseCtx.form,
      project: baseCtx.project,
      stream: null,
      submission: baseCtx.submission,
      data: { email: "ada@example.com" },
      extras: {},
      meta: { ip: "203.0.113.9" },
      attachments: [],
    })
  })

  // Job D 1b regression: the default subject_template rendered the form *slug* because
  // the context only ever carried `{ name: slug, slug }`. With the real name in context,
  // {{form.name}} must render the human name, not the slug.
  it("renders {{form.name}} as the real form name, not the slug", () => {
    const subject = renderTemplate("New submission: {{form.name}}", templateContext(baseCtx, {}))
    expect(subject).toBe("New submission: Overnight smoke test")
  })

  it("falls back to the stream name when there is no form", () => {
    const ctx: DeliveryContext = {
      ...baseCtx,
      form: null,
      stream: { id: "st_abc", name: "Vending leads", slug: "vending-leads" },
    }
    const subject = renderTemplate(
      "{{#if form}}{{form.name}}{{/if}}{{#if stream}}{{stream.name}}{{/if}}",
      templateContext(ctx, {}),
    )
    expect(subject).toBe("Vending leads")
  })
})
