import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { organization } from "./auth.js"

export const organizationSettings = pgTable(
  "organization_settings",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    plan: text("plan").default("free").notNull(),
    timezone: text("timezone").default("Europe/Stockholm").notNull(),
    limits: jsonb("limits").$type<Readonly<Record<string, number>>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("organization_settings_organization_id_idx").on(table.organizationId)],
)
