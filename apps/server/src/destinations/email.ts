import { renderTemplate } from "@postbag/core"
import { Resend } from "resend"
import { z } from "zod"

import {
  templateContext,
  type AttachmentLink,
  type DestinationAdapter,
  type DigestSubmission,
  type Payload,
} from "./types.js"

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

function attachmentHtml(attachments: readonly AttachmentLink[]): string {
  if (attachments.length === 0) return ""
  const links = attachments
    .map(
      (attachment) =>
        `<li><a href="${escapeHtml(attachment.download_url)}">${escapeHtml(attachment.filename)}</a> (${String(attachment.size_bytes)} bytes)</li>`,
    )
    .join("")
  return `<h3 style="margin:16px 0 8px">Attachments</h3><ul>${links}</ul>`
}

function attachmentText(attachments: readonly AttachmentLink[]): string[] {
  return attachments.map(
    (attachment) =>
      `${attachment.filename} (${String(attachment.size_bytes)} bytes): ${attachment.download_url}`,
  )
}

function htmlBody(
  formSlug: string,
  payload: Payload,
  attachments: readonly AttachmentLink[],
): string {
  const rows = fieldRows(payload)
    .map(
      (row) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;white-space:nowrap"><strong>${escapeHtml(row.key)}</strong></td><td style="padding:4px 0">${escapeHtml(row.value)}</td></tr>`,
    )
    .join("")
  return `<div><h2 style="margin:0 0 12px">New submission — ${escapeHtml(formSlug)}</h2><table cellpadding="0" cellspacing="0">${rows}</table>${attachmentHtml(attachments)}</div>`
}

function textBody(
  formSlug: string,
  payload: Payload,
  attachments: readonly AttachmentLink[],
): string {
  const lines = fieldRows(payload).map((row) => `${row.key}: ${row.value}`)
  return [
    `New submission — ${formSlug}`,
    "",
    ...lines,
    ...(attachments.length === 0 ? [] : ["", "Attachments", ...attachmentText(attachments)]),
  ].join("\n")
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

function digestHtmlBody(displayName: string, submissions: readonly DigestSubmission[]): string {
  const sections = submissions
    .map((submission) => {
      const rows = fieldRows(submission.data)
        .map(
          (row) =>
            `<tr><td style="padding:2px 12px 2px 0;color:#666;vertical-align:top;white-space:nowrap"><strong>${escapeHtml(row.key)}</strong></td><td style="padding:2px 0">${escapeHtml(row.value)}</td></tr>`,
        )
        .join("")
      const attachmentRows = submission.attachments
        .map(
          (attachment) =>
            `<a href="${escapeHtml(attachment.download_url)}">${escapeHtml(attachment.filename)}</a>`,
        )
        .join(", ")
      return `<tr><td colspan="2" style="padding:12px 0 4px;border-top:1px solid #eee;color:#999;font-size:12px">${escapeHtml(submission.received_at)}</td></tr>${rows}${attachmentRows.length === 0 ? "" : `<tr><td style="padding:2px 12px 2px 0;color:#666"><strong>attachments</strong></td><td>${attachmentRows}</td></tr>`}`
    })
    .join("")
  return `<div><h2 style="margin:0 0 12px">Digest — ${String(submissions.length)} submission(s) — ${escapeHtml(displayName)}</h2><table cellpadding="0" cellspacing="0">${sections}</table></div>`
}

function digestTextBody(displayName: string, submissions: readonly DigestSubmission[]): string {
  const sections = submissions.flatMap((submission) => [
    "",
    `— ${submission.received_at} —`,
    ...fieldRows(submission.data).map((row) => `${row.key}: ${row.value}`),
    ...attachmentText(submission.attachments),
  ])
  return [
    `Digest — ${String(submissions.length)} submission(s) — ${displayName}`,
    ...sections,
  ].join("\n")
}

export function createEmailAdapter(
  options: CreateEmailAdapterOptions,
): DestinationAdapter<EmailConfig> {
  const client = options.apiKey === undefined ? null : new Resend(options.apiKey)

  const deliver: DestinationAdapter<EmailConfig>["deliver"] = async (config, payload, ctx) => {
    const start = Date.now()
    if (client === null) {
      return {
        ok: false,
        status_code: null,
        latency_ms: 0,
        error: "RESEND_API_KEY is not configured.",
      }
    }
    const displayName = ctx.form?.name ?? ctx.stream?.name ?? "submission"
    const subject = renderTemplate(config.subject_template, templateContext(ctx, payload))
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
        html: htmlBody(displayName, payload, ctx.attachments),
        text: textBody(displayName, payload, ctx.attachments),
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

  const deliverDigest: DestinationAdapter<EmailConfig>["deliverDigest"] = async (
    config,
    submissions,
    ctx,
  ) => {
    const start = Date.now()
    if (client === null) {
      return {
        ok: false,
        status_code: null,
        latency_ms: 0,
        error: "RESEND_API_KEY is not configured.",
      }
    }
    const displayName = ctx.form?.name ?? ctx.stream?.name ?? "submission"
    const from =
      config.from_name === undefined
        ? options.mailFrom
        : `${config.from_name} <${extractAddress(options.mailFrom)}>`
    try {
      const result = await client.emails.send({
        from,
        to: [...config.to],
        subject: `Digest: ${String(submissions.length)} new submission(s) for ${displayName}`,
        html: digestHtmlBody(displayName, submissions),
        text: digestTextBody(displayName, submissions),
        ...(config.cc.length > 0 ? { cc: [...config.cc] } : {}),
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
        form: { id: "fm_test", name: "Test", slug: "test" },
        project: null,
        stream: null,
        submission: null,
        extras: {},
        meta: {},
        attachments: [],
      }),
    deliver,
    deliverDigest,
  }
}
