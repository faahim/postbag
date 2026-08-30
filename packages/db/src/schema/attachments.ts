import { newId } from "@postbag/core"
import {
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { organization } from "./auth.js"
import { forms } from "./forms.js"
import { submissions } from "./submissions.js"

/**
 * Private file metadata for a Submission. The object itself remains in the configured
 * storage service; only its opaque key is persisted here.
 */
export const submissionAttachments = pgTable(
  "submission_attachments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("fl")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    formId: text("form_id").notNull(),
    submissionId: text("submission_id").notNull(),
    fieldName: text("field_name").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    storageKey: text("storage_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("submission_attachments_submission_idx").on(table.submissionId),
    index("submission_attachments_organization_id_idx").on(table.organizationId),
    uniqueIndex("submission_attachments_id_organization_unique").on(table.id, table.organizationId),
    uniqueIndex("submission_attachments_storage_key_unique").on(table.storageKey),
    foreignKey({
      columns: [table.formId, table.organizationId],
      foreignColumns: [forms.id, forms.organizationId],
      name: "submission_attachments_form_organization_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.submissionId, table.organizationId],
      foreignColumns: [submissions.id, submissions.organizationId],
      name: "submission_attachments_submission_organization_fk",
    }).onDelete("cascade"),
  ],
)

/**
 * Operational cleanup queue. It deliberately has no organization foreign key: the
 * deletion trigger must retain cleanup work after a Submission or Organization cascade.
 */
export const objectDeletions = pgTable(
  "object_deletions",
  {
    storageKey: text("storage_key").primaryKey(),
    organizationId: text("organization_id").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("object_deletions_pending_idx").on(table.nextAttemptAt),
    index("object_deletions_organization_id_idx").on(table.organizationId),
  ],
)
