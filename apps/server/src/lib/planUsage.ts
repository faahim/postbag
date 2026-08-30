import { PostbagError } from "@postbag/core"
import {
  destinations,
  forms,
  objectDeletions,
  organizationSettings,
  submissionAttachments,
  submissions,
  type Database,
} from "@postbag/db"
import { and, count, eq, gte, sql } from "drizzle-orm"

import { limitsFor } from "./plan.js"

export type LimitedResource = "forms" | "destinations"
export type PlanLockResource = LimitedResource | "submissions" | "attachments"
type PlanUsageDatabase = Pick<Database, "execute" | "select">

export async function organizationLimits(db: PlanUsageDatabase, organizationId: string) {
  const [settings] = await db
    .select({ plan: organizationSettings.plan, limits: organizationSettings.limits })
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, organizationId))
    .limit(1)
  return limitsFor(settings?.plan ?? "free", settings?.limits ?? {})
}

export async function countMonthlySubmissions(
  db: PlanUsageDatabase,
  organizationId: string,
  now = new Date(),
): Promise<number> {
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const [row] = await db
    .select({ value: count() })
    .from(submissions)
    .where(
      and(
        eq(submissions.organizationId, organizationId),
        eq(submissions.test, false),
        gte(submissions.receivedAt, startOfMonth),
      ),
    )
  return row?.value ?? 0
}

/** Total retained object bytes for one organization, including objects queued for
 * asynchronous deletion. Capacity is released only after storage confirms deletion. */
export async function retainedAttachmentStorageBytes(
  db: PlanUsageDatabase,
  organizationId: string,
): Promise<number> {
  const [row] = await db.execute<{ value: string }>(sql`
    select (
      coalesce((
        select sum(${submissionAttachments.sizeBytes})
        from ${submissionAttachments}
        where ${submissionAttachments.organizationId} = ${organizationId}
      ), 0) + coalesce((
        select sum(${objectDeletions.sizeBytes})
        from ${objectDeletions}
        where ${objectDeletions.organizationId} = ${organizationId}
      ), 0)
    )::text as value
  `)
  return Number(row?.value ?? 0)
}

export async function lockPlanCapacity(
  db: PlanUsageDatabase,
  organizationId: string,
  resource: PlanLockResource,
): Promise<void> {
  await db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${organizationId}), hashtext(${resource}))`,
  )
}

export async function assertLockedPlanCapacity(
  db: PlanUsageDatabase,
  organizationId: string,
  resource: LimitedResource,
  requested = 1,
): Promise<void> {
  const limits = await organizationLimits(db, organizationId)
  const table = resource === "forms" ? forms : destinations
  const [row] = await db
    .select({ value: count() })
    .from(table)
    .where(eq(table.organizationId, organizationId))
  const used = row?.value ?? 0
  if (used + requested > limits[resource]) {
    throw new PostbagError(
      "plan_limit_reached",
      `This organization has reached its ${resource} limit.`,
      {
        resource,
        limit: limits[resource],
        used,
        requested,
      },
    )
  }
}

export async function assertPlanCapacity(
  db: PlanUsageDatabase,
  organizationId: string,
  resource: LimitedResource,
  requested = 1,
): Promise<void> {
  await lockPlanCapacity(db, organizationId, resource)
  await assertLockedPlanCapacity(db, organizationId, resource, requested)
}

/** Call inside a transaction after lockPlanCapacity(db, org, "attachments"). */
export async function assertLockedAttachmentStorageCapacity(
  db: PlanUsageDatabase,
  organizationId: string,
  requestedBytes: number,
): Promise<void> {
  const limits = await organizationLimits(db, organizationId)
  const used = await retainedAttachmentStorageBytes(db, organizationId)
  if (used + requestedBytes > limits.attachment_storage_bytes) {
    throw new PostbagError(
      "attachment_storage_limit_reached",
      "This organization has reached its attachment storage limit.",
      {
        resource: "attachment_storage_bytes",
        limit: limits.attachment_storage_bytes,
        used,
        requested: requestedBytes,
      },
    )
  }
}
