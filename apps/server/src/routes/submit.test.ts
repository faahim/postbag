import { newId } from "@postbag/core"
import {
  deliveries,
  destinations,
  forms,
  objectDeletions,
  organization,
  organizationSettings,
  routes,
  submissionAttachments,
  submissions,
  type Database,
} from "@postbag/db"
import { desc, eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  buildHarness,
  seedOrganization,
  TEST_DATABASE_URL,
  type TestHarness,
} from "../testUtils.js"
import type { ObjectStorage, StoredFile } from "../lib/objectStorage.js"
import { retainedAttachmentStorageBytes } from "../lib/planUsage.js"
import { runObjectDeletionSweep } from "../worker/objectDeletion.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

integration("submit path", () => {
  let harness: TestHarness
  let db: Database
  let organizationId: string
  let projectId: string
  const storedObjects = new Map<string, StoredFile>()
  let failNextStorageWrite = false
  let failStorageWriteAtCount: number | null = null
  let persistThenFailNextStorageWrite = false
  let failNextStorageDelete = false
  let storageWriteGate: Promise<void> | null = null
  let storagePutCount = 0
  const storage: ObjectStorage = {
    async put(file) {
      storagePutCount += 1
      if (storagePutCount === failStorageWriteAtCount) {
        failStorageWriteAtCount = null
        throw new Error("simulated later storage outage")
      }
      if (failNextStorageWrite) {
        failNextStorageWrite = false
        throw new Error("simulated storage outage")
      }
      storedObjects.set(file.key, file)
      if (persistThenFailNextStorageWrite) {
        persistThenFailNextStorageWrite = false
        throw new Error("simulated ambiguous storage outcome")
      }
      if (storageWriteGate !== null) await storageWriteGate
    },
    delete(key) {
      if (failNextStorageDelete) {
        failNextStorageDelete = false
        return Promise.reject(new Error("simulated deletion outage"))
      }
      storedObjects.delete(key)
      return Promise.resolve()
    },
    signedDownloadUrl(key) {
      return Promise.resolve(`https://storage.example/${key}?signed=true`)
    },
  }

  beforeAll(async () => {
    harness = buildHarness({}, {}, undefined, storage)
    db = harness.db
    const seeded = await seedOrganization(db, "Submit Org")
    organizationId = seeded.organizationId
    projectId = seeded.projectId
  })

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, organizationId))
    for (const storageKey of storedObjects.keys()) {
      await db.delete(objectDeletions).where(eq(objectDeletions.storageKey, storageKey))
    }
    storedObjects.clear()
    await harness.close()
  })

  async function createForm(overrides: Partial<typeof forms.$inferInsert> = {}) {
    const [form] = await db
      .insert(forms)
      .values({
        id: newId("fm"),
        organizationId,
        projectId,
        slug: `f-${newId("fm").slice(-8)}`,
        name: "Test form",
        ...overrides,
      })
      .returning()
    if (form === undefined) throw new Error("failed to create form")
    return form
  }

  function concurrentRequest(path: string, init: RequestInit): Promise<Response> {
    return Promise.resolve().then(() => harness.app.request(path, init))
  }

  async function waitForStoredObjects(expected: number): Promise<void> {
    const deadline = Date.now() + 5_000
    while (storedObjects.size < expected) {
      if (Date.now() > deadline) throw new Error("Timed out waiting for storage writes.")
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }

  async function submissionResponseBody(response: Response): Promise<{
    readonly submission_id: string
    readonly status: "received" | "quarantined"
  }> {
    const body: unknown = await response.json()
    if (
      typeof body !== "object" ||
      body === null ||
      !("submission_id" in body) ||
      !("status" in body) ||
      typeof body.submission_id !== "string" ||
      (body.status !== "received" && body.status !== "quarantined")
    ) {
      throw new Error("Unexpected submission response body.")
    }
    return { submission_id: body.submission_id, status: body.status }
  }

  it("stores a JSON submission and responds with ok + submission_id", async () => {
    const form = await createForm()
    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ada@example.com", message: "hello" }),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean; submission_id: string; status: string }
    expect(body.ok).toBe(true)
    expect(body.status).toBe("received")
    const [row] = await db.select().from(submissions).where(eq(submissions.id, body.submission_id))
    expect(row?.data).toEqual({ email: "ada@example.com", message: "hello" })
  })

  it("stores a urlencoded submission and redirects to the thanks page", async () => {
    const form = await createForm()
    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "text/html" },
      body: new URLSearchParams({ email: "bob@example.com" }).toString(),
    })
    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe(`/s/${form.id}/thanks`)
  })

  it("preserves a body redirect on an HTML header-key replay", async () => {
    const form = await createForm()
    const headers = {
      "content-type": "application/x-www-form-urlencoded",
      "idempotency-key": "html-redirect-replay",
    }
    const first = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers,
      body: new URLSearchParams({ message: "first", _redirect: "https://example.com/first" }),
    })
    expect(first.status).toBe(303)
    expect(first.headers.get("location")).toBe("https://example.com/first")

    const replay = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers,
      body: new URLSearchParams({ message: "ignored", _redirect: "https://example.com/replay" }),
    })
    expect(replay.status).toBe(303)
    expect(replay.headers.get("location")).toBe("https://example.com/replay")
  })

  it("stores multipart text and file fields with durable metadata", async () => {
    const form = await createForm()
    const multipart = new FormData()
    multipart.set("email", "files@example.com")
    multipart.set("screenshot", new File(["image bytes"], "screen.png", { type: "image/png" }))
    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { accept: "application/json" },
      body: multipart,
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      submission_id: string
      attachments: { id: string }[]
    }
    expect(body.attachments).toHaveLength(1)
    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, body.submission_id))
    expect(submission?.data).toEqual({
      email: "files@example.com",
      screenshot: body.attachments[0]?.id,
    })
    const attachmentId = body.attachments[0]?.id
    if (attachmentId === undefined) throw new Error("missing attachment id")
    const [attachment] = await db
      .select()
      .from(submissionAttachments)
      .where(eq(submissionAttachments.id, attachmentId))
    if (attachment === undefined) throw new Error("missing attachment row")
    expect(attachment).toMatchObject({
      submissionId: body.submission_id,
      fieldName: "screenshot",
      filename: "screen.png",
      contentType: "image/png",
      sizeBytes: 11,
    })
    expect(storedObjects.has(attachment.storageKey)).toBe(true)
  })

  it("rejects an oversized attachment before accepting a Submission", async () => {
    const form = await createForm()
    const multipart = new FormData()
    multipart.set(
      "file",
      new File([new Uint8Array(2 * 1024 * 1024 + 1)], "too-large.bin", {
        type: "application/octet-stream",
      }),
    )
    const before = await db.select().from(submissions).where(eq(submissions.formId, form.id))
    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { accept: "application/json" },
      body: multipart,
    })
    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ error: { code: "attachment_too_large" } })
    const after = await db.select().from(submissions).where(eq(submissions.formId, form.id))
    expect(after).toHaveLength(before.length)
  })

  it("does not issue a receipt when private storage fails", async () => {
    const form = await createForm()
    const multipart = new FormData()
    multipart.set("file", new File(["important"], "important.txt", { type: "text/plain" }))
    failNextStorageWrite = true
    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { accept: "application/json" },
      body: multipart,
    })
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      error: { code: "attachment_storage_unavailable" },
    })
    const rows = await db.select().from(submissions).where(eq(submissions.formId, form.id))
    expect(rows).toHaveLength(0)
  })

  it("cleans an object when storage persists it before reporting failure", async () => {
    const form = await createForm()
    const multipart = new FormData()
    multipart.set("file", new File(["ambiguous"], "ambiguous.txt", { type: "text/plain" }))
    const objectsBefore = storedObjects.size
    persistThenFailNextStorageWrite = true
    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { accept: "application/json" },
      body: multipart,
    })
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      error: { code: "attachment_storage_unavailable" },
    })
    expect(storedObjects.size).toBe(objectsBefore)
    const rows = await db.select().from(submissions).where(eq(submissions.formId, form.id))
    expect(rows).toHaveLength(0)
  })

  it("releases reservations for files not attempted after a later upload fails", async () => {
    const form = await createForm()
    const retainedBefore = await retainedAttachmentStorageBytes(db, organizationId)
    const objectsBefore = storedObjects.size
    const multipart = new FormData()
    multipart.set("first", new File(["first"], "first.txt", { type: "text/plain" }))
    multipart.set("second", new File(["second"], "second.txt", { type: "text/plain" }))
    multipart.set("third", new File(["third"], "third.txt", { type: "text/plain" }))
    failStorageWriteAtCount = storagePutCount + 2

    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { accept: "application/json" },
      body: multipart,
    })
    expect(response.status).toBe(503)
    expect(storedObjects.size).toBe(objectsBefore)
    expect(await retainedAttachmentStorageBytes(db, organizationId)).toBe(retainedBefore)
    const rows = await db.select().from(submissions).where(eq(submissions.formId, form.id))
    expect(rows).toHaveLength(0)
  })

  it("charges a failed cleanup before another upload can use the capacity", async () => {
    const form = await createForm()
    const retainedBefore = await retainedAttachmentStorageBytes(db, organizationId)
    const multipart = new FormData()
    multipart.set("file", new File(["ambiguous"], "ambiguous.txt", { type: "text/plain" }))
    persistThenFailNextStorageWrite = true
    failNextStorageDelete = true

    const failed = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { accept: "application/json" },
      body: multipart,
    })
    expect(failed.status).toBe(503)

    const [queued] = await db
      .select()
      .from(objectDeletions)
      .where(eq(objectDeletions.organizationId, organizationId))
      .orderBy(desc(objectDeletions.createdAt))
      .limit(1)
    expect(queued).toMatchObject({ organizationId, sizeBytes: 9 })
    if (queued === undefined) throw new Error("missing cleanup reservation")
    expect(await retainedAttachmentStorageBytes(db, organizationId)).toBe(retainedBefore + 9)

    try {
      await db
        .update(organizationSettings)
        .set({ limits: { attachment_storage_bytes: retainedBefore + 9 } })
        .where(eq(organizationSettings.organizationId, organizationId))
      const next = new FormData()
      next.set("file", new File(["x"], "next.txt", { type: "text/plain" }))
      const rejected = await harness.app.request(`/s/${form.id}`, {
        method: "POST",
        headers: { accept: "application/json" },
        body: next,
      })
      expect(rejected.status).toBe(402)
      expect(await rejected.json()).toMatchObject({
        error: { code: "attachment_storage_limit_reached" },
      })
    } finally {
      storedObjects.delete(queued.storageKey)
      await db.delete(objectDeletions).where(eq(objectDeletions.storageKey, queued.storageKey))
      await db
        .update(organizationSettings)
        .set({ limits: {} })
        .where(eq(organizationSettings.organizationId, organizationId))
    }
  })

  it("returns the same file receipt for an idempotent multipart replay", async () => {
    const form = await createForm()
    const makeBody = () => {
      const multipart = new FormData()
      multipart.set("file", new File([], "same.txt", { type: "text/plain" }))
      return multipart
    }
    const first = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { accept: "application/json", "idempotency-key": "file-replay" },
      body: makeBody(),
    })
    const firstBody = (await first.json()) as {
      submission_id: string
      attachments: { id: string }[]
    }
    const second = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { accept: "application/json", "idempotency-key": "file-replay" },
      body: makeBody(),
    })
    const secondBody = (await second.json()) as {
      submission_id: string
      idempotent: boolean
      attachments: { id: string }[]
    }
    expect(secondBody).toMatchObject({ submission_id: firstBody.submission_id, idempotent: true })
    expect(secondBody.attachments).toEqual(firstBody.attachments)
    const rows = await db
      .select()
      .from(submissionAttachments)
      .where(eq(submissionAttachments.submissionId, firstBody.submission_id))
    expect(rows).toHaveLength(1)

    await db
      .update(organizationSettings)
      .set({ limits: { attachment_max_bytes: 1 } })
      .where(eq(organizationSettings.organizationId, organizationId))
    const noStorageHarness = buildHarness({}, {}, undefined, null)
    try {
      const afterLimitChange = await noStorageHarness.app.request(`/s/${form.id}`, {
        method: "POST",
        headers: { accept: "application/json", "idempotency-key": "file-replay" },
        body: makeBody(),
      })
      expect(afterLimitChange.status).toBe(200)
      expect(await afterLimitChange.json()).toMatchObject({
        submission_id: firstBody.submission_id,
        idempotent: true,
        attachments: firstBody.attachments,
      })
    } finally {
      await noStorageHarness.close()
      await db
        .update(organizationSettings)
        .set({ limits: {} })
        .where(eq(organizationSettings.organizationId, organizationId))
    }
  })

  it("does not upload a losing concurrent idempotent multipart replay", async () => {
    const form = await createForm()
    const makeBody = () => {
      const multipart = new FormData()
      multipart.set("file", new File([], "same.txt", { type: "text/plain" }))
      multipart.set("preview", new File(["x"], "preview.txt", { type: "text/plain" }))
      return multipart
    }
    let releaseWrites: (() => void) | undefined
    storageWriteGate = new Promise<void>((resolve) => {
      releaseWrites = resolve
    })
    const beforeObjects = storedObjects.size
    const putsBefore = storagePutCount
    const requests = [
      concurrentRequest(`/s/${form.id}`, {
        method: "POST",
        headers: { accept: "application/json", "idempotency-key": "file-race" },
        body: makeBody(),
      }),
      concurrentRequest(`/s/${form.id}`, {
        method: "POST",
        headers: { accept: "application/json", "idempotency-key": "file-race" },
        body: makeBody(),
      }),
    ]
    try {
      await waitForStoredObjects(beforeObjects + 1)
    } finally {
      releaseWrites?.()
      storageWriteGate = null
    }
    const responses = await Promise.all(requests)
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    const bodies = (await Promise.all(responses.map((response) => response.json()))) as {
      submission_id: string
      idempotent?: boolean
      attachments: { id: string }[]
    }[]
    expect(new Set(bodies.map((body) => body.submission_id)).size).toBe(1)
    expect(bodies.some((body) => body.idempotent === true)).toBe(true)
    expect(storedObjects.size).toBe(beforeObjects + 2)
    expect(storagePutCount).toBe(putsBefore + 2)
    const winningSubmissionId = bodies[0]?.submission_id
    if (winningSubmissionId === undefined) throw new Error("missing winning submission")
    const rows = await db
      .select()
      .from(submissionAttachments)
      .where(eq(submissionAttachments.submissionId, winningSubmissionId))
    expect(rows).toHaveLength(2)
  })

  it("does not deadlock the database pool during concurrent attachment uploads", async () => {
    const form = await createForm()
    let releaseWrites: (() => void) | undefined
    storageWriteGate = new Promise<void>((resolve) => {
      releaseWrites = resolve
    })
    const beforeObjects = storedObjects.size
    const requests = Array.from({ length: 10 }, (_, index) => {
      const multipart = new FormData()
      multipart.set("file", new File([], `pool-${String(index)}.txt`, { type: "text/plain" }))
      return concurrentRequest(`/s/${form.id}`, {
        method: "POST",
        headers: { accept: "application/json" },
        body: multipart,
      })
    })
    try {
      await waitForStoredObjects(beforeObjects + 10)
      const probe = await Promise.race([
        db.select({ id: forms.id }).from(forms).where(eq(forms.id, form.id)),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => {
            reject(new Error("Database pool was exhausted by uploads."))
          }, 1_000)
        }),
      ])
      expect(probe).toEqual([{ id: form.id }])
    } finally {
      releaseWrites?.()
      storageWriteGate = null
    }
    const responses = await Promise.all(requests)
    expect(responses.every((response) => response.status === 200)).toBe(true)
  })

  it("refuses to commit when a deletion sweep claims an expired upload reservation", async () => {
    const form = await createForm()
    const multipart = new FormData()
    multipart.set("file", new File(["slow upload"], "slow.txt", { type: "text/plain" }))
    let releaseWrite: (() => void) | undefined
    storageWriteGate = new Promise<void>((resolve) => {
      releaseWrite = resolve
    })
    const beforeObjects = storedObjects.size
    const request = concurrentRequest(`/s/${form.id}`, {
      method: "POST",
      headers: { accept: "application/json" },
      body: multipart,
    })
    try {
      await waitForStoredObjects(beforeObjects + 1)
      const [reservation] = await db
        .select()
        .from(objectDeletions)
        .where(eq(objectDeletions.organizationId, organizationId))
        .orderBy(desc(objectDeletions.createdAt))
        .limit(1)
      expect(reservation?.uploadReservation).toBe(true)
      if (reservation === undefined) throw new Error("missing active upload reservation")
      await db
        .update(objectDeletions)
        .set({ nextAttemptAt: new Date(0) })
        .where(eq(objectDeletions.storageKey, reservation.storageKey))
      await runObjectDeletionSweep(db, storage, harness.logger)
    } finally {
      releaseWrite?.()
      storageWriteGate = null
    }
    const response = await request
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      error: { code: "attachment_storage_unavailable" },
    })
    expect(storedObjects.size).toBe(beforeObjects)
    const rows = await db.select().from(submissions).where(eq(submissions.formId, form.id))
    expect(rows).toHaveLength(0)
  })

  it("rejects retained-byte overage without leaving an object", async () => {
    const form = await createForm()
    await db
      .update(organizationSettings)
      .set({ limits: { attachment_storage_bytes: 1 } })
      .where(eq(organizationSettings.organizationId, organizationId))
    const objectsBefore = storedObjects.size
    const multipart = new FormData()
    multipart.set("file", new File(["too many bytes"], "over.txt", { type: "text/plain" }))
    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { accept: "application/json" },
      body: multipart,
    })
    expect(response.status).toBe(402)
    expect(await response.json()).toMatchObject({
      error: { code: "attachment_storage_limit_reached" },
    })
    expect(storedObjects.size).toBe(objectsBefore)
    await db
      .update(organizationSettings)
      .set({ limits: {} })
      .where(eq(organizationSettings.organizationId, organizationId))
  })

  it("serializes concurrent retained-byte admission", async () => {
    const form = await createForm()
    const usedBytes = await retainedAttachmentStorageBytes(db, organizationId)
    await db
      .update(organizationSettings)
      .set({ limits: { attachment_storage_bytes: usedBytes + 10 } })
      .where(eq(organizationSettings.organizationId, organizationId))
    const makeBody = (name: string) => {
      const multipart = new FormData()
      multipart.set("file", new File(["123456"], name, { type: "text/plain" }))
      return multipart
    }
    let releaseWrites: (() => void) | undefined
    storageWriteGate = new Promise<void>((resolve) => {
      releaseWrites = resolve
    })
    const beforeObjects = storedObjects.size
    const requests = [
      concurrentRequest(`/s/${form.id}`, {
        method: "POST",
        headers: { accept: "application/json" },
        body: makeBody("one.txt"),
      }),
      concurrentRequest(`/s/${form.id}`, {
        method: "POST",
        headers: { accept: "application/json" },
        body: makeBody("two.txt"),
      }),
    ]
    try {
      try {
        await waitForStoredObjects(beforeObjects + 1)
      } finally {
        releaseWrites?.()
        storageWriteGate = null
      }
      const responses = await Promise.all(requests)
      expect(responses.map((response) => response.status).sort()).toEqual([200, 402])
      expect(storedObjects.size).toBe(beforeObjects + 1)
    } finally {
      await db
        .update(organizationSettings)
        .set({ limits: {} })
        .where(eq(organizationSettings.organizationId, organizationId))
    }
  })

  it("accepts a multipart request near the aggregate ceiling on Team", async () => {
    const form = await createForm()
    await db
      .update(organizationSettings)
      .set({ plan: "team", limits: {} })
      .where(eq(organizationSettings.organizationId, organizationId))
    try {
      const multipart = new FormData()
      multipart.set(
        "file",
        new File([new Uint8Array(15 * 1024 * 1024)], "maximum.bin", {
          type: "application/octet-stream",
        }),
      )
      const response = await harness.app.request(`/s/${form.id}`, {
        method: "POST",
        headers: { accept: "application/json" },
        body: multipart,
      })
      expect(response.status).toBe(200)
    } finally {
      await db
        .update(organizationSettings)
        .set({ plan: "free", limits: {} })
        .where(eq(organizationSettings.organizationId, organizationId))
    }
  }, 30_000)

  it("enqueues object deletion when a Submission with a file is deleted", async () => {
    const form = await createForm()
    const multipart = new FormData()
    multipart.set("file", new File(["delete me"], "delete.txt", { type: "text/plain" }))
    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { accept: "application/json" },
      body: multipart,
    })
    const body = (await response.json()) as {
      submission_id: string
      attachments: { id: string }[]
    }
    const attachmentId = body.attachments[0]?.id
    if (attachmentId === undefined) throw new Error("missing attachment id")
    const [attachment] = await db
      .select()
      .from(submissionAttachments)
      .where(eq(submissionAttachments.id, attachmentId))
    if (attachment === undefined) throw new Error("missing attachment row")
    const retainedBefore = await retainedAttachmentStorageBytes(db, organizationId)
    await db.delete(submissions).where(eq(submissions.id, body.submission_id))
    const [queued] = await db
      .select()
      .from(objectDeletions)
      .where(eq(objectDeletions.storageKey, attachment.storageKey))
    expect(queued).toMatchObject({
      organizationId,
      sizeBytes: attachment.sizeBytes,
    })
    expect(await retainedAttachmentStorageBytes(db, organizationId)).toBe(retainedBefore)
  })

  it("marks honeypot-filled submissions as spam but still stores them", async () => {
    const form = await createForm()
    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "spammer@example.com", _gotcha: "I am a bot" }),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { status: string; submission_id: string }
    expect(body.status).toBe("spam")
    const [row] = await db.select().from(submissions).where(eq(submissions.id, body.submission_id))
    expect(row?.status).toBe("spam")
    expect(row?.spam).toMatchObject({ score: 1 })
  })

  it("stores paused-form submissions without creating deliveries", async () => {
    const form = await createForm({ status: "paused" })
    const destination = await db
      .insert(destinations)
      .values({
        id: newId("ds"),
        organizationId,
        type: "webhook",
        name: "Hook",
        config: { url: "https://example.com" },
        verified: true,
      })
      .returning()
    const destinationRow = destination[0]
    if (destinationRow === undefined) throw new Error("failed to create destination")
    await db.insert(routes).values({
      id: newId("rt"),
      organizationId,
      formId: form.id,
      destinationId: destinationRow.id,
    })

    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "x@example.com" }),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { submission_id: string }
    const [row] = await db.select().from(submissions).where(eq(submissions.id, body.submission_id))
    expect(row).toBeDefined()

    await db.delete(routes).where(eq(routes.formId, form.id))
    await db.delete(destinations).where(eq(destinations.id, destinationRow.id))
  })

  it("returns the original submission id for a duplicate Idempotency-Key", async () => {
    const form = await createForm()
    const headers = { "content-type": "application/json", "idempotency-key": "key-123" }
    const first = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: "dup@example.com" }),
    })
    const firstBody = (await first.json()) as { submission_id: string }

    const second = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: "dup@example.com" }),
    })
    const secondBody = (await second.json()) as { submission_id: string; idempotent: boolean }
    expect(secondBody.submission_id).toBe(firstBody.submission_id)
    expect(secondBody.idempotent).toBe(true)
  })

  it("honours per-form allowed_origins for CORS", async () => {
    const form = await createForm({ settings: { allowed_origins: ["https://allowed.example"] } })

    const allowed = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://allowed.example" },
      body: JSON.stringify({ email: "a@example.com" }),
    })
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://allowed.example")
    expect(allowed.headers.get("vary")).toBe("Origin")

    const rejected = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ email: "b@example.com" }),
    })
    const rejectedBody = (await rejected.json()) as { status: string; submission_id: string }
    expect(rejectedBody.status).toBe("quarantined")
    const [row] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, rejectedBody.submission_id))
    expect(row?.quarantineReason).toBe("origin_rejected")
  })

  it("accepts a browser origin when the configured URL has a trailing slash", async () => {
    const form = await createForm({ settings: { allowed_origins: ["https://allowed.example/"] } })

    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://allowed.example" },
      body: JSON.stringify({ email: "human@example.com" }),
    })
    const body = (await response.json()) as { status: string; submission_id: string }

    expect(response.headers.get("access-control-allow-origin")).toBe("https://allowed.example")
    expect(body.status).toBe("received")
    const [row] = await db.select().from(submissions).where(eq(submissions.id, body.submission_id))
    expect(row?.quarantineReason).toBeNull()
  })

  it("returns * when allowed_origins is empty", async () => {
    const form = await createForm()
    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://anything.example" },
      body: JSON.stringify({ email: "c@example.com" }),
    })
    expect(response.headers.get("access-control-allow-origin")).toBe("*")
  })

  it("resolves the client ip from CF-Connecting-IP first, then X-Forwarded-For, then unknown", async () => {
    const formCf = await createForm()
    const cfResponse = await harness.app.request(`/s/${formCf.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.9",
        "x-forwarded-for": "198.51.100.1, 10.0.0.1",
      },
      body: JSON.stringify({ email: "cf@example.com" }),
    })
    const cfBody = (await cfResponse.json()) as { submission_id: string }
    const [cfRow] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, cfBody.submission_id))
    expect((cfRow?.meta as { ip?: string } | undefined)?.ip).toBe("203.0.113.9")

    const formXff = await createForm()
    const xffResponse = await harness.app.request(`/s/${formXff.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7, 10.0.0.1" },
      body: JSON.stringify({ email: "xff@example.com" }),
    })
    const xffBody = (await xffResponse.json()) as { submission_id: string }
    const [xffRow] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, xffBody.submission_id))
    expect((xffRow?.meta as { ip?: string } | undefined)?.ip).toBe("198.51.100.7")

    const formNone = await createForm()
    const noneResponse = await harness.app.request(`/s/${formNone.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "none@example.com" }),
    })
    const noneBody = (await noneResponse.json()) as { submission_id: string }
    const [noneRow] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, noneBody.submission_id))
    expect((noneRow?.meta as { ip?: string } | undefined)?.ip).toBe("unknown")
  })

  it("records CF-IPCountry as the submission's country", async () => {
    const form = await createForm()
    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-ipcountry": "SE" },
      body: JSON.stringify({ email: "se@example.com" }),
    })
    const body = (await response.json()) as { submission_id: string }
    const [row] = await db.select().from(submissions).where(eq(submissions.id, body.submission_id))
    expect((row?.meta as { country?: string } | undefined)?.country).toBe("SE")
  })

  it("rate-limits by the resolved CF-Connecting-IP, not X-Forwarded-For", async () => {
    const form = await createForm({ settings: { rate_limit: { per_minute: 1, burst: 1 } } })
    const headers = {
      "content-type": "application/json",
      "cf-connecting-ip": "203.0.113.55",
      "x-forwarded-for": "10.0.0.1",
    }
    const first = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: "1@example.com" }),
    })
    const firstBody = (await first.json()) as { status: string }
    expect(firstBody.status).toBe("received")

    const second = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { ...headers, "x-forwarded-for": "10.0.0.2" },
      body: JSON.stringify({ email: "2@example.com" }),
    })
    const secondBody = (await second.json()) as { status: string; submission_id: string }
    expect(secondBody.status).toBe("quarantined")
    const [row] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, secondBody.submission_id))
    expect(row?.quarantineReason).toBe("rate_limited")
  })

  it("returns 404 for an unknown form id", async () => {
    const response = await harness.app.request("/s/fm_doesnotexist1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(response.status).toBe(404)
  })

  it("uses the paid plan's default monthly submission limit", async () => {
    const form = await createForm()
    await db
      .update(organizationSettings)
      .set({ plan: "pro", planSource: "billing", limits: {} })
      .where(eq(organizationSettings.organizationId, organizationId))
    await db.insert(submissions).values(
      Array.from({ length: 1_000 }, (_, index) => ({
        id: newId("sb"),
        organizationId,
        formId: form.id,
        data: { index },
      })),
    )

    const response = await harness.app.request(`/s/${form.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "paid@example.com" }),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { status: string; submission_id: string }
    expect(body.status).toBe("received")
    const [row] = await db.select().from(submissions).where(eq(submissions.id, body.submission_id))
    expect(row?.quarantineReason).toBeNull()
  })

  it("stores concurrent submissions at the monthly limit and quarantines only the over-quota one", async () => {
    const limited = await seedOrganization(db, "Submission capacity concurrency")
    try {
      await db
        .update(organizationSettings)
        .set({ plan: "free", planSource: "free", limits: { submissions_per_month: 1 } })
        .where(eq(organizationSettings.organizationId, limited.organizationId))
      const [form] = await db
        .insert(forms)
        .values({
          id: newId("fm"),
          organizationId: limited.organizationId,
          projectId: limited.projectId,
          slug: "submission-capacity",
          name: "Submission capacity",
        })
        .returning()
      if (form === undefined) throw new Error("Failed to create submission-capacity form.")
      const [destination] = await db
        .insert(destinations)
        .values({
          id: newId("ds"),
          organizationId: limited.organizationId,
          type: "webhook",
          name: "Submission capacity destination",
          config: { url: "https://example.com/submission-capacity" },
          verified: true,
        })
        .returning()
      if (destination === undefined)
        throw new Error("Failed to create submission-capacity destination.")
      await db.insert(routes).values({
        id: newId("rt"),
        organizationId: limited.organizationId,
        formId: form.id,
        destinationId: destination.id,
      })

      const responses = await Promise.all(
        ["first@example.com", "second@example.com"].map((email) =>
          concurrentRequest(`/s/${form.id}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email }),
          }),
        ),
      )
      const responseBodies = await Promise.all(responses.map(submissionResponseBody))
      expect(responseBodies.map((body) => body.status).sort()).toEqual(["quarantined", "received"])

      const submissionRows = await db
        .select()
        .from(submissions)
        .where(eq(submissions.formId, form.id))
      expect(submissionRows).toHaveLength(2)
      expect(submissionRows.filter((row) => row.status === "received")).toHaveLength(1)
      const quarantined = submissionRows.filter((row) => row.status === "quarantined")
      expect(quarantined).toHaveLength(1)
      expect(quarantined[0]?.quarantineReason).toBe("over_quota")

      const submissionIds = responseBodies.map((body) => body.submission_id)
      const deliveryRows = await db
        .select()
        .from(deliveries)
        .where(inArray(deliveries.submissionId, submissionIds))
      expect(deliveryRows).toHaveLength(2)
      expect(new Set(deliveryRows.map((row) => row.submissionId))).toEqual(new Set(submissionIds))
    } finally {
      await db.delete(organization).where(eq(organization.id, limited.organizationId))
    }
  })
})
