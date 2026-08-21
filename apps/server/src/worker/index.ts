import { maxAttemptsFor, nextAttemptAt, type DeliveryResult } from "@postbag/core"
import { and, eq } from "drizzle-orm"
import {
  claimDeliveries,
  deliveries,
  destinations,
  forms,
  listenDeliveries,
  projects,
  routes,
  streams,
  submissions,
  workerHeartbeats,
  type ClaimedDelivery,
  type Database,
} from "@postbag/db"

import type { AnyDestinationAdapter, DeliveryContext } from "../destinations/types.js"
import type { Env } from "../env.js"
import type { Logger } from "../logger.js"
import { runDigestSweep } from "./digests.js"
import { runSchemaInferenceSweep } from "./housekeeping.js"
import { recordEvent } from "./shared.js"
import { processSystemWebhookDeliveries } from "./systemWebhooks.js"

const CONCURRENCY = 5
const HEARTBEAT_INTERVAL_MS = 10_000
const WAKE_TICK_MS = 15_000
const FAILING_THRESHOLD = 5
// ARCHITECTURE.md "The worker": "Digest loop: once per period per digest route" — runs
// every minute. "Housekeeping: schema inference for observe forms" — every 10 minutes.
const DIGEST_INTERVAL_MS = 60_000
const HOUSEKEEPING_INTERVAL_MS = 10 * 60_000

export type WorkerHandle = {
  stop(): Promise<void>
}

async function heartbeat(db: Database, workerId: string): Promise<void> {
  await db
    .insert(workerHeartbeats)
    .values({ workerId, heartbeatAt: new Date() })
    .onConflictDoUpdate({ target: workerHeartbeats.workerId, set: { heartbeatAt: new Date() } })
}

async function buildContext(db: Database, claimed: ClaimedDelivery): Promise<DeliveryContext | null> {
  const [route] = await db
    .select()
    .from(routes)
    .where(and(eq(routes.organizationId, claimed.organizationId), eq(routes.id, claimed.routeId)))
    .limit(1)
  if (route === undefined) return null

  const [submission] = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.organizationId, claimed.organizationId), eq(submissions.id, claimed.submissionId)))
    .limit(1)

  // Job D 1b: every destination's template context carries the real form/project/stream
  // names (not just slugs) — {{form.name}} was rendering the slug because the worker
  // never fetched the name.
  let form: DeliveryContext["form"] = null
  let project: DeliveryContext["project"] = null
  const formId = route.formId ?? submission?.formId
  if (formId !== undefined) {
    const [row] = await db
      .select({ id: forms.id, name: forms.name, slug: forms.slug, projectId: forms.projectId })
      .from(forms)
      .where(and(eq(forms.organizationId, claimed.organizationId), eq(forms.id, formId)))
      .limit(1)
    if (row !== undefined) {
      form = { id: row.id, name: row.name, slug: row.slug }
      const [projectRow] = await db
        .select({ id: projects.id, name: projects.name, slug: projects.slug })
        .from(projects)
        .where(and(eq(projects.organizationId, claimed.organizationId), eq(projects.id, row.projectId)))
        .limit(1)
      if (projectRow !== undefined) project = projectRow
    }
  }

  let stream: DeliveryContext["stream"] = null
  if (route.streamId !== null) {
    const [row] = await db
      .select({ id: streams.id, name: streams.name, slug: streams.slug })
      .from(streams)
      .where(and(eq(streams.organizationId, claimed.organizationId), eq(streams.id, route.streamId)))
      .limit(1)
    if (row !== undefined) stream = row
  }

  return {
    deliveryId: claimed.id,
    eventType: "submission.received",
    schemaVersion: claimed.schemaVersion,
    form,
    project,
    stream,
    submission:
      submission === undefined ? null : { id: submission.id, received_at: submission.receivedAt.toISOString() },
    extras: {},
    meta: submission?.meta ?? {},
  }
}

