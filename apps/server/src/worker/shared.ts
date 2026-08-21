import { newId } from "@postbag/core"
import { events, type Database } from "@postbag/db"

/** Shared by every worker loop (instant deliveries, system webhooks, digests, housekeeping)
 * so they all append to the same org event log the same way. */
export async function recordEvent(
  db: Database,
  organizationId: string,
  type: string,
  subject: Readonly<Record<string, unknown>>,
  data: Readonly<Record<string, unknown>> = {},
): Promise<void> {
  await db.insert(events).values({ id: newId("ev"), organizationId, type, subject, data })
}
