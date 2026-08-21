import { events, organization, organizationSettings, type Database } from "@postbag/db"
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { buildHarness, seedOrganization, TEST_DATABASE_URL, type TestHarness } from "../testUtils.js"
import { runPlanExpirySweep } from "./housekeeping.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

// Job K expiry housekeeping: the same 10-minute loop that re-infers observe-mode schemas
// also reverts a complimentary org whose plan_expires_at has passed back to free/free,
// clears plan_note, and emits organization.plan.changed — see worker/housekeeping.ts.
integration("runPlanExpirySweep", () => {
  let harness: TestHarness
  let db: Database

  beforeAll(() => {
    harness = buildHarness()
    db = harness.db
  })

  afterAll(async () => {
    await harness.close()
  })

  it("reverts an expired complimentary org to free/free and clears plan_note, then emits organization.plan.changed", async () => {
    const seeded = await seedOrganization(db, "Expiring Org")
    try {
      await db
        .update(organizationSettings)
        .set({
          plan: "pro",
          planSource: "complimentary",
          planNote: "Courtesy of Postbag",
          planExpiresAt: new Date(Date.now() - 60_000),
        })
        .where(eq(organizationSettings.organizationId, seeded.organizationId))

      await runPlanExpirySweep(db, harness.logger)

      const [settings] = await db
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, seeded.organizationId))
        .limit(1)
      expect(settings?.plan).toBe("free")
      expect(settings?.planSource).toBe("free")
      expect(settings?.planNote).toBeNull()
      expect(settings?.planExpiresAt).toBeNull()

      const eventRows = await db
        .select()
        .from(events)
        .where(and(eq(events.organizationId, seeded.organizationId), eq(events.type, "organization.plan.changed")))
      expect(eventRows).toHaveLength(1)
      const data = eventRows[0]?.data as { before: { plan: string }; after: { plan: string }; reason: string }
      expect(data.before.plan).toBe("pro")
      expect(data.after.plan).toBe("free")
      expect(data.reason).toBe("complimentary_expired")
    } finally {
      await db.delete(organization).where(eq(organization.id, seeded.organizationId))
    }
  })

  it("leaves a non-expired complimentary org untouched", async () => {
    const seeded = await seedOrganization(db, "Not Yet Expiring Org")
    try {
      await db
        .update(organizationSettings)
        .set({ plan: "team", planSource: "complimentary", planExpiresAt: new Date(Date.now() + 60 * 60_000) })
        .where(eq(organizationSettings.organizationId, seeded.organizationId))

      await runPlanExpirySweep(db, harness.logger)

      const [settings] = await db
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, seeded.organizationId))
        .limit(1)
      expect(settings?.plan).toBe("team")
      expect(settings?.planSource).toBe("complimentary")
    } finally {
      await db.delete(organization).where(eq(organization.id, seeded.organizationId))
    }
  })

  it("leaves a billing org untouched even if plan_expires_at happens to be set and past", async () => {
    const seeded = await seedOrganization(db, "Billing Org")
    try {
      await db
        .update(organizationSettings)
        .set({ plan: "pro", planSource: "billing", planExpiresAt: new Date(Date.now() - 60_000) })
        .where(eq(organizationSettings.organizationId, seeded.organizationId))

      await runPlanExpirySweep(db, harness.logger)

      const [settings] = await db
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, seeded.organizationId))
        .limit(1)
      expect(settings?.plan).toBe("pro")
      expect(settings?.planSource).toBe("billing")
    } finally {
      await db.delete(organization).where(eq(organization.id, seeded.organizationId))
    }
  })
})
