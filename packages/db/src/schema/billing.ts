import { newId } from "@postbag/core"
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { organization } from "./auth.js"

export const billingEvents = pgTable(
  "billing_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("be")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    providerEventId: text("provider_event_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Readonly<Record<string, unknown>>>().notNull(),
    status: text("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    lastError: text("last_error"),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("billing_events_provider_event_id_unique").on(table.providerEventId),
    index("billing_events_pending_idx").on(table.status, table.nextAttemptAt),
    index("billing_events_organization_id_idx").on(table.organizationId),
  ],
)
