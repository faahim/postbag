import { digestPeriodKey, newId, type RouteMode } from "@postbag/core"
import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import {
  deliveries,
  destinations,
  digests,
  forms,
  projects,
  routes,
  streams,
  submissions,
  type Database,
} from "@postbag/db"

import type { AnyDestinationAdapter, DigestContext, DigestSubmission } from "../destinations/types.js"
import type { Logger } from "../logger.js"
import { recordEvent } from "./shared.js"

/**
 * Job D §3: the digest worker loop. Runs every minute (see DIGEST_INTERVAL_MS in
 * worker/index.ts). For every (route, period) with pending, ungrouped digest deliveries
 * whose period has closed — the route's *current* period key (computed for "now") no
 * longer matches the key stamped on the deliveries at submit time — it sends exactly one
 * payload per destination and marks the period's deliveries as part of that digest.
 * Empty periods never produce a delivery row in the first place (submit.ts only inserts
 * one when a submission actually routes there), so "empty periods send nothing" is
 * automatic.
 */

type PendingGroup = { readonly organizationId: string; readonly routeId: string; readonly periodKey: string }

async function findPendingGroups(db: Database): Promise<readonly PendingGroup[]> {
  return db.execute<PendingGroup>(sql`
    select distinct organization_id as "organizationId", route_id as "routeId", digest_period_key as "periodKey"
    from deliveries
    where status = 'pending' and digest_id is null and digest_period_key is not null
  `)
}

async function buildDigestContext(
  db: Database,
  organizationId: string,
  route: typeof routes.$inferSelect,
): Promise<Pick<DigestContext, "form" | "project" | "stream">> {
  let form: DigestContext["form"] = null
  let project: DigestContext["project"] = null
  if (route.formId !== null) {
    const [row] = await db
      .select({ id: forms.id, name: forms.name, slug: forms.slug, projectId: forms.projectId })
      .from(forms)
      .where(and(eq(forms.organizationId, organizationId), eq(forms.id, route.formId)))
      .limit(1)
    if (row !== undefined) {
      form = { id: row.id, name: row.name, slug: row.slug }
      const [projectRow] = await db
        .select({ id: projects.id, name: projects.name, slug: projects.slug })
        .from(projects)
        .where(and(eq(projects.organizationId, organizationId), eq(projects.id, row.projectId)))
        .limit(1)
      if (projectRow !== undefined) project = projectRow
    }
  }
  let stream: DigestContext["stream"] = null
  if (route.streamId !== null) {
    const [row] = await db
      .select({ id: streams.id, name: streams.name, slug: streams.slug })
      .from(streams)
      .where(and(eq(streams.organizationId, organizationId), eq(streams.id, route.streamId)))
      .limit(1)
    if (row !== undefined) stream = row
  }
  return { form, project, stream }
}

