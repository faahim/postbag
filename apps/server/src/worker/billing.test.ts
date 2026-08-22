import { billingEvents, events, organizationSettings, type Database } from "@postbag/db"
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { BillingWebhookEvent } from "../lib/billingProvider.js"
import { buildHarness, cleanupOrganization, seedOrganization, TEST_DATABASE_URL, type TestHarness } from "../testUtils.js"
import { runBillingEventSweep } from "./billing.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

type SubscriptionOverrides = {
  readonly type?: BillingWebhookEvent["type"]
  readonly productId?: string
  readonly status?: string
  readonly customerId?: string
  readonly subscriptionId?: string
  readonly currentPeriodEnd?: string
  readonly cancelAtPeriodEnd?: boolean
  readonly timestamp?: string
}

function subscriptionEvent(organizationId: string, overrides: SubscriptionOverrides = {}): BillingWebhookEvent {
  return {
    timestamp: overrides.timestamp ?? "2026-08-23T08:00:00.000Z",
    type: overrides.type ?? "subscription.active",
    data: {
      id: overrides.subscriptionId ?? "sub_test",
      status: overrides.status ?? "active",
      product_id: overrides.productId ?? "prod_pro_month",
      customer_id: overrides.customerId ?? "cus_test",
      current_period_end: overrides.currentPeriodEnd ?? "2026-09-23T00:00:00.000Z",
      cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
      customer: { external_id: organizationId },
    },
  }
}

