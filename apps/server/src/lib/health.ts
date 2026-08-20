import { sql } from "drizzle-orm"
import type { Database } from "@postbag/db"

export type HealthReport = {
  readonly ok: boolean
  readonly db: "up" | "down"
  readonly worker: { readonly heartbeat_at: string | null; readonly alive: boolean }
  readonly oldest_pending_delivery_s: number | null
  readonly version: string
}

const HEARTBEAT_ALIVE_WINDOW_MS = 30_000

export async function computeHealth(db: Database, version: string): Promise<HealthReport> {
  let dbUp = true
  let heartbeatAt: Date | null = null
  let oldestPendingSeconds: number | null = null

  try {
    // Raw `.execute()` results are not passed through drizzle's column type mappers,
    // so timestamp/numeric columns come back as strings — parse them explicitly.
    const heartbeatRows = await db.execute<{ heartbeat_at: string | null }>(
      sql`select max(heartbeat_at) as heartbeat_at from worker_heartbeats`,
    )
    const rawHeartbeatAt = heartbeatRows[0]?.heartbeat_at
    heartbeatAt = rawHeartbeatAt === null || rawHeartbeatAt === undefined ? null : new Date(rawHeartbeatAt)

    const pendingRows = await db.execute<{ oldest_seconds: string | null }>(sql`
      select extract(epoch from (now() - min(created_at)))::float as oldest_seconds
      from deliveries
      where status in ('pending', 'failed')
    `)
    const oldest = pendingRows[0]?.oldest_seconds
    oldestPendingSeconds = oldest === null || oldest === undefined ? null : Math.round(Number(oldest))
  } catch {
    dbUp = false
  }

  const alive = heartbeatAt !== null && Date.now() - heartbeatAt.getTime() < HEARTBEAT_ALIVE_WINDOW_MS

  return {
    ok: dbUp,
    db: dbUp ? "up" : "down",
    worker: { heartbeat_at: heartbeatAt?.toISOString() ?? null, alive },
    oldest_pending_delivery_s: oldestPendingSeconds,
    version,
  }
}
