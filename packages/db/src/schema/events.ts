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
import { forms } from "./forms.js"
import { submissions } from "./submissions.js"

export const events = pgTable(
  "events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("ev")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    subject: jsonb("subject").$type<Readonly<Record<string, unknown>>>().default({}).notNull(),
    data: jsonb("data").$type<Readonly<Record<string, unknown>>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("events_organization_id_idx").on(table.organizationId),
    index("events_organization_created_idx").on(table.organizationId, table.createdAt),
    uniqueIndex("events_id_organization_unique").on(table.id, table.organizationId),
  ],
)

export const driftEvents = pgTable(
  "drift_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("dr")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    formId: text("form_id").notNull(),
    submissionId: text("submission_id").notNull(),
    kind: text("kind").notNull(),
    field: text("field").notNull(),
    details: jsonb("details").$type<Readonly<Record<string, unknown>>>().default({}).notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("drift_events_organization_id_idx").on(table.organizationId),
    index("drift_events_form_resolved_idx").on(table.formId, table.resolvedAt),
    uniqueIndex("drift_events_id_organization_unique").on(table.id, table.organizationId),
    foreignKey({
      columns: [table.formId, table.organizationId],
      foreignColumns: [forms.id, forms.organizationId],
      name: "drift_events_form_organization_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.submissionId, table.organizationId],
      foreignColumns: [submissions.id, submissions.organizationId],
      name: "drift_events_submission_organization_fk",
    }).onDelete("cascade"),
  ],
)

export const systemWebhooks = pgTable(
  "system_webhooks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("wh")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    events: text("events").array().default([]).notNull(),
    secret: text("secret").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    health: text("health").default("unknown").notNull(),
    consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("system_webhooks_organization_id_idx").on(table.organizationId),
    uniqueIndex("system_webhooks_id_organization_unique").on(table.id, table.organizationId),
  ],
)

// Job D §2: the outbox for org-level system webhooks, delivered by the worker with the
// same HMAC signing/backoff/dead-lettering semantics as route webhooks (ARCHITECTURE.md
// "Webhook contract"). Rows are enqueued by the `dispatch_system_webhooks` trigger on
// `events` (see migration 0002) — the EventDispatcher seam is the database, not a call
// site, so every event insert (present or future) fans out without app code remembering to.
export const systemWebhookDeliveries = pgTable(
  "system_webhook_deliveries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("whd")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    webhookId: text("webhook_id").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Readonly<Record<string, unknown>>>().notNull(),
    status: text("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: "date" }).defaultNow(),
    lastError: text("last_error"),
    lastResponse: jsonb("last_response").$type<Readonly<Record<string, unknown>>>(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    workerId: text("worker_id"),
    claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("system_webhook_deliveries_organization_id_idx").on(table.organizationId),
    index("system_webhook_deliveries_claim_idx").on(table.status, table.nextAttemptAt),
    uniqueIndex("system_webhook_deliveries_id_organization_unique").on(table.id, table.organizationId),
    foreignKey({
      columns: [table.webhookId, table.organizationId],
      foreignColumns: [systemWebhooks.id, systemWebhooks.organizationId],
      name: "system_webhook_deliveries_webhook_organization_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.eventId, table.organizationId],
      foreignColumns: [events.id, events.organizationId],
      name: "system_webhook_deliveries_event_organization_fk",
    }).onDelete("cascade"),
  ],
)
