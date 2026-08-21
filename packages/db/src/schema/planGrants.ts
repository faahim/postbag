import { newId } from "@postbag/core"
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"

// Job K: complimentary access via grant codes, minted by a platform admin
// (PLATFORM_ADMIN_EMAILS) and redeemed by an org's own owner. Deliberately NOT a tenant
// row — it carries no organization_id and touches no tenant until POST /v1/plan/redeem
// writes to `organization_settings` for the redeeming org (see routes/v1/plan.ts). Not
// covered by the RLS second fence for the same reason better-auth's own tables aren't
// (migration 0003): it exists before any tenant scope is known.
export const planGrants = pgTable(
  "plan_grants",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("pg")),
    // sha256 hex of the code — the raw code is shown once at mint time and never stored,
    // same discipline as better-auth's `apikey.key`.
    codeHash: text("code_hash").notNull().unique(),
    plan: text("plan").notNull(),
    note: text("note"),
    // How many days after redemption the grant lasts; null = does not expire on its own
    // (only revocation or a plan change ends it). Applied to organization_settings.plan_expires_at
    // at redemption time — this column is the grant's *duration*, not a fixed date.
    planDurationDays: integer("plan_duration_days"),
    // When the *code itself* stops being redeemable (distinct from planDurationDays above).
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    maxRedemptions: integer("max_redemptions").default(1).notNull(),
    redeemedCount: integer("redeemed_count").default(0).notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [index("plan_grants_created_by_user_id_idx").on(table.createdByUserId)],
)

export const planGrantRedemptions = pgTable(
  "plan_grant_redemptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => newId("pgr")),
    grantId: text("grant_id")
      .notNull()
      .references(() => planGrants.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("plan_grant_redemptions_grant_id_idx").on(table.grantId),
    index("plan_grant_redemptions_organization_id_idx").on(table.organizationId),
  ],
)
