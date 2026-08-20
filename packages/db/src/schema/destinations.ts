import { newId } from "@postbag/core"
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  boolean,
  integer,
} from "drizzle-orm/pg-core"

import { organization } from "./auth.js"

export const destinations = pgTable(
  "destinations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("ds")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    name: text("name").notNull(),
    config: jsonb("config").$type<Readonly<Record<string, unknown>>>().notNull(),
    health: text("health").default("unknown").notNull(),
    verified: boolean("verified").default(false).notNull(),
    consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("destinations_organization_id_idx").on(table.organizationId),
    uniqueIndex("destinations_id_organization_unique").on(table.id, table.organizationId),
  ],
)
