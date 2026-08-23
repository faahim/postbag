import { newId } from "@postbag/core"
import { and, eq, isNull, lt, or } from "drizzle-orm"
import {
  deleteExpiredAnonymousSandboxes,
  events,
  forms,
  organizationSettings,
  submissions,
  type Database,
} from "@postbag/db"

import type { Logger } from "../logger.js"
import { limitsFor } from "../lib/plan.js"
import { inferFormSchemaDraft } from "../repo/schemaInference.js"

/**
 * Job D §4 housekeeping loop: every 10 minutes (see HOUSEKEEPING_INTERVAL_MS in
 * worker/index.ts), re-infer a draft schema for every `observe`-mode form that has no
 * published schema yet. Publishing stays a separate, explicit act
 * (POST /v1/forms/{id}/schema with a body) — this only ever writes `form_schema_drafts`.
 */
export async function runSchemaInferenceSweep(db: Database, logger: Logger): Promise<void> {
  const eligible = await db
    .select({ id: forms.id, organizationId: forms.organizationId })
    .from(forms)
    .where(and(eq(forms.schemaMode, "observe"), isNull(forms.currentSchemaVersion)))

  for (const form of eligible) {
    try {
      await inferFormSchemaDraft(db, form.organizationId, form.id)
    } catch (error) {
      logger.warn({ err: error, form_id: form.id }, "schema inference sweep failed for form")
    }
  }
}

/**
 * Job K expiry housekeeping — same 10-minute loop as the schema inference sweep above.
 * Reverts a `complimentary` org whose `plan_expires_at` has passed back to `free`/`free`
 * (plan_note cleared) and emits `organization.plan.changed` with before/after, the same
 * event POST /v1/plan/redeem writes. One org failing must not stop the sweep for the rest.
 */
export async function runPlanExpirySweep(db: Database, logger: Logger): Promise<void> {
  const now = new Date()
  const expired = await db
    .select()
    .from(organizationSettings)
    .where(
      and(
        eq(organizationSettings.planSource, "complimentary"),
        lt(organizationSettings.planExpiresAt, now),
      ),
    )

  for (const org of expired) {
    try {
      const before = {
        plan: org.plan,
        plan_source: org.planSource,
        plan_expires_at: org.planExpiresAt?.toISOString() ?? null,
        plan_note: org.planNote,
      }
      const after = { plan: "free", plan_source: "free", plan_expires_at: null, plan_note: null }

      await db.transaction(async (tx) => {
        await tx
          .update(organizationSettings)
          .set({
            plan: "free",
            planSource: "free",
            planNote: null,
            planExpiresAt: null,
            updatedAt: now,
          })
          .where(eq(organizationSettings.organizationId, org.organizationId))
        await tx.insert(events).values({
          id: newId("ev"),
          organizationId: org.organizationId,
          type: "organization.plan.changed",
          subject: { organization_id: org.organizationId },
          data: { before, after, reason: "complimentary_expired" },
        })
      })
    } catch (error) {
      logger.warn(
        { err: error, organization_id: org.organizationId },
        "plan expiry sweep failed for organization",
      )
    }
  }
}

export async function runRetentionSweep(db: Database, logger: Logger): Promise<void> {
  const now = new Date()
  const settings = await db
    .select({
      organizationId: organizationSettings.organizationId,
      plan: organizationSettings.plan,
      limits: organizationSettings.limits,
    })
    .from(organizationSettings)

  for (const organizationSetting of settings) {
    try {
      const retentionDays = limitsFor(
        organizationSetting.plan,
        organizationSetting.limits,
      ).retention_days
      const retentionCutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60_000)
      const testCutoff = new Date(now.getTime() - 24 * 60 * 60_000)
      await db
        .delete(submissions)
        .where(
          and(
            eq(submissions.organizationId, organizationSetting.organizationId),
            or(
              and(eq(submissions.test, false), lt(submissions.receivedAt, retentionCutoff)),
              and(eq(submissions.test, true), lt(submissions.receivedAt, testCutoff)),
            ),
          ),
        )
    } catch (error) {
      logger.warn(
        { err: error, organization_id: organizationSetting.organizationId },
        "retention sweep failed for organization",
      )
    }
  }
}

/** ADR-008 cleanup. Expiry is enforced on every operation; this only reclaims storage. */
export async function runAnonymousSandboxCleanup(db: Database, logger: Logger): Promise<void> {
  try {
    const deleted = await deleteExpiredAnonymousSandboxes(db)
    if (deleted > 0) logger.info({ deleted }, "anonymous sandbox cleanup complete")
  } catch (error) {
    logger.warn({ err: error }, "anonymous sandbox cleanup failed")
  }
}
