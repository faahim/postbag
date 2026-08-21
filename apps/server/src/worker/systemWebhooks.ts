import { maxAttemptsFor, nextAttemptAt, signWebhook, type DeliveryResult } from "@postbag/core"
import { and, eq } from "drizzle-orm"
import {
  claimSystemWebhookDeliveries,
  systemWebhookDeliveries,
  systemWebhooks,
  type ClaimedSystemWebhookDelivery,
  type Database,
} from "@postbag/db"

import type { Logger } from "../logger.js"

// Job D §2: the worker loop for the `system_webhook_deliveries` outbox — org-level
// webhooks subscribed to event types, enqueued by the `dispatch_system_webhooks` Postgres
// trigger (see migration 0002). Delivered with the same HMAC signing, `Postbag-*` headers,
// backoff and dead-lettering semantics as route webhooks (ARCHITECTURE.md "Webhook
// contract"), just against a separate table so route delivery health is unaffected.
const CONCURRENCY = 5
const FAILING_THRESHOLD = 5

function resultAsRecord(result: DeliveryResult): Record<string, unknown> {
  return { ...result }
}

async function markSent(db: Database, claimed: ClaimedSystemWebhookDelivery, result: DeliveryResult): Promise<void> {
  await db
    .update(systemWebhookDeliveries)
    .set({ status: "sent", sentAt: new Date(), lastResponse: resultAsRecord(result), lastError: null })
    .where(
      and(
        eq(systemWebhookDeliveries.organizationId, claimed.organizationId),
        eq(systemWebhookDeliveries.id, claimed.id),
      ),
    )
}

async function markDead(
  db: Database,
  claimed: ClaimedSystemWebhookDelivery,
  result: DeliveryResult | null,
  message: string,
): Promise<void> {
  await db
    .update(systemWebhookDeliveries)
    .set({
      status: "dead",
      lastResponse: result === null ? undefined : resultAsRecord(result),
      lastError: message,
    })
    .where(
      and(
        eq(systemWebhookDeliveries.organizationId, claimed.organizationId),
        eq(systemWebhookDeliveries.id, claimed.id),
      ),
    )
}

async function markFailedForRetry(
  db: Database,
  claimed: ClaimedSystemWebhookDelivery,
  result: DeliveryResult | null,
  message: string,
): Promise<Date> {
  const next = nextAttemptAt(claimed.attempts, new Date(), {}, Math.random)
  await db
    .update(systemWebhookDeliveries)
    .set({
      status: "failed",
      nextAttemptAt: next,
      lastResponse: result === null ? undefined : resultAsRecord(result),
      lastError: message,
    })
    .where(
      and(
        eq(systemWebhookDeliveries.organizationId, claimed.organizationId),
        eq(systemWebhookDeliveries.id, claimed.id),
      ),
    )
  return next
}

async function markWebhookOutcome(
  db: Database,
  organizationId: string,
  webhookId: string,
  ok: boolean,
): Promise<void> {
  const [webhook] = await db
    .select()
    .from(systemWebhooks)
    .where(and(eq(systemWebhooks.organizationId, organizationId), eq(systemWebhooks.id, webhookId)))
    .limit(1)
  if (webhook === undefined) return

  if (ok) {
    await db
      .update(systemWebhooks)
      .set({ consecutiveFailures: 0, health: "ok", updatedAt: new Date() })
      .where(and(eq(systemWebhooks.organizationId, organizationId), eq(systemWebhooks.id, webhookId)))
    return
  }

  const consecutiveFailures = webhook.consecutiveFailures + 1
  const nowFailing = consecutiveFailures >= FAILING_THRESHOLD && webhook.health !== "failing"
  await db
    .update(systemWebhooks)
    .set({ consecutiveFailures, health: nowFailing ? "failing" : webhook.health, updatedAt: new Date() })
    .where(and(eq(systemWebhooks.organizationId, organizationId), eq(systemWebhooks.id, webhookId)))
}