async function processGroup(
  db: Database,
  logger: Logger,
  registry: ReadonlyMap<string, AnyDestinationAdapter>,
  group: PendingGroup,
): Promise<void> {
  const log = logger.child({ org_id: group.organizationId, route_id: group.routeId, period_key: group.periodKey })

  const [route] = await db
    .select()
    .from(routes)
    .where(and(eq(routes.organizationId, group.organizationId), eq(routes.id, group.routeId)))
    .limit(1)
  if (route === undefined) return

  const mode = route.mode as unknown as RouteMode
  if (mode.type !== "digest") return

  const currentKey = digestPeriodKey(mode, new Date())
  if (currentKey === group.periodKey) return // this period is still open — not closed yet

  // Claim (or re-claim, on retry) the digest row for this (route, period). The unique
  // (route_id, period_key) index makes this safe under concurrent workers: only the
  // transaction that actually inserts — or the one that finds it still 'open' — proceeds.
  const [claimedDigest] = await db.execute<{ id: string; status: string }>(sql`
    insert into digests (id, organization_id, route_id, period_key, status, ready_at)
    values (${newId("dg")}, ${group.organizationId}, ${group.routeId}, ${group.periodKey}, 'open', now())
    on conflict (route_id, period_key) do update set route_id = digests.route_id
    returning id, status
  `)
  if (claimedDigest === undefined || claimedDigest.status === "sent") return
  const digestId = claimedDigest.id

  const memberDeliveries = await db
    .select()
    .from(deliveries)
    .where(
      and(
        eq(deliveries.organizationId, group.organizationId),
        eq(deliveries.routeId, group.routeId),
        eq(deliveries.digestPeriodKey, group.periodKey),
        eq(deliveries.status, "pending"),
        isNull(deliveries.digestId),
      ),
    )

  if (memberDeliveries.length === 0) {
    await db.update(digests).set({ status: "sent", sentAt: new Date() }).where(eq(digests.id, digestId))
    return
  }

  const [destination] = await db
    .select()
    .from(destinations)
    .where(and(eq(destinations.organizationId, group.organizationId), eq(destinations.id, route.destinationId)))
    .limit(1)
  const adapter = destination === undefined ? undefined : registry.get(destination.type)

  const submissionIds = memberDeliveries.map((delivery) => delivery.submissionId)
  const submissionRows = await db
    .select({ id: submissions.id, receivedAt: submissions.receivedAt })
    .from(submissions)
    .where(and(eq(submissions.organizationId, group.organizationId), inArray(submissions.id, submissionIds)))
  const receivedAtById = new Map(submissionRows.map((row) => [row.id, row.receivedAt]))

  const digestSubmissions: DigestSubmission[] = memberDeliveries
    .map((delivery) => ({
      id: delivery.submissionId,
      received_at: (receivedAtById.get(delivery.submissionId) ?? new Date()).toISOString(),
      data: delivery.payload,
    }))
    .sort((a, b) => a.received_at.localeCompare(b.received_at))

  const context = await buildDigestContext(db, group.organizationId, route)
  const ctx: DigestContext = { digestId, routeId: group.routeId, periodKey: group.periodKey, ...context }

  const result =
    adapter === undefined || destination === undefined
      ? {
          ok: false as const,
          status_code: null,
          error:
            destination === undefined
              ? "Destination no longer exists."
              : `No adapter registered for '${destination.type}'.`,
        }
      : await adapter.deliverDigest(destination.config, digestSubmissions, ctx).catch((error: unknown) => ({
          ok: false as const,
          status_code: null,
          error: error instanceof Error ? error.message : "Unknown digest delivery error.",
        }))

  if (!result.ok) {
    // Left `status: 'open'` and the member deliveries ungrouped/pending — the next sweep
    // (a minute later) retries the whole group from scratch.
    log.warn({ error: result.error }, "digest.failed")
    return
  }

  const now = new Date()
  await db.update(digests).set({ status: "sent", sentAt: now }).where(eq(digests.id, digestId))
  await db
    .update(deliveries)
    .set({ status: "sent", digestId, sentAt: now, nextAttemptAt: now, lastResponse: { ...result } })
    .where(
      inArray(
        deliveries.id,
        memberDeliveries.map((delivery) => delivery.id),
      ),
    )
  await recordEvent(
    db,
    group.organizationId,
    "digest.ready",
    { digest_id: digestId, route_id: group.routeId },
    { period_key: group.periodKey, submission_count: digestSubmissions.length },
  )
  log.info({ submission_count: digestSubmissions.length }, "digest.sent")
}

export async function runDigestSweep(
  db: Database,
  logger: Logger,
  registry: ReadonlyMap<string, AnyDestinationAdapter>,
): Promise<void> {
  const groups = await findPendingGroups(db)
  for (const group of groups) {
    try {
      await processGroup(db, logger, registry, group)
    } catch (error) {
      logger.warn({ err: error, route_id: group.routeId, period_key: group.periodKey }, "digest sweep failed for group")
    }
  }
}
