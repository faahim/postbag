import type { Env } from "../env.js"
import { createEmailAdapter } from "./email.js"
import { createTelegramAdapter } from "./telegram.js"
import { eraseAdapter, type AnyDestinationAdapter } from "./types.js"
import { createWebhookAdapter } from "./webhook.js"

export function createDestinationRegistry(env: Env): ReadonlyMap<string, AnyDestinationAdapter> {
  const registry = new Map<string, AnyDestinationAdapter>()
  registry.set(
    "email",
    eraseAdapter(createEmailAdapter({ apiKey: env.RESEND_API_KEY, mailFrom: env.MAIL_FROM })),
  )
  registry.set("telegram", eraseAdapter(createTelegramAdapter()))
  registry.set("webhook", eraseAdapter(createWebhookAdapter()))
  return registry
}
