import { newId, type Plan } from "@postbag/core"
import { billingEvents, events, organizationSettings, type Database } from "@postbag/db"
import { and, asc, eq, lte, sql } from "drizzle-orm"

import type { Env } from "../env.js"
import { parseBillingWebhookEvent } from "../lib/billingProvider.js"
import type { Logger } from "../logger.js"

function planForProduct(env: Env, productId: string): Plan | null {
  if (productId === env.POLAR_PRO_MONTHLY_PRODUCT_ID || productId === env.POLAR_PRO_YEARLY_PRODUCT_ID) return "pro"
  if (productId === env.POLAR_TEAM_MONTHLY_PRODUCT_ID || productId === env.POLAR_TEAM_YEARLY_PRODUCT_ID) return "team"
  return null
}

async function processOne(db: Database, env: Env, eventId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(billingEvents).where(eq(billingEvents.id, eventId)).limit(1)
    if (row?.status !== "processing") return
    const webhook = parseBillingWebhookEvent(row.payload)
    const subscription = webhook.data
    const [settings] = await tx
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, row.organizationId))
      .limit(1)
      .for("update")
    if (settings === undefined) throw new Error("Billing event organization has no settings row.")

    const providerEventAt = new Date(webhook.timestamp)
    const processedAt = new Date()
    if (
      settings.billingProviderEventAt !== null &&
      settings.billingProviderEventAt.getTime() > providerEventAt.getTime()
    ) {
      await tx
        .update(billingEvents)
        .set({ status: "processed", processedAt, lastError: null })
        .where(eq(billingEvents.id, row.id))
      return
    }

    const revoked = webhook.type === "subscription.revoked"
    const plan = planForProduct(env, subscription.product_id)
    if (!revoked && plan === null) throw new Error(`Unknown Polar product '${subscription.product_id}'.`)

    const before = { plan: settings.plan, plan_source: settings.planSource }
    const preserveComplimentary = settings.planSource === "complimentary"
    const nextPlan = preserveComplimentary ? settings.plan : revoked ? "free" : plan ?? "free"
    const nextSource = preserveComplimentary ? settings.planSource : revoked ? "free" : "billing"
    await tx
      .update(organizationSettings)
      .set({
        plan: nextPlan,
        planSource: nextSource,
        billingCustomerId: subscription.customer_id,
        billingSubscriptionId: subscription.id,
        billingSubscriptionStatus: subscription.status,
        billingCurrentPeriodEnd: new Date(subscription.current_period_end),
        billingCancelAtPeriodEnd: subscription.cancel_at_period_end,
        billingProviderEventAt: providerEventAt,
        updatedAt: processedAt,
      })
      .where(eq(organizationSettings.organizationId, row.organizationId))

    if (before.plan !== nextPlan || before.plan_source !== nextSource) {
      await tx.insert(events).values({
        id: newId("ev"),
        organizationId: row.organizationId,
        type: "organization.plan.changed",
        subject: { organization_id: row.organizationId },
        data: {
          before,
          after: { plan: nextPlan, plan_source: nextSource },
          reason: webhook.type,
        },
      })
    }
    await tx
      .update(billingEvents)
      .set({ status: "processed", processedAt, lastError: null })
      .where(eq(billingEvents.id, row.id))
  })
}

export async function runBillingEventSweep(db: Database, env: Env, logger: Logger): Promise<void> {
  const now = new Date()
  await db
    .update(billingEvents)
    .set({ status: "pending" })
    .where(and(eq(billingEvents.status, "processing"), lte(billingEvents.nextAttemptAt, now)))
  const pending = await db
    .select({ id: billingEvents.id })
    .from(billingEvents)
    .where(and(eq(billingEvents.status, "pending"), lte(billingEvents.nextAttemptAt, now)))
    .orderBy(asc(billingEvents.createdAt))
    .limit(20)

  for (const candidate of pending) {
    const [claimed] = await db
      .update(billingEvents)
      .set({
        status: "processing",
        attempts: sql`${billingEvents.attempts} + 1`,
        nextAttemptAt: new Date(now.getTime() + 5 * 60_000),
      })
      .where(and(eq(billingEvents.id, candidate.id), eq(billingEvents.status, "pending")))
      .returning({ id: billingEvents.id, attempts: billingEvents.attempts })
    if (claimed === undefined) continue
    try {
      await processOne(db, env, claimed.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown billing event error."
      const delayMinutes = Math.min(60, 2 ** Math.min(claimed.attempts, 5))
      await db
        .update(billingEvents)
        .set({
          status: "pending",
          lastError: message,
          nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
        })
        .where(eq(billingEvents.id, claimed.id))
      logger.warn({ err: error, billing_event_id: claimed.id }, "billing event processing failed")
    }
  }
}
