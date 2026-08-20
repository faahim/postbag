import { index, jsonb, pgTable, primaryKey, text, timestamp, integer } from "drizzle-orm/pg-core"

import { organization } from "./auth.js"

// Job B addition: stores the response for (organization, Idempotency-Key) on /v1
// POSTs for 24h, per the spec's "table preferred" guidance.
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    statusCode: integer("status_code").notNull(),
    responseBody: jsonb("response_body").$type<unknown>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.key] }),
    index("idempotency_keys_expires_at_idx").on(table.expiresAt),
  ],
)
