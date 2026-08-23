import {
  applyMapping,
  planDeliveries,
  PostbagError,
  StreamSourceInputSchema,
  type Mapping,
} from "@postbag/core"
import { and, eq } from "drizzle-orm"
import { deliveries, forms, notifyDeliveries, submissions, type Database } from "@postbag/db"

import { countMonthlySubmissions, lockPlanCapacity, organizationLimits } from "../lib/planUsage.js"
import {
  getDirectRoutesForForm,
  getStreamMembershipsForForm,
  getStreamSchemaJson,
} from "./routing.js"

const DIGEST_PARKED_UNTIL = new Date("9999-01-01T00:00:00.000Z")

type RecoveryInput = {
  readonly organizationId: string
  readonly submission: typeof submissions.$inferSelect
}

export async function restoreSubmission(
  db: Database,
  input: RecoveryInput,
): Promise<typeof submissions.$inferSelect> {
  const [form] = await db
    .select()
    .from(forms)
    .where(
      and(eq(forms.organizationId, input.organizationId), eq(forms.id, input.submission.formId)),
    )
    .limit(1)

  const directRoutes =
    form?.status === "active" ? await getDirectRoutesForForm(db, input.organizationId, form.id) : []
  const streamMemberships =
    form?.status === "active"
      ? await getStreamMembershipsForForm(db, {
          id: form.id,
          organizationId: input.organizationId,
          projectId: form.projectId,
          tags: form.tags,
        })
      : []
  const plans =
    form?.status === "active"
      ? planDeliveries({
          submission: {
            id: input.submission.id,
            status: "received",
            receivedAt: input.submission.receivedAt,
          },
          form: { status: "active", schemaVersion: form.currentSchemaVersion },
          directRoutes,
          streamMemberships,
        })
      : []

  const payloadByStream = new Map<string, Readonly<Record<string, unknown>>>()
  for (const membership of streamMemberships) {
    if (membership.schemaVersion === null) continue
    const schema = await getStreamSchemaJson(
      db,
      input.organizationId,
      membership.streamId,
      membership.schemaVersion,
    )
    if (schema === null) continue
    const source = StreamSourceInputSchema.parse({
      form_id: input.submission.formId,
      mapping: membership.mapping,
    })
    const mapping: Mapping = Object.fromEntries(
      Object.entries(source.mapping).map(([field, entry]) => [
        field,
        {
          ...(entry.from === undefined ? {} : { from: entry.from }),
          ...(entry.const === undefined ? {} : { const: entry.const }),
          ...(entry.expr === undefined ? {} : { expr: entry.expr }),
          ...(entry.default === undefined ? {} : { default: entry.default }),
        },
      ]),
    )
    payloadByStream.set(
      membership.streamId,
      applyMapping(input.submission.data, mapping, schema).payload,
    )
  }

  const result = await db.transaction(async (tx) => {
    if (!input.submission.test) {
      await lockPlanCapacity(tx, input.organizationId, "submissions")
      const limit = (await organizationLimits(tx, input.organizationId)).submissions_per_month
      const used = await countMonthlySubmissions(tx, input.organizationId)
      if (used > limit) {
        throw new PostbagError(
          "plan_limit_reached",
          "This organization is still over its monthly submission limit.",
          { resource: "submissions", limit, used },
        )
      }
    }

    const [updated] = await tx
      .update(submissions)
      .set({ status: "received", quarantineReason: null })
      .where(
        and(
          eq(submissions.organizationId, input.organizationId),
          eq(submissions.id, input.submission.id),
        ),
      )
      .returning()
    if (updated === undefined) throw new Error("Failed to restore submission.")

    let hasPendingInstantDelivery = false
    for (const plan of plans) {
      if (plan.status !== "pending") continue
      const payload =
        plan.streamId === null
          ? input.submission.data
          : (payloadByStream.get(plan.streamId) ?? input.submission.data)
      const nextAttemptAt = plan.digestPeriodKey === undefined ? new Date() : DIGEST_PARKED_UNTIL
      const deliveryState = {
        destinationId: plan.destinationId,
        status: "pending",
        skipReason: null,
        attempts: 0,
        nextAttemptAt,
        lastError: null,
        lastResponse: null,
        workerId: null,
        claimedAt: null,
        sentAt: null,
        payload,
        schemaVersion: plan.schemaVersion,
        digestPeriodKey: plan.digestPeriodKey ?? null,
      }
      const [reactivated] = await tx
        .update(deliveries)
        .set(deliveryState)
        .where(
          and(
            eq(deliveries.organizationId, input.organizationId),
            eq(deliveries.submissionId, input.submission.id),
            eq(deliveries.routeId, plan.routeId),
            eq(deliveries.status, "skipped"),
          ),
        )
        .returning({ id: deliveries.id })
      const [inserted] =
        reactivated === undefined
          ? await tx
              .insert(deliveries)
              .values({
                organizationId: input.organizationId,
                submissionId: input.submission.id,
                routeId: plan.routeId,
                dedupeKey: `${input.submission.id}:${plan.routeId}`,
                ...deliveryState,
              })
              .onConflictDoNothing()
              .returning({ id: deliveries.id })
          : []
      if (
        (reactivated !== undefined || inserted !== undefined) &&
        plan.digestPeriodKey === undefined
      ) {
        hasPendingInstantDelivery = true
      }
    }
    return { updated, hasPendingInstantDelivery }
  })

  if (result.hasPendingInstantDelivery) await notifyDeliveries(db)
  return result.updated
}
