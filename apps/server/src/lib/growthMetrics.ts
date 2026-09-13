import { and, count, countDistinct, eq, gte, sql } from "drizzle-orm"
import {
  anonymousSandboxes,
  deliveries,
  destinations,
  forms,
  organization,
  organizationSettings,
  submissions,
  type Database,
} from "@postbag/db"

import type { z } from "@hono/zod-openapi"

import type { GrowthMetricsSchema } from "../schemas.js"

type GrowthMetrics = z.infer<typeof GrowthMetricsSchema>

const DAY_MS = 24 * 60 * 60 * 1000
const KNOWN_PLANS = ["free", "pro", "team", "selfhost"] as const
const KNOWN_DESTINATION_TYPES = ["email", "telegram", "webhook", "slack", "discord"] as const

function asCount(value: number | string | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS)
}

function countsByKey(
  rows: readonly { readonly key: string | null; readonly value: number | string | bigint }[],
  known: readonly string[],
  fallbackKey?: string,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const key of known) out[key] = 0
  for (const row of rows) {
    const key = row.key ?? fallbackKey
    if (key === undefined) continue
    out[key] = (out[key] ?? 0) + asCount(row.value)
  }
  return out
}

/**
 * Platform-wide COUNT aggregates for GET /v1/admin/growth-metrics.
 *
 * ADR-011 defines the sole platform aggregate exception to tenant-scoped reads:
 * COUNT / COUNT(DISTINCT) only, grouped only by the closed plan and Destination-type
 * dimensions — never emails, names, payloads, API keys, tenant identifiers, or
 * per-organization dumps. Callers must already have passed requirePlatformAdmin and
 * the read-scope check.
 */
export async function loadPlatformGrowthMetrics(
  db: Database,
  now = new Date(),
): Promise<GrowthMetrics> {
  const since7 = daysAgo(now, 7)
  const since30 = daysAgo(now, 30)
  // postgres.js cannot bind Date inside a raw `sql` fragment; ISO text + timestamptz works.
  const since7Iso = since7.toISOString()
  const since30Iso = since30.toISOString()

  const [
    orgWindow,
    orgByPlan,
    formWindow,
    formsActive,
    submissionWindow,
    orgsWithRealDelivery,
    sandboxWindow,
    destinationByType,
  ] = await Promise.all([
    db
      .select({
        total: count(),
        created7d: sql<number>`count(*) filter (where ${organization.createdAt} >= ${since7Iso}::timestamptz)`,
        created30d: sql<number>`count(*) filter (where ${organization.createdAt} >= ${since30Iso}::timestamptz)`,
      })
      .from(organization)
      .then((rows) => rows[0]),
    db
      .select({
        key: organizationSettings.plan,
        value: count(),
      })
      .from(organization)
      .leftJoin(organizationSettings, eq(organizationSettings.organizationId, organization.id))
      .groupBy(organizationSettings.plan),
    db
      .select({
        total: count(),
        created7d: sql<number>`count(*) filter (where ${forms.createdAt} >= ${since7Iso}::timestamptz)`,
        created30d: sql<number>`count(*) filter (where ${forms.createdAt} >= ${since30Iso}::timestamptz)`,
      })
      .from(forms)
      .then((rows) => rows[0]),
    db
      .select({ value: countDistinct(submissions.formId) })
      .from(submissions)
      .where(and(eq(submissions.test, false), gte(submissions.receivedAt, since30)))
      .then((rows) => rows[0]),
    db
      .select({
        total: count(),
        last7d: sql<number>`count(*) filter (where ${submissions.receivedAt} >= ${since7Iso}::timestamptz)`,
        last30d: sql<number>`count(*) filter (where ${submissions.receivedAt} >= ${since30Iso}::timestamptz)`,
        realLast30d: sql<number>`count(*) filter (where ${submissions.test} = false and ${submissions.receivedAt} >= ${since30Iso}::timestamptz)`,
        testLast30d: sql<number>`count(*) filter (where ${submissions.test} = true and ${submissions.receivedAt} >= ${since30Iso}::timestamptz)`,
      })
      .from(submissions)
      .then((rows) => rows[0]),
    db
      .select({ value: countDistinct(deliveries.organizationId) })
      .from(deliveries)
      .innerJoin(
        submissions,
        and(
          eq(deliveries.submissionId, submissions.id),
          eq(deliveries.organizationId, submissions.organizationId),
        ),
      )
      .where(
        and(
          eq(deliveries.status, "sent"),
          eq(submissions.test, false),
          gte(deliveries.sentAt, since30),
        ),
      )
      .then((rows) => rows[0]),
    db
      .select({
        created30d: sql<number>`count(*) filter (where ${anonymousSandboxes.createdAt} >= ${since30Iso}::timestamptz)`,
        claimed30d: sql<number>`count(*) filter (where ${anonymousSandboxes.claimedAt} >= ${since30Iso}::timestamptz)`,
        expiredOrBlocked30d: sql<number>`count(*) filter (where ${anonymousSandboxes.status} in ('expired', 'blocked') and (${anonymousSandboxes.createdAt} >= ${since30Iso}::timestamptz or ${anonymousSandboxes.expiresAt} >= ${since30Iso}::timestamptz))`,
      })
      .from(anonymousSandboxes)
      .then((rows) => rows[0]),
    db
      .select({
        key: destinations.type,
        value: count(),
      })
      .from(destinations)
      .groupBy(destinations.type),
  ])

  const byPlan = countsByKey(orgByPlan, KNOWN_PLANS, "free")
  const byType = countsByKey(destinationByType, KNOWN_DESTINATION_TYPES)

  return {
    generated_at: now.toISOString(),
    organizations: {
      total: asCount(orgWindow?.total),
      created_7d: asCount(orgWindow?.created7d),
      created_30d: asCount(orgWindow?.created30d),
      by_plan: {
        free: byPlan["free"] ?? 0,
        pro: byPlan["pro"] ?? 0,
        team: byPlan["team"] ?? 0,
        selfhost: byPlan["selfhost"] ?? 0,
      },
    },
    forms: {
      total: asCount(formWindow?.total),
      created_7d: asCount(formWindow?.created7d),
      created_30d: asCount(formWindow?.created30d),
      active: asCount(formsActive?.value),
    },
    submissions: {
      total: asCount(submissionWindow?.total),
      last_7d: asCount(submissionWindow?.last7d),
      last_30d: asCount(submissionWindow?.last30d),
      real_last_30d: asCount(submissionWindow?.realLast30d),
      test_last_30d: asCount(submissionWindow?.testLast30d),
      orgs_with_real_delivery_30d: asCount(orgsWithRealDelivery?.value),
    },
    sandboxes: {
      retained_created_30d: asCount(sandboxWindow?.created30d),
      retained_claimed_30d: asCount(sandboxWindow?.claimed30d),
      retained_expired_or_blocked_30d: asCount(sandboxWindow?.expiredOrBlocked30d),
    },
    destinations: { by_type: byType },
  }
}
