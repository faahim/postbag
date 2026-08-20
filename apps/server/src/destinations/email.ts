import { renderTemplate } from "@postbag/core"
import { Resend } from "resend"
import { z } from "zod"

import type { DestinationAdapter, Payload } from "./types.js"

export const EmailConfigSchema = z.object({
  to: z.array(z.email()).min(1),
  cc: z.array(z.email()).default([]),
  subject_template: z.string().default("New submission: {{form.name}}"),
  from_name: z.string().optional(),
})
export type EmailConfig = z.infer<typeof EmailConfigSchema>

export type CreateEmailAdapterOptions = {
  readonly apiKey?: string | undefined
  readonly mailFrom: string
}

function fieldRows(payload: Payload): readonly { readonly key: string; readonly value: string }[] {
  return Object.entries(payload).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }))
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function htmlBody(formSlug: string, payload: Payload): string {
  const rows = fieldRows(payload)
    .map(
      (row) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;white-space:nowrap"><strong>${escapeHtml(row.key)}</strong></td><td style="padding:4px 0">${escapeHtml(row.value)}</td></tr>`,
    )
    .join("")
  return `<div><h2 style="margin:0 0 12px">New submission — ${escapeHtml(formSlug)}</h2><table cellpadding="0" cellspacing="0">${rows}</table></div>`
}

function textBody(formSlug: string, payload: Payload): string {
  const lines = fieldRows(payload).map((row) => `${row.key}: ${row.value}`)
  return [`New submission — ${formSlug}`, "", ...lines].join("\n")
}

function looksLikeEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)
}

function replyTo(payload: Payload, replyToField: string | null): string | undefined {
  if (replyToField !== null) {
    const explicit = payload[replyToField]
    if (looksLikeEmail(explicit)) return explicit
  }
  return Object.values(payload).find(looksLikeEmail)
}

function extractAddress(mailFrom: string): string {
  const match = /<([^>]+)>/u.exec(mailFrom)
  return match?.[1] ?? mailFrom
}

export function createEmailAdapter(
  options: CreateEmailAdapterOptions,
): DestinationAdapter<EmailConfig> {
  const client = options.apiKey === undefined ? null : new Resend(options.apiKey)

  const deliver: DestinationAdapter<EmailConfig>["deliver"] = async (config, payload, ctx) => {
    const start = Date.now()
    if (client === null) {
      return { ok: false, status_code: null, latency_ms: 0, error: "RESEND_API_KEY is not configured." }
    }
    const formSlug = ctx.form?.slug ?? ctx.stream?.slug ?? "submission"
    const subject = renderTemplate(config.subject_template, {
      form: { name: formSlug, slug: formSlug },
      data: payload,
    })
    const replyToField =
      typeof ctx.meta["reply_to_field"] === "string" ? ctx.meta["reply_to_field"] : null
    const from =
      config.from_name === undefined
        ? options.mailFrom
        : `${config.from_name} <${extractAddress(options.mailFrom)}>`
    try {
      const to = [...config.to]
      const cc = [...config.cc]
      const replyToAddress = replyTo(payload, replyToField)
      const result = await client.emails.send({
        from,
        to,
        subject,
        html: htmlBody(formSlug, payload),
        text: textBody(formSlug, payload),
        ...(cc.length > 0 ? { cc } : {}),
        ...(replyToAddress === undefined ? {} : { replyTo: replyToAddress }),
      })
      const latency_ms = Date.now() - start
      if (result.error !== null) {
        return { ok: false, status_code: null, latency_ms, error: result.error.message }
      }
      return { ok: true, status_code: 200, latency_ms, response_excerpt: result.data.id }
    } catch (error) {
      return {
        ok: false,
        status_code: null,
        latency_ms: Date.now() - start,
        error: error instanceof Error ? error.message : "Unknown email delivery error.",
      }
    }
  }

  return {
    type: "email",
    configSchema: EmailConfigSchema,
    redactConfig: (config) => ({ ...config }),
    test: (config, sample) =>
      deliver(config, sample, {
        deliveryId: "test",
        eventType: "submission.received",
        schemaVersion: null,
        form: { id: "fm_test", slug: "test" },
        stream: null,
        extras: {},
        meta: {},
      }),
    deliver,
  }
}
