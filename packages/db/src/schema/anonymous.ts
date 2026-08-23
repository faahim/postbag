import { newId } from "@postbag/core"
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"

/**
 * Non-tenant staging rows for ADR-008. These tables deliberately have no organization
 * scope or RLS policy: the public surface reaches them only through the narrow sandbox
 * repository. Claiming is the only path that copies their data into tenant tables.
 */
export const anonymousSandboxes = pgTable(
  "anonymous_sandboxes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("fm")),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    allowedOrigin: text("allowed_origin"),
    claimEmailHash: text("claim_email_hash"),
    tokenHash: text("token_hash").notNull(),
    tokenReplayEncrypted: text("token_replay_encrypted"),
    status: text("status").default("active").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    acceptedCount: integer("accepted_count").default(0).notNull(),
    creationIdempotencyKeyHash: text("creation_idempotency_key_hash").notNull(),
    requestBodyHash: text("request_body_hash").notNull(),
    abuseSourceKey: text("abuse_source_key").notNull(),
    claimedOrganizationId: text("claimed_organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    claimedUserId: text("claimed_user_id").references(() => user.id, { onDelete: "set null" }),
    claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("anonymous_sandboxes_creation_idempotency_unique").on(
      table.creationIdempotencyKeyHash,
    ),
    index("anonymous_sandboxes_active_source_idx").on(
      table.abuseSourceKey,
      table.status,
      table.expiresAt,
    ),
    index("anonymous_sandboxes_expiry_idx").on(table.expiresAt),
  ],
)

export const anonymousSubmissions = pgTable(
  "anonymous_submissions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("sb")),
    sandboxId: text("sandbox_id")
      .notNull()
      .references(() => anonymousSandboxes.id, { onDelete: "cascade" }),
    data: jsonb("data").$type<Readonly<Record<string, unknown>>>().notNull(),
    meta: jsonb("meta").$type<Readonly<Record<string, unknown>>>().default({}).notNull(),
    idempotencyKeyHash: text("idempotency_key_hash"),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("anonymous_submissions_sandbox_received_idx").on(table.sandboxId, table.receivedAt),
    uniqueIndex("anonymous_submissions_sandbox_idempotency_unique").on(
      table.sandboxId,
      table.idempotencyKeyHash,
    ),
  ],
)
