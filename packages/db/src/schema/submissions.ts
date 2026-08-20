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
  boolean,
} from "drizzle-orm/pg-core"

import { organization } from "./auth.js"
import { forms, formSchemas } from "./forms.js"

export const submissions = pgTable(
  "submissions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("sb")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    formId: text("form_id").notNull(),
    data: jsonb("data").$type<Readonly<Record<string, unknown>>>().notNull(),
    formSchemaVersion: integer("form_schema_version"),
    status: text("status").default("received").notNull(),
    quarantineReason: text("quarantine_reason"),
    spam: jsonb("spam")
      .$type<{ readonly score: number; readonly reasons: readonly string[] }>()
      .default({ score: 0, reasons: [] })
      .notNull(),
    meta: jsonb("meta").$type<Readonly<Record<string, unknown>>>().default({}).notNull(),
    idempotencyKey: text("idempotency_key"),
    test: boolean("test").default(false).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("submissions_organization_id_idx").on(table.organizationId),
    index("submissions_form_received_idx").on(table.formId, table.receivedAt),
    uniqueIndex("submissions_id_organization_unique").on(table.id, table.organizationId),
    uniqueIndex("submissions_form_idempotency_unique").on(table.formId, table.idempotencyKey),
    foreignKey({
      columns: [table.formId, table.organizationId],
      foreignColumns: [forms.id, forms.organizationId],
      name: "submissions_form_organization_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.formId, table.formSchemaVersion, table.organizationId],
      foreignColumns: [formSchemas.formId, formSchemas.version, formSchemas.organizationId],
      name: "submissions_form_schema_organization_fk",
    }),
  ],
)