async function disableWebhook(db: Database, organizationId: string, webhookId: string): Promise<void> {
  await db
    .update(systemWebhooks)
    .set({ enabled: false, health: "failing", updatedAt: new Date() })
    .where(and(eq(systemWebhooks.organizationId, organizationId), eq(systemWebhooks.id, webhookId)))
}

async function failWithoutWebhook(
  db: Database,
  claimed: ClaimedSystemWebhookDelivery,
  message: string,
): Promise<void> {
  const maxAttempts = maxAttemptsFor("webhook")
  if (claimed.attempts >= maxAttempts) {
    await markDead(db, claimed, null, message)
    return
  }
  await markFailedForRetry(db, claimed, null, message)
}

async function processSystemWebhookDelivery(
  db: Database,
  logger: Logger,
  claimed: ClaimedSystemWebhookDelivery,
): Promise<void> {
  const log = logger.child({
    org_id: claimed.organizationId,
    system_webhook_delivery_id: claimed.id,
    webhook_id: claimed.webhookId,
  })

  const [webhook] = await db
    .select()
    .from(systemWebhooks)
    .where(and(eq(systemWebhooks.organizationId, claimed.organizationId), eq(systemWebhooks.id, claimed.webhookId)))
    .limit(1)
  if (webhook === undefined) {
    await failWithoutWebhook(db, claimed, "System webhook no longer exists.")
    return
  }

  const body = JSON.stringify(claimed.payload)
  const timestamp = Math.floor(Date.now() / 1_000)
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "Postbag-Delivery": claimed.id,
    "Postbag-Event": claimed.eventType,
    "Postbag-Signature": await signWebhook(webhook.secret, timestamp, body),
  }

  let result: DeliveryResult
  const start = Date.now()
  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    })
    const latency_ms = Date.now() - start
    const excerpt = (await response.text().catch(() => "")).slice(0, 500)
    result = response.ok
      ? { ok: true, status_code: response.status, latency_ms, response_excerpt: excerpt }
      : {
          ok: false,
          status_code: response.status,
          latency_ms,
          response_excerpt: excerpt,
          error: `Webhook responded ${String(response.status)}.`,
        }
  } catch (error) {
    result = {
      ok: false,
      status_code: null,
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown webhook delivery error.",
    }
  }

  if (result.ok === true) {
    await markSent(db, claimed, result)
    await markWebhookOutcome(db, claimed.organizationId, claimed.webhookId, true)
    log.info({ status_code: result.status_code }, "system_webhook.sent")
    return
  }

  if (result.status_code === 410) {
    await disableWebhook(db, claimed.organizationId, claimed.webhookId)
    await markDead(db, claimed, result, result.error ?? "Webhook returned 410.")
    log.error({ status_code: 410 }, "system_webhook.dead: webhook returned 410, disabled")
    return
  }

  await markWebhookOutcome(db, claimed.organizationId, claimed.webhookId, false)

  const maxAttempts = maxAttemptsFor("webhook")
  if (claimed.attempts >= maxAttempts) {
    await markDead(db, claimed, result, result.error ?? "Delivery failed.")
    log.error({ attempts: claimed.attempts, error: result.error }, "system_webhook.dead: max attempts reached")
    return
  }

  const next = await markFailedForRetry(db, claimed, result, result.error ?? "Delivery failed.")
  log.warn(
    { attempts: claimed.attempts, next_attempt_at: next.toISOString(), error: result.error },
    "system_webhook.failed",
  )
}

/** Claims and processes a batch of pending system webhook deliveries. Returns the number
 * claimed so the caller's loop knows whether to keep draining before falling back to the
 * wake tick. */
export async function processSystemWebhookDeliveries(
  db: Database,
  logger: Logger,
  workerId: string,
): Promise<number> {
  const claimed = await claimSystemWebhookDeliveries(db, { limit: CONCURRENCY, workerId })
  if (claimed.length === 0) return 0
  await Promise.all(claimed.map((delivery) => processSystemWebhookDelivery(db, logger, delivery)))
  return claimed.length
}
