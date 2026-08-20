import { newId } from "@postbag/core"
import { sql } from "drizzle-orm"
import {
  check,
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
import { forms } from "./forms.js"

export const streams = pgTable(
  "streams",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("st")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    currentSchemaVersion: integer("current_schema_version"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("streams_organization_id_idx").on(table.organizationId),
    uniqueIndex("streams_id_organization_unique").on(table.id, table.organizationId),
    uniqueIndex("streams_organization_slug_unique").on(table.organizationId, table.slug),
  ],
)

export const streamSchemas = pgTable(
  "stream_schemas",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("ss")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    streamId: text("stream_id").notNull(),
    version: integer("version").notNull(),
    jsonSchema: jsonb("json_schema").$type<Readonly<Record<string, unknown>>>().notNull(),
    ui: jsonb("ui").$type<Readonly<Record<string, unknown>>>().default({}).notNull(),
    changelog: text("changelog"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("stream_schemas_organization_id_idx").on(table.organizationId),
    uniqueIndex("stream_schemas_id_organization_unique").on(table.id, table.organizationId),
    uniqueIndex("stream_schemas_stream_version_unique").on(table.streamId, table.version),
    uniqueIndex("stream_schemas_stream_version_organization_unique").on(
      table.streamId,
      table.version,
      table.organizationId,
    ),
    foreignKey({
      columns: [table.streamId, table.organizationId],
      foreignColumns: [streams.id, streams.organizationId],
      name: "stream_schemas_stream_organization_fk",
    }).onDelete("cascade"),
  ],
)

export const streamSources = pgTable(
  "stream_sources",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("src")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    streamId: text("stream_id").notNull(),
    formId: text("form_id"),
    selector: text("selector"),
    mapping: jsonb("mapping").$type<Readonly<Record<string, unknown>>>().default({}).notNull(),
    mappingStatus: text("mapping_status").default("valid").notNull(),
    missing: text("missing").array().default([]).notNull(),
    streamSchemaVersion: integer("stream_schema_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("stream_sources_organization_id_idx").on(table.organizationId),
    uniqueIndex("stream_sources_id_organization_unique").on(table.id, table.organizationId),
    uniqueIndex("stream_sources_stream_form_unique").on(table.streamId, table.formId),
    check(
      "stream_sources_exactly_one_source",
      sql`num_nonnulls(${table.formId}, ${table.selector}) = 1`,
    ),
    foreignKey({
      columns: [table.streamId, table.organizationId],
      foreignColumns: [streams.id, streams.organizationId],
      name: "stream_sources_stream_organization_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.formId, table.organizationId],
      foreignColumns: [forms.id, forms.organizationId],
      name: "stream_sources_form_organization_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.streamId, table.streamSchemaVersion, table.organizationId],
      foreignColumns: [streamSchemas.streamId, streamSchemas.version, streamSchemas.organizationId],
      name: "stream_sources_schema_organization_fk",
    }),
  ],
)
