import { objectDeletions, type Database } from "@postbag/db"
import { asc, and, eq, lte } from "drizzle-orm"

import type { ObjectStorage } from "../lib/objectStorage.js"
import type { Logger } from "../logger.js"

export async function runObjectDeletionSweep(
  db: Database,
  storage: ObjectStorage | null,
  logger: Logger,
): Promise<void> {
  if (storage === null) return
  const due = await db
    .select()
    .from(objectDeletions)
    .where(lte(objectDeletions.nextAttemptAt, new Date()))
    .orderBy(asc(objectDeletions.nextAttemptAt))
    .limit(50)

  for (const pending of due) {
    const [claimed] = await db
      .update(objectDeletions)
      .set({
        uploadReservation: false,
        nextAttemptAt: new Date(Date.now() + 5 * 60_000),
      })
      .where(
        and(
          eq(objectDeletions.storageKey, pending.storageKey),
          lte(objectDeletions.nextAttemptAt, new Date()),
        ),
      )
      .returning({ storageKey: objectDeletions.storageKey })
    if (claimed === undefined) continue
    try {
      await storage.delete(pending.storageKey)
      await db.delete(objectDeletions).where(eq(objectDeletions.storageKey, pending.storageKey))
    } catch (error) {
      const attempts = pending.attempts + 1
      const delayMs = Math.min(24 * 60 * 60 * 1_000, 30_000 * 2 ** Math.min(attempts, 10))
      await db
        .update(objectDeletions)
        .set({
          attempts,
          nextAttemptAt: new Date(Date.now() + delayMs),
          lastError:
            error instanceof Error ? error.message.slice(0, 1_000) : "Unknown storage error.",
        })
        .where(eq(objectDeletions.storageKey, pending.storageKey))
      logger.warn({ storage_key: pending.storageKey, attempts }, "object deletion deferred")
    }
  }
}
