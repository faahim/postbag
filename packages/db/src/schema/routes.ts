import { newId } from "@postbag/core"
import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { organization } from "./auth.js"
import { destinations } from "./destinations.js"
import { forms } from "./forms.js"
import { streams } from "./streams.js"

export const routes = pgTable(
  "routes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("rt")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    formId: text("form_id"),
    streamId: text("stream_id"),
    destinationId: text("destination_id").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    mode: jsonb("mode")
      .$type<Readonly<Record<string, unknown>>>()
      .default({ type: "instant" })
      .notNull(),
    window: jsonb("window").$type<Readonly<Record<string, unknown>>>().default({}).notNull(),
    quality: jsonb("quality")
      .$type<Readonly<Record<string, unknown>>>()
      .default({ exclude_spam: true, exclude_quarantined: true })
      .notNull(),
    filter: text("filter"),
    transform: text("transform"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("routes_organization_id_idx").on(table.organizationId),
    uniqueIndex("routes_id_organization_unique").on(table.id, table.organizationId),
    check("routes_exactly_one_source", sql`num_nonnulls(${table.formId}, ${table.streamId}) = 1`),
    foreignKey({
      columns: [table.formId, table.organizationId],
      foreignColumns: [forms.id, forms.organizationId],
      name: "routes_form_organization_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.streamId, table.organizationId],
      foreignColumns: [streams.id, streams.organizationId],
      name: "routes_stream_organization_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.destinationId, table.organizationId],
      foreignColumns: [destinations.id, destinations.organizationId],
      name: "routes_destination_organization_fk",
    }).onDelete("restrict"),
  ],
)
