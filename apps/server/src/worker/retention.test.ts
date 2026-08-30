import { newId } from "@postbag/core"
import {
  forms,
  objectDeletions,
  organization,
  organizationSettings,
  submissionAttachments,
  submissions,
  type Database,
} from "@postbag/db"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  buildHarness,
  seedOrganization,
  TEST_DATABASE_URL,
  type TestHarness,
} from "../testUtils.js"
import { runRetentionSweep } from "./housekeeping.js"
import { runObjectDeletionSweep } from "./objectDeletion.js"
import type { ObjectStorage } from "../lib/objectStorage.js"
import { retainedAttachmentStorageBytes } from "../lib/planUsage.js"

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
    const expiredAttachmentId = newId("fl")
    const expiredStorageKey = `attachments/${expiredAttachmentId}`

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
      await db.insert(submissionAttachments).values({
        id: expiredAttachmentId,
        organizationId: shortRetention.organizationId,
        formId: shortFormId,
        submissionId: expiredRegularId,
        fieldName: "file",
        filename: "expired.txt",
        contentType: "text/plain",
        sizeBytes: 7,
        sha256: "0".repeat(64),
        storageKey: expiredStorageKey,
      })

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

      const [queued] = await db
        .select()
        .from(objectDeletions)
        .where(eq(objectDeletions.storageKey, expiredStorageKey))
      expect(queued).toBeDefined()
      expect(await retainedAttachmentStorageBytes(db, shortRetention.organizationId)).toBe(7)
      const deletedKeys: string[] = []
      const storage: ObjectStorage = {
        put: () => Promise.resolve(),
        signedDownloadUrl: () => Promise.resolve("https://storage.example/signed"),
        delete(key) {
          deletedKeys.push(key)
          return Promise.resolve()
        },
      }
      await runObjectDeletionSweep(db, storage, harness.logger)
      expect(deletedKeys).toContain(expiredStorageKey)
      const remaining = await db
        .select()
        .from(objectDeletions)
        .where(eq(objectDeletions.storageKey, expiredStorageKey))
      expect(remaining).toHaveLength(0)
      expect(await retainedAttachmentStorageBytes(db, shortRetention.organizationId)).toBe(0)
    } finally {
      await db.delete(organization).where(eq(organization.id, shortRetention.organizationId))
      await db.delete(organization).where(eq(organization.id, defaultRetention.organizationId))
    }
  })

  it("retains a failed object deletion and succeeds on retry", async () => {
    const storageKey = `attachments/${newId("fl")}`
    await db
      .insert(objectDeletions)
      .values({
        storageKey,
        organizationId: "org_deletion_retry",
        sizeBytes: 0,
        nextAttemptAt: new Date(0),
      })
    let shouldFail = true
    const storage: ObjectStorage = {
      put: () => Promise.resolve(),
      signedDownloadUrl: () => Promise.resolve("https://storage.example/signed"),
      delete() {
        if (shouldFail) return Promise.reject(new Error("temporary storage outage"))
        return Promise.resolve()
      },
    }

    await runObjectDeletionSweep(db, storage, harness.logger)
    const [deferred] = await db
      .select()
      .from(objectDeletions)
      .where(eq(objectDeletions.storageKey, storageKey))
    expect(deferred).toMatchObject({ attempts: 1, lastError: "temporary storage outage" })

    shouldFail = false
    await db
      .update(objectDeletions)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(objectDeletions.storageKey, storageKey))
    await runObjectDeletionSweep(db, storage, harness.logger)
    const remaining = await db
      .select()
      .from(objectDeletions)
      .where(eq(objectDeletions.storageKey, storageKey))
    expect(remaining).toHaveLength(0)
  })
})
