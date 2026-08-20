import { renderTemplate } from "@postbag/core"
import { z } from "zod"

import type { DestinationAdapter, Payload } from "./types.js"

export const TelegramConfigSchema = z.object({
  bot_token: z.string().min(1),
  chat_id: z.string().min(1),
  template: z.string().optional(),
})
export type TelegramConfig = z.infer<typeof TelegramConfigSchema>

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function defaultMessage(formSlug: string, payload: Payload): string {
  const lines = Object.entries(payload).map(([key, value]) => {
    const text = typeof value === "string" ? value : JSON.stringify(value)
    return `<b>${escapeHtml(key)}</b>: ${escapeHtml(text)}`
  })
  return [`<b>New submission — ${escapeHtml(formSlug)}</b>`, "", ...lines].join("\n")
}

export function createTelegramAdapter(): DestinationAdapter<TelegramConfig> {
  const deliver: DestinationAdapter<TelegramConfig>["deliver"] = async (config, payload, ctx) => {
    const start = Date.now()
    const formSlug = ctx.form?.slug ?? ctx.stream?.slug ?? "submission"
    const text =
      config.template === undefined
        ? defaultMessage(formSlug, payload)
        : renderTemplate(config.template, { form: { name: formSlug, slug: formSlug }, data: payload })
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
        return { ok: true, status_code: response.status, latency_ms, response_excerpt: bodyText.slice(0, 500) }
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
        form: { id: "fm_test", slug: "test" },
        stream: null,
        extras: {},
        meta: {},
      }),
    deliver,
  }
}