async function markDestinationOutcome(
  db: Database,
  organizationId: string,
  destinationId: string,
  ok: boolean,
): Promise<void> {
  const [destination] = await db
    .select()
    .from(destinations)
    .where(and(eq(destinations.organizationId, organizationId), eq(destinations.id, destinationId)))
    .limit(1)
  if (destination === undefined) return

  if (ok) {
    const wasFailing = destination.health === "failing"
    await db
      .update(destinations)
      .set({ consecutiveFailures: 0, health: "ok", updatedAt: new Date() })
      .where(and(eq(destinations.organizationId, organizationId), eq(destinations.id, destinationId)))
    if (wasFailing) {
      await recordEvent(db, organizationId, "destination.recovered", { destination_id: destinationId })
    }
    return
  }

  const consecutiveFailures = destination.consecutiveFailures + 1
  const nowFailing = consecutiveFailures >= FAILING_THRESHOLD && destination.health !== "failing"
  await db
    .update(destinations)
    .set({ consecutiveFailures, health: nowFailing ? "failing" : destination.health, updatedAt: new Date() })
    .where(and(eq(destinations.organizationId, organizationId), eq(destinations.id, destinationId)))
  if (nowFailing) {
    await recordEvent(db, organizationId, "destination.failing", { destination_id: destinationId })
  }
}

async function disableDestination(db: Database, organizationId: string, destinationId: string): Promise<void> {
  await db
    .update(destinations)
    .set({ health: "failing", updatedAt: new Date() })
    .where(and(eq(destinations.organizationId, organizationId), eq(destinations.id, destinationId)))
  await db
    .update(routes)
    .set({ enabled: false, updatedAt: new Date() })
    .where(and(eq(routes.organizationId, organizationId), eq(routes.destinationId, destinationId)))
}

function resultAsRecord(result: DeliveryResult): Record<string, unknown> {
  return { ...result }
}

async function markSent(db: Database, claimed: ClaimedDelivery, result: DeliveryResult): Promise<void> {
  await db
    .update(deliveries)
    .set({ status: "sent", sentAt: new Date(), lastResponse: resultAsRecord(result), lastError: null })
    .where(and(eq(deliveries.organizationId, claimed.organizationId), eq(deliveries.id, claimed.id)))
}

async function markDead(
  db: Database,
  claimed: ClaimedDelivery,
  result: DeliveryResult | null,
  message: string,
): Promise<void> {
  await db
    .update(deliveries)
    .set({
      status: "dead",
      lastResponse: result === null ? undefined : resultAsRecord(result),
      lastError: message,
    })
    .where(and(eq(deliveries.organizationId, claimed.organizationId), eq(deliveries.id, claimed.id)))
}

async function markFailedForRetry(
  db: Database,
  claimed: ClaimedDelivery,
  result: DeliveryResult | null,
  message: string,
): Promise<Date> {
  const next = nextAttemptAt(claimed.attempts, new Date(), {}, Math.random)
  await db
    .update(deliveries)
    .set({
      status: "failed",
      nextAttemptAt: next,
      lastResponse: result === null ? undefined : resultAsRecord(result),
      lastError: message,
    })
    .where(and(eq(deliveries.organizationId, claimed.organizationId), eq(deliveries.id, claimed.id)))
  return next
}

async function failDelivery(
  db: Database,
  log: Logger,
  claimed: ClaimedDelivery,
  destinationType: string,
  message: string,
): Promise<void> {
  const maxAttempts = maxAttemptsFor(destinationType)
  if (claimed.attempts >= maxAttempts) {
    await markDead(db, claimed, null, message)
    await recordEvent(db, claimed.organizationId, "delivery.dead", {
      delivery_id: claimed.id,
      submission_id: claimed.submissionId,
      destination_id: claimed.destinationId,
    })
    log.error({ error: message }, "delivery.dead")
    return
  }
  const next = await markFailedForRetry(db, claimed, null, message)
  log.warn({ error: message, next_attempt_at: next.toISOString() }, "delivery.failed")
}

