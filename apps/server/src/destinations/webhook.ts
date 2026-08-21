import { signWebhook, type DeliveryResult } from "@postbag/core"
import { z } from "zod"

import type { DestinationAdapter } from "./types.js"

export const WebhookConfigSchema = z.object({
  url: z.url(),
  secret: z.string().optional(),
  headers: z.record(z.string(), z.string()).default({}),
})
export type WebhookConfig = z.infer<typeof WebhookConfigSchema>

async function postWebhook(
  config: WebhookConfig,
  eventType: string,
  deliveryId: string,
  body: string,
): Promise<DeliveryResult> {
  const start = Date.now()
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "Postbag-Delivery": deliveryId,
    "Postbag-Event": eventType,
    ...config.headers,
  }
  if (config.secret !== undefined) {
    const timestamp = Math.floor(Date.now() / 1_000)
    headers["Postbag-Signature"] = await signWebhook(config.secret, timestamp, body)
  }
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    })
    const latency_ms = Date.now() - start
    const excerpt = (await response.text().catch(() => "")).slice(0, 500)
    if (response.ok) {
      return { ok: true, status_code: response.status, latency_ms, response_excerpt: excerpt }
    }
    return {
      ok: false,
      status_code: response.status,
      latency_ms,
      response_excerpt: excerpt,
      error: `Webhook responded ${String(response.status)}.`,
    }
  } catch (error) {
    return {
      ok: false,
      status_code: null,
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown webhook delivery error.",
    }
  }
}

export function createWebhookAdapter(): DestinationAdapter<WebhookConfig> {
  const deliver: DestinationAdapter<WebhookConfig>["deliver"] = (config, payload, ctx) => {
    const body = JSON.stringify({
      id: ctx.deliveryId,
      type: ctx.eventType,
      schema_version: ctx.schemaVersion,
      stream: ctx.stream,
      form: ctx.form,
      data: payload,
      extras: ctx.extras,
      meta: ctx.meta,
    })
    return postWebhook(config, ctx.eventType, ctx.deliveryId, body)
  }

  const deliverDigest: DestinationAdapter<WebhookConfig>["deliverDigest"] = (config, submissions, ctx) => {
    const body = JSON.stringify({
      digest: {
        id: ctx.digestId,
        route_id: ctx.routeId,
        period_key: ctx.periodKey,
        form: ctx.form,
        stream: ctx.stream,
      },
      submissions,
    })
    return postWebhook(config, "digest.ready", ctx.digestId, body)
  }

  return {
    type: "webhook",
    configSchema: WebhookConfigSchema,
    redactConfig: (config) => ({ ...config, secret: config.secret === undefined ? undefined : "" }),
    test: (config, sample) =>
      deliver(config, sample, {
        deliveryId: "dl_test",
        eventType: "submission.received",
        schemaVersion: null,
        form: { id: "fm_test", name: "Test", slug: "test" },
        project: null,
        stream: null,
        submission: null,
        extras: {},
        meta: {},
      }),
    deliver,
    deliverDigest,
  }
}
