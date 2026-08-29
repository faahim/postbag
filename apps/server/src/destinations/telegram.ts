import { renderTemplate } from "@postbag/core"
import { z } from "zod"

import {
  templateContext,
  type DestinationAdapter,
  type DigestSubmission,
  type Payload,
} from "./types.js"

export const TelegramConfigSchema = z.object({
  bot_token: z.string().min(1),
  chat_id: z.string().min(1),
  template: z.string().optional(),
})
export type TelegramConfig = z.infer<typeof TelegramConfigSchema>

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function defaultMessage(formSlug: string, payload: Payload): string {
  const lines = Object.entries(payload).map(([key, value]) => {
    const text = typeof value === "string" ? value : JSON.stringify(value)
    return `<b>${escapeHtml(key)}</b>: ${escapeHtml(text)}`
  })
  return [`<b>New submission — ${escapeHtml(formSlug)}</b>`, "", ...lines].join("\n")
}

/** A compact one-line-per-submission summary — the first couple of fields only, so a
 * digest of dozens of submissions stays a readable Telegram message. */
function summarizeFields(data: Payload, max = 3): string {
  return Object.entries(data)
    .slice(0, max)
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(", ")
}

function digestMessage(displayName: string, submissions: readonly DigestSubmission[]): string {
  const lines = submissions.map((submission, index) => {
    const links = submission.attachments
      .map(
        (attachment) =>
          `<a href="${escapeHtml(attachment.download_url)}">${escapeHtml(attachment.filename)}</a>`,
      )
      .join(", ")
    return `${String(index + 1)}. ${escapeHtml(submission.received_at)} — ${escapeHtml(summarizeFields(submission.data))}${links.length === 0 ? "" : ` — ${links}`}`
  })
  return [
    `<b>Digest — ${String(submissions.length)} submission(s) — ${escapeHtml(displayName)}</b>`,
    "",
    ...lines,
  ].join("\n")
}

export function createTelegramAdapter(): DestinationAdapter<TelegramConfig> {
  const deliver: DestinationAdapter<TelegramConfig>["deliver"] = async (config, payload, ctx) => {
    const start = Date.now()
    const displayName = ctx.form?.name ?? ctx.stream?.name ?? "submission"
    const text =
      config.template === undefined
        ? defaultMessage(displayName, payload)
        : renderTemplate(config.template, templateContext(ctx, payload))
    const attachmentLines = ctx.attachments.map(
      (attachment) =>
        `<a href="${escapeHtml(attachment.download_url)}">${escapeHtml(attachment.filename)}</a> (${String(attachment.size_bytes)} bytes)`,
    )
    const message =
      attachmentLines.length === 0
        ? text
        : `${text}\n\n<b>Attachments</b>\n${attachmentLines.join("\n")}`
    try {
      const response = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: config.chat_id, text: message, parse_mode: "HTML" }),
        signal: AbortSignal.timeout(10_000),
      })
      const latency_ms = Date.now() - start
      const bodyText = await response.text()
      if (response.ok) {
        return {
          ok: true,
          status_code: response.status,
          latency_ms,
          response_excerpt: bodyText.slice(0, 500),
        }
      }
      return {
        ok: false,
        status_code: response.status,
        latency_ms,
        error: bodyText.slice(0, 500),
        response_excerpt: bodyText.slice(0, 500),
      }
    } catch (error) {
      return {
        ok: false,
        status_code: null,
        latency_ms: Date.now() - start,
        error: error instanceof Error ? error.message : "Unknown Telegram delivery error.",
      }
    }
  }

  const deliverDigest: DestinationAdapter<TelegramConfig>["deliverDigest"] = async (
    config,
    submissions,
    ctx,
  ) => {
    const start = Date.now()
    const displayName = ctx.form?.name ?? ctx.stream?.name ?? "submission"
    const text = digestMessage(displayName, submissions)
    try {
      const response = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: config.chat_id, text, parse_mode: "HTML" }),
        signal: AbortSignal.timeout(10_000),
      })
      const latency_ms = Date.now() - start
      const bodyText = await response.text()
      if (response.ok) {
        return {
          ok: true,
          status_code: response.status,
          latency_ms,
          response_excerpt: bodyText.slice(0, 500),
        }
      }
      return {
        ok: false,
        status_code: response.status,
        latency_ms,
        error: bodyText.slice(0, 500),
        response_excerpt: bodyText.slice(0, 500),
      }
    } catch (error) {
      return {
        ok: false,
        status_code: null,
        latency_ms: Date.now() - start,
        error: error instanceof Error ? error.message : "Unknown Telegram delivery error.",
      }
    }
  }

  return {
    type: "telegram",
    configSchema: TelegramConfigSchema,
    redactConfig: (config) => ({ ...config, bot_token: "" }),
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
