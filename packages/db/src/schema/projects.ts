import { newId } from "@postbag/core"
import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { organization } from "./auth.js"

export const projects = pgTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("prj")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    tags: text("tags").array().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("projects_organization_id_idx").on(table.organizationId),
    uniqueIndex("projects_id_organization_unique").on(table.id, table.organizationId),
    uniqueIndex("projects_organization_slug_unique").on(table.organizationId, table.slug),
  ],
)