async function processDelivery(
  db: Database,
  logger: Logger,
  registry: ReadonlyMap<string, AnyDestinationAdapter>,
  claimed: ClaimedDelivery,
): Promise<void> {
  const log = logger.child({
    org_id: claimed.organizationId,
    delivery_id: claimed.id,
    submission_id: claimed.submissionId,
  })

  const [destination] = await db
    .select()
    .from(destinations)
    .where(and(eq(destinations.organizationId, claimed.organizationId), eq(destinations.id, claimed.destinationId)))
    .limit(1)
  if (destination === undefined) {
    await failDelivery(db, log, claimed, "webhook", "Destination no longer exists.")
    return
  }

  const adapter = registry.get(destination.type)
  if (adapter === undefined) {
    await failDelivery(db, log, claimed, destination.type, `No adapter registered for '${destination.type}'.`)
    return
  }

  const ctx = await buildContext(db, claimed)
  if (ctx === null) {
    await failDelivery(db, log, claimed, destination.type, "Route no longer exists.")
    return
  }

  let result: DeliveryResult
  try {
    result = await adapter.deliver(destination.config, claimed.payload as Readonly<Record<string, unknown>>, ctx)
  } catch (error) {
    result = { ok: false, status_code: null, error: error instanceof Error ? error.message : "Unknown delivery error." }
  }

  if (result.ok === true) {
    await markSent(db, claimed, result)
    await recordEvent(db, claimed.organizationId, "delivery.sent", {
      delivery_id: claimed.id,
      submission_id: claimed.submissionId,
      destination_id: claimed.destinationId,
    })
    await markDestinationOutcome(db, claimed.organizationId, claimed.destinationId, true)
    log.info({ status_code: result.status_code }, "delivery.sent")
    return
  }

  if (destination.type === "webhook" && result.status_code === 410) {
    await disableDestination(db, claimed.organizationId, claimed.destinationId)
    await markDead(db, claimed, result, result.error ?? "Destination returned 410.")
    await recordEvent(db, claimed.organizationId, "delivery.dead", {
      delivery_id: claimed.id,
      submission_id: claimed.submissionId,
      destination_id: claimed.destinationId,
    })
    log.error({ status_code: 410 }, "delivery.dead: destination returned 410, disabled")
    return
  }

  await markDestinationOutcome(db, claimed.organizationId, claimed.destinationId, false)

  const maxAttempts = maxAttemptsFor(destination.type)
  if (claimed.attempts >= maxAttempts) {
    await markDead(db, claimed, result, result.error ?? "Delivery failed.")
    await recordEvent(db, claimed.organizationId, "delivery.dead", {
      delivery_id: claimed.id,
      submission_id: claimed.submissionId,
      destination_id: claimed.destinationId,
    })
    log.error({ attempts: claimed.attempts, error: result.error }, "delivery.dead: max attempts reached")
    return
  }

  const next = await markFailedForRetry(db, claimed, result, result.error ?? "Delivery failed.")
  log.warn({ attempts: claimed.attempts, next_attempt_at: next.toISOString(), error: result.error }, "delivery.failed")
}

export function startWorker(
  db: Database,
  env: Env,
  logger: Logger,
  registry: ReadonlyMap<string, AnyDestinationAdapter>,
): WorkerHandle {
  const workerId = `wrk_${globalThis.crypto.randomUUID()}`
  const log = logger.child({ worker_id: workerId })
  const state = { stopped: false }
  let wake: (() => void) | null = null
  let unlisten: (() => Promise<void>) | null = null

  const heartbeatTimer = setInterval(() => {
    heartbeat(db, workerId).catch((error: unknown) => {
      log.error({ err: error }, "heartbeat failed")
    })
  }, HEARTBEAT_INTERVAL_MS)

  const digestTimer = setInterval(() => {
    runDigestSweep(db, log, registry).catch((error: unknown) => {
      log.error({ err: error }, "digest sweep failed")
    })
  }, DIGEST_INTERVAL_MS)

  const housekeepingTimer = setInterval(() => {
    runSchemaInferenceSweep(db, log).catch((error: unknown) => {
      log.error({ err: error }, "schema inference sweep failed")
    })
  }, HOUSEKEEPING_INTERVAL_MS)

  listenDeliveries(env.DATABASE_URL, () => wake?.())
    .then((stop) => {
      unlisten = stop
    })
    .catch((error: unknown) => {
      log.warn({ err: error }, "LISTEN unavailable; falling back to polling only")
    })

  const loopPromise = (async () => {
    await heartbeat(db, workerId)
    while (!state.stopped) {
      const claimed = await claimDeliveries(db, { limit: CONCURRENCY, workerId })
      const claimedWebhooks = await processSystemWebhookDeliveries(db, log, workerId)
      if (claimed.length > 0) {
        await Promise.all(claimed.map((delivery) => processDelivery(db, log, registry, delivery)))
      }
      if (claimed.length > 0 || claimedWebhooks > 0) continue
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, WAKE_TICK_MS)
        wake = () => {
          clearTimeout(timer)
          resolve()
        }
      })
      wake = null
    }
  })()

  return {
    async stop() {
      state.stopped = true
      wake?.()
      clearInterval(heartbeatTimer)
      clearInterval(digestTimer)
      clearInterval(housekeepingTimer)
      await loopPromise
      if (unlisten !== null) await unlisten()
    },
  }
}
