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

import { organization } from "./auth.js"
import { destinations } from "./destinations.js"
import { routes } from "./routes.js"
import { submissions } from "./submissions.js"

export const digests = pgTable(
  "digests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("dg")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    routeId: text("route_id").notNull(),
    periodKey: text("period_key").notNull(),
    status: text("status").default("open").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    readyAt: timestamp("ready_at", { withTimezone: true, mode: "date" }),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("digests_organization_id_idx").on(table.organizationId),
    uniqueIndex("digests_id_organization_unique").on(table.id, table.organizationId),
    uniqueIndex("digests_route_period_unique").on(table.routeId, table.periodKey),
    foreignKey({
      columns: [table.routeId, table.organizationId],
      foreignColumns: [routes.id, routes.organizationId],
      name: "digests_route_organization_fk",
    }).onDelete("cascade"),
  ],
)

export const deliveries = pgTable(
  "deliveries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("dl")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    submissionId: text("submission_id").notNull(),
    routeId: text("route_id").notNull(),
    destinationId: text("destination_id").notNull(),
    digestId: text("digest_id"),
    status: text("status").default("pending").notNull(),
    skipReason: text("skip_reason"),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: "date" }).defaultNow(),
    lastError: text("last_error"),
    payload: jsonb("payload").$type<Readonly<Record<string, unknown>>>().notNull(),
    schemaVersion: integer("schema_version"),
    lastResponse: jsonb("last_response").$type<Readonly<Record<string, unknown>>>(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    workerId: text("worker_id"),
    claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("deliveries_organization_id_idx").on(table.organizationId),
    index("deliveries_claim_idx").on(table.status, table.nextAttemptAt),
    uniqueIndex("deliveries_id_organization_unique").on(table.id, table.organizationId),
    uniqueIndex("deliveries_submission_route_unique").on(table.submissionId, table.routeId),
    foreignKey({
      columns: [table.submissionId, table.organizationId],
      foreignColumns: [submissions.id, submissions.organizationId],
      name: "deliveries_submission_organization_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.routeId, table.organizationId],
      foreignColumns: [routes.id, routes.organizationId],
      name: "deliveries_route_organization_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.destinationId, table.organizationId],
      foreignColumns: [destinations.id, destinations.organizationId],
      name: "deliveries_destination_organization_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.digestId, table.organizationId],
      foreignColumns: [digests.id, digests.organizationId],
      name: "deliveries_digest_organization_fk",
    }).onDelete("restrict"),
  ],
)
