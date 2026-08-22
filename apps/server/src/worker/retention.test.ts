import { newId } from "@postbag/core"
import { forms, organization, organizationSettings, submissions, type Database } from "@postbag/db"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { buildHarness, seedOrganization, TEST_DATABASE_URL, type TestHarness } from "../testUtils.js"
import { runRetentionSweep } from "./housekeeping.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

integration("runRetentionSweep", () => {
  let harness: TestHarness
  let db: Database

  beforeAll(() => {
    harness = buildHarness()
    db = harness.db
  })

  afterAll(async () => {
    await harness.close()
  })

  it("deletes each organization's expired regular and test submissions using its effective retention", async () => {
    // Given: two organizations with different effective retention, and submissions on both sides of each cutoff.
    const shortRetention = await seedOrganization(db, "Short retention")
    const defaultRetention = await seedOrganization(db, "Default retention")
    const shortFormId = newId("fm")
    const defaultFormId = newId("fm")
    const expiredRegularId = newId("sb")
    const retainedRegularId = newId("sb")
    const expiredTestId = newId("sb")
    const retainedTestId = newId("sb")
    const otherOrgSubmissionId = newId("sb")

    try {
      await db
        .update(organizationSettings)
        .set({ plan: "pro", limits: { retention_days: 2 } })
        .where(eq(organizationSettings.organizationId, shortRetention.organizationId))
      await db.insert(forms).values([
        {
          id: shortFormId,
          organizationId: shortRetention.organizationId,
          projectId: shortRetention.projectId,
          slug: "short-retention",
          name: "Short retention",
        },
        {
          id: defaultFormId,
          organizationId: defaultRetention.organizationId,
          projectId: defaultRetention.projectId,
          slug: "default-retention",
          name: "Default retention",
        },
      ])
      await db.insert(submissions).values([
        {
          id: expiredRegularId,
          organizationId: shortRetention.organizationId,
          formId: shortFormId,
          data: {},
          receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60_000),
        },
        {
          id: retainedRegularId,
          organizationId: shortRetention.organizationId,
          formId: shortFormId,
          data: {},
          receivedAt: new Date(Date.now() - 24 * 60 * 60_000),
        },
        {
          id: expiredTestId,
          organizationId: shortRetention.organizationId,
          formId: shortFormId,
          data: {},
          test: true,
          receivedAt: new Date(Date.now() - 25 * 60 * 60_000),
        },
        {
          id: retainedTestId,
          organizationId: shortRetention.organizationId,
          formId: shortFormId,
          data: {},
          test: true,
          receivedAt: new Date(Date.now() - 23 * 60 * 60_000),
        },
        {
          id: otherOrgSubmissionId,
          organizationId: defaultRetention.organizationId,
          formId: defaultFormId,
          data: {},
          receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60_000),
        },
      ])

      // When: the housekeeping retention sweep runs.
      await runRetentionSweep(db, harness.logger)

      // Then: only the short-retention org's expired rows are removed; test rows expire after 24 hours.
      const shortRows = await db
        .select({ id: submissions.id })
        .from(submissions)
        .where(eq(submissions.organizationId, shortRetention.organizationId))
      const shortIds = shortRows.map((row) => row.id)
      expect(shortIds).not.toContain(expiredRegularId)
      expect(shortIds).not.toContain(expiredTestId)
      expect(shortIds).toContain(retainedRegularId)
      expect(shortIds).toContain(retainedTestId)

      const otherRows = await db
        .select({ id: submissions.id })
        .from(submissions)
        .where(eq(submissions.organizationId, defaultRetention.organizationId))
      expect(otherRows.map((row) => row.id)).toContain(otherOrgSubmissionId)
    } finally {
      await db.delete(organization).where(eq(organization.id, shortRetention.organizationId))
      await db.delete(organization).where(eq(organization.id, defaultRetention.organizationId))
    }
  })
})
