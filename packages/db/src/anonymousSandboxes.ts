import { PostbagError } from "@postbag/core"
import { and, asc, count, eq, gt, lt, sql } from "drizzle-orm"

import type { Database } from "./client.js"
import { anonymousSandboxes, anonymousSubmissions } from "./schema/anonymous.js"

export type AnonymousSandboxCreateInput = typeof anonymousSandboxes.$inferInsert

export type CreateAnonymousSandboxResult =
  | { readonly replayed: false; readonly sandbox: typeof anonymousSandboxes.$inferSelect }
  | { readonly replayed: true; readonly sandbox: typeof anonymousSandboxes.$inferSelect }

export async function createAnonymousSandbox(
  db: Database,
  input: AnonymousSandboxCreateInput,
  globalLimit: number,
  now = new Date(),
): Promise<CreateAnonymousSandboxResult> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('anonymous-create'), hashtext(${input.creationIdempotencyKeyHash}))`,
    )
    const [existing] = await tx
      .select()
      .from(anonymousSandboxes)
      .where(eq(anonymousSandboxes.creationIdempotencyKeyHash, input.creationIdempotencyKeyHash))
      .limit(1)
    if (existing !== undefined) {
      if (existing.requestBodyHash !== input.requestBodyHash) {
        throw new PostbagError(
          "idempotency_conflict",
          "That Idempotency-Key was already used with a different sandbox request.",
        )
      }
      return { replayed: true, sandbox: existing }
    }

    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('anonymous-global-capacity'))`)
    const [globalCount] = await tx
      .select({ value: count() })
      .from(anonymousSandboxes)
      .where(and(eq(anonymousSandboxes.status, "active"), gt(anonymousSandboxes.expiresAt, now)))
    if ((globalCount?.value ?? 0) >= globalLimit) {
      throw new PostbagError(
        "sandbox_capacity_reached",
        "Anonymous sandbox capacity is temporarily full.",
        { limit: globalLimit },
      )
    }

    const [sourceCount] = await tx
      .select({ value: count() })
      .from(anonymousSandboxes)
      .where(
        and(
          eq(anonymousSandboxes.abuseSourceKey, input.abuseSourceKey),
          eq(anonymousSandboxes.status, "active"),
          gt(anonymousSandboxes.expiresAt, now),
        ),
      )
    if ((sourceCount?.value ?? 0) >= 20) {
      throw new PostbagError("rate_limited", "This network already has 20 active sandboxes.", {
        active_limit: 20,
      })
    }

    const [created] = await tx.insert(anonymousSandboxes).values(input).returning()
    if (created === undefined) throw new Error("Failed to create anonymous sandbox.")
    return { replayed: false, sandbox: created }
  })
}

export async function getAnonymousSandboxByCapability(
  db: Database,
  sandboxId: string,
  tokenHash: string,
): Promise<{
  readonly sandbox: typeof anonymousSandboxes.$inferSelect
  readonly submissions: readonly (typeof anonymousSubmissions.$inferSelect)[]
} | null> {
  const [sandbox] = await db
    .select()
    .from(anonymousSandboxes)
    .where(and(eq(anonymousSandboxes.id, sandboxId), eq(anonymousSandboxes.tokenHash, tokenHash)))
    .limit(1)
  if (sandbox === undefined) return null
  const rows = await db
    .select()
    .from(anonymousSubmissions)
    .where(eq(anonymousSubmissions.sandboxId, sandboxId))
    .orderBy(asc(anonymousSubmissions.receivedAt))
    .limit(5)
  return { sandbox, submissions: rows }
}

export type AcceptAnonymousSubmissionResult =
  | { readonly kind: "accepted"; readonly submissionId: string; readonly idempotent: boolean }
  | {
      readonly kind: "unavailable"
      readonly status: string | null
      readonly expiresAt: Date | null
      readonly acceptedCount: number | null
    }

export async function acceptAnonymousSubmission(
  db: Database,
  input: {
    readonly sandboxId: string
    readonly data: Readonly<Record<string, unknown>>
    readonly meta: Readonly<Record<string, unknown>>
    readonly idempotencyKeyHash: string | null
    readonly receivedAt: Date
  },
): Promise<AcceptAnonymousSubmissionResult> {
  return db.transaction(async (tx) => {
    if (input.idempotencyKeyHash !== null) {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('anonymous-submit'), hashtext(${input.idempotencyKeyHash}))`,
      )
      const [existing] = await tx
        .select({ id: anonymousSubmissions.id })
        .from(anonymousSubmissions)
        .where(
          and(
            eq(anonymousSubmissions.sandboxId, input.sandboxId),
            eq(anonymousSubmissions.idempotencyKeyHash, input.idempotencyKeyHash),
          ),
        )
        .limit(1)
      if (existing !== undefined) {
        return { kind: "accepted", submissionId: existing.id, idempotent: true }
      }
    }

    const [updated] = await tx
      .update(anonymousSandboxes)
      .set({ acceptedCount: sql`${anonymousSandboxes.acceptedCount} + 1` })
      .where(
        and(
          eq(anonymousSandboxes.id, input.sandboxId),
          eq(anonymousSandboxes.status, "active"),
          gt(anonymousSandboxes.expiresAt, input.receivedAt),
          lt(anonymousSandboxes.acceptedCount, 5),
        ),
      )
      .returning({ id: anonymousSandboxes.id })

    if (updated === undefined) {
      const [sandbox] = await tx
        .select({
          status: anonymousSandboxes.status,
          expiresAt: anonymousSandboxes.expiresAt,
          acceptedCount: anonymousSandboxes.acceptedCount,
        })
        .from(anonymousSandboxes)
        .where(eq(anonymousSandboxes.id, input.sandboxId))
        .limit(1)
      return {
        kind: "unavailable",
        status: sandbox?.status ?? null,
        expiresAt: sandbox?.expiresAt ?? null,
        acceptedCount: sandbox?.acceptedCount ?? null,
      }
    }

    const [submission] = await tx
      .insert(anonymousSubmissions)
      .values({
        sandboxId: input.sandboxId,
        data: input.data,
        meta: input.meta,
        idempotencyKeyHash: input.idempotencyKeyHash,
        receivedAt: input.receivedAt,
      })
      .returning({ id: anonymousSubmissions.id })
    if (submission === undefined) throw new Error("Failed to insert anonymous submission.")
    return { kind: "accepted", submissionId: submission.id, idempotent: false }
  })
}

export async function deleteExpiredAnonymousSandboxes(
  db: Database,
  now = new Date(),
): Promise<number> {
  const deleted = await db
    .delete(anonymousSandboxes)
    .where(lt(anonymousSandboxes.expiresAt, now))
    .returning({ id: anonymousSandboxes.id })
  return deleted.length
}