integration("billing worker", () => {
  let harness: TestHarness
  let db: Database

  beforeAll(() => {
    harness = buildHarness({
      POLAR_PRO_MONTHLY_PRODUCT_ID: "prod_pro_month",
      POLAR_PRO_YEARLY_PRODUCT_ID: "prod_pro_year",
      POLAR_TEAM_MONTHLY_PRODUCT_ID: "prod_team_month",
      POLAR_TEAM_YEARLY_PRODUCT_ID: "prod_team_year",
    })
    db = harness.db
  })

  afterAll(async () => {
    await harness.close()
  })

  async function enqueue(organizationId: string, event: BillingWebhookEvent, providerEventId: string): Promise<void> {
    await db.insert(billingEvents).values({
      id: `be_${providerEventId}`,
      organizationId,
      providerEventId,
      type: event.type,
      payload: event,
      nextAttemptAt: new Date(),
    })
  }

  it("applies an active Pro subscription and stores its billing metadata", async () => {
    const seeded = await seedOrganization(db, "Billing Worker Pro Org")
    try {
      const periodEnd = "2026-09-23T00:00:00.000Z"
      await enqueue(
        seeded.organizationId,
        subscriptionEvent(seeded.organizationId, {
          subscriptionId: "sub_pro_active",
          customerId: "cus_pro_active",
          currentPeriodEnd: periodEnd,
        }),
        "evt_pro_active",
      )

      await runBillingEventSweep(db, harness.env, harness.logger)

      const [settings] = await db
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, seeded.organizationId))
      expect(settings?.plan).toBe("pro")
      expect(settings?.planSource).toBe("billing")
      expect(settings?.billingCustomerId).toBe("cus_pro_active")
      expect(settings?.billingSubscriptionId).toBe("sub_pro_active")
      expect(settings?.billingSubscriptionStatus).toBe("active")
      expect(settings?.billingCurrentPeriodEnd?.toISOString()).toBe(periodEnd)
      expect(settings?.billingCancelAtPeriodEnd).toBe(false)
    } finally {
      await cleanupOrganization(db, seeded.organizationId)
    }
  })

  it("does not apply a duplicate provider event twice", async () => {
    const seeded = await seedOrganization(db, "Billing Worker Duplicate Org")
    try {
      const event = subscriptionEvent(seeded.organizationId, { subscriptionId: "sub_duplicate" })
      await enqueue(seeded.organizationId, event, "evt_duplicate")
      await db
        .insert(billingEvents)
        .values({
          id: "be_evt_duplicate_copy",
          organizationId: seeded.organizationId,
          providerEventId: "evt_duplicate",
          type: event.type,
          payload: event,
          nextAttemptAt: new Date(),
        })
        .onConflictDoNothing({ target: billingEvents.providerEventId })

      await runBillingEventSweep(db, harness.env, harness.logger)
      await runBillingEventSweep(db, harness.env, harness.logger)

      const rows = await db
        .select()
        .from(billingEvents)
        .where(eq(billingEvents.providerEventId, "evt_duplicate"))
      expect(rows).toHaveLength(1)
      expect(rows[0]?.status).toBe("processed")

      const planEvents = await db
        .select()
        .from(events)
        .where(and(eq(events.organizationId, seeded.organizationId), eq(events.type, "organization.plan.changed")))
      expect(planEvents).toHaveLength(1)
    } finally {
      await cleanupOrganization(db, seeded.organizationId)
    }
  })

  it("downgrades a revoked billing subscription to free", async () => {
    const seeded = await seedOrganization(db, "Billing Worker Revoked Org")
    try {
      await db
        .update(organizationSettings)
        .set({ plan: "pro", planSource: "billing" })
        .where(eq(organizationSettings.organizationId, seeded.organizationId))
      await enqueue(
        seeded.organizationId,
        subscriptionEvent(seeded.organizationId, {
          type: "subscription.revoked",
          subscriptionId: "sub_revoked",
          status: "revoked",
        }),
        "evt_revoked",
      )

      await runBillingEventSweep(db, harness.env, harness.logger)

      const [settings] = await db
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, seeded.organizationId))
      expect(settings?.plan).toBe("free")
      expect(settings?.planSource).toBe("free")
    } finally {
      await cleanupOrganization(db, seeded.organizationId)
    }
  })

  it("does not let an older revoked event overwrite a newer active subscription", async () => {
    // Given: a newer Team activation has already set the organization's billing entitlement.
    const seeded = await seedOrganization(db, "Billing Worker Ordered Events Org")
    const newerTimestamp = "2026-08-23T10:00:00.000Z"
    const olderTimestamp = "2026-08-23T09:00:00.000Z"
    try {
      const newerActive = {
        ...subscriptionEvent(seeded.organizationId, {
          productId: "prod_team_month",
          subscriptionId: "sub_team_active",
          customerId: "cus_team_active",
          status: "active",
        }),
        timestamp: newerTimestamp,
      }
      await enqueue(seeded.organizationId, newerActive, "evt_team_active_newer")
      await runBillingEventSweep(db, harness.env, harness.logger)

      // When: an older Pro revocation arrives after the newer activation was processed.
      const olderRevoked = {
        ...subscriptionEvent(seeded.organizationId, {
          type: "subscription.revoked",
          productId: "prod_pro_month",
          subscriptionId: "sub_pro_revoked",
          customerId: "cus_pro_revoked",
          status: "revoked",
        }),
        timestamp: olderTimestamp,
      }
      await enqueue(seeded.organizationId, olderRevoked, "evt_pro_revoked_older")
      await runBillingEventSweep(db, harness.env, harness.logger)

      // Then: the stale event is recorded as processed without replacing newer billing metadata or entitlement.
      const [settings] = await db
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, seeded.organizationId))
      expect(settings?.plan).toBe("team")
      expect(settings?.planSource).toBe("billing")
      expect(settings?.billingCustomerId).toBe("cus_team_active")
      expect(settings?.billingSubscriptionId).toBe("sub_team_active")
      expect(settings?.billingProviderEventAt?.toISOString()).toBe(newerTimestamp)
      const eventRows = await db
        .select()
        .from(billingEvents)
        .where(eq(billingEvents.organizationId, seeded.organizationId))
      expect(eventRows.every((row) => row.status === "processed")).toBe(true)
    } finally {
      await cleanupOrganization(db, seeded.organizationId)
    }
  })

  it("preserves a complimentary plan while updating billing metadata", async () => {
    const seeded = await seedOrganization(db, "Billing Worker Complimentary Org")
    try {
      await db
        .update(organizationSettings)
        .set({ plan: "team", planSource: "complimentary", planNote: "Courtesy of Postbag" })
        .where(eq(organizationSettings.organizationId, seeded.organizationId))
      await enqueue(
        seeded.organizationId,
        subscriptionEvent(seeded.organizationId, {
          subscriptionId: "sub_complimentary",
          customerId: "cus_complimentary",
        }),
        "evt_complimentary",
      )

      await runBillingEventSweep(db, harness.env, harness.logger)

      const [settings] = await db
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, seeded.organizationId))
      expect(settings?.plan).toBe("team")
      expect(settings?.planSource).toBe("complimentary")
      expect(settings?.planNote).toBe("Courtesy of Postbag")
      expect(settings?.billingCustomerId).toBe("cus_complimentary")
      expect(settings?.billingSubscriptionId).toBe("sub_complimentary")
    } finally {
      await cleanupOrganization(db, seeded.organizationId)
    }
  })

  it("leaves an unknown product pending with a retry error", async () => {
    const seeded = await seedOrganization(db, "Billing Worker Unknown Product Org")
    try {
      const before = Date.now()
      await enqueue(
        seeded.organizationId,
        subscriptionEvent(seeded.organizationId, { productId: "prod_unknown" }),
        "evt_unknown_product",
      )

      await runBillingEventSweep(db, harness.env, harness.logger)

      const [row] = await db
        .select()
        .from(billingEvents)
        .where(eq(billingEvents.providerEventId, "evt_unknown_product"))
      expect(row?.status).toBe("pending")
      expect(row?.lastError).toContain("prod_unknown")
      expect(row?.nextAttemptAt.getTime()).toBeGreaterThan(before)
    } finally {
      await cleanupOrganization(db, seeded.organizationId)
    }
  })
})
