import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

// Job B addition: the worker heartbeats here so /health can report liveness
// without inventing a second channel. One row per worker process id.
export const workerHeartbeats = pgTable("worker_heartbeats", {
  workerId: text("worker_id").primaryKey(),
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
})
