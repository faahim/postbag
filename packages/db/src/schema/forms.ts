import { newId } from "@postbag/core"
import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"
import { projects } from "./projects.js"

export const forms = pgTable(
  "forms",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("fm")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    tags: text("tags").array().default([]).notNull(),
    schemaMode: text("schema_mode").default("observe").notNull(),
    currentSchemaVersion: integer("current_schema_version"),
    settings: jsonb("settings").$type<Readonly<Record<string, unknown>>>().default({}).notNull(),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("forms_organization_id_idx").on(table.organizationId),
    uniqueIndex("forms_id_organization_unique").on(table.id, table.organizationId),
    uniqueIndex("forms_project_slug_unique").on(table.organizationId, table.projectId, table.slug),
    foreignKey({
      columns: [table.projectId, table.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
      name: "forms_project_organization_fk",
    }).onDelete("cascade"),
  ],
)

export const formSchemas = pgTable(
  "form_schemas",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("fs")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    formId: text("form_id").notNull(),
    version: integer("version").notNull(),
    jsonSchema: jsonb("json_schema").$type<Readonly<Record<string, unknown>>>().notNull(),
    ui: jsonb("ui").$type<Readonly<Record<string, unknown>>>().default({}).notNull(),
    changelog: text("changelog"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("form_schemas_organization_id_idx").on(table.organizationId),
    uniqueIndex("form_schemas_id_organization_unique").on(table.id, table.organizationId),
    uniqueIndex("form_schemas_form_version_unique").on(table.formId, table.version),
    uniqueIndex("form_schemas_form_version_organization_unique").on(
      table.formId,
      table.version,
      table.organizationId,
    ),
    foreignKey({
      columns: [table.formId, table.organizationId],
      foreignColumns: [forms.id, forms.organizationId],
      name: "form_schemas_form_organization_fk",
    }).onDelete("cascade"),
  ],
)
