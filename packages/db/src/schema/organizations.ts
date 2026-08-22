import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { organization } from "./auth.js"

export const organizationSettings = pgTable(
  "organization_settings",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    plan: text("plan").default("free").notNull(),
    // Job K: *what tier* (plan) is separate from *why the org has it* (planSource).
    // 'billing' is written only by the (future) Polar webhook handler; 'complimentary'
    // only by redeeming a plan_grants code (see schema/planGrants.ts); 'selfhost' by the
    // self-host bootstrap. Billing code must never downgrade a complimentary org and must
    // refuse to start checkout for one — see apps/server/src/lib/plan.ts canStartCheckout.
    planSource: text("plan_source").default("free").notNull(),
    // Nullable — only set for time-boxed complimentary grants. A housekeeping tick reverts
    // expired complimentary orgs to free/free (apps/server/src/worker/housekeeping.ts).
    planExpiresAt: timestamp("plan_expires_at", { withTimezone: true, mode: "date" }),
    // Short text shown to the org, e.g. "Courtesy of Postbag" — set by redeeming a grant.
    planNote: text("plan_note"),
    billingCustomerId: text("billing_customer_id"),
    billingSubscriptionId: text("billing_subscription_id"),
    billingSubscriptionStatus: text("billing_subscription_status"),
    billingCurrentPeriodEnd: timestamp("billing_current_period_end", { withTimezone: true, mode: "date" }),
    billingCancelAtPeriodEnd: boolean("billing_cancel_at_period_end").default(false).notNull(),
    billingProviderEventAt: timestamp("billing_provider_event_at", { withTimezone: true, mode: "date" }),
    timezone: text("timezone").default("Europe/Stockholm").notNull(),
    limits: jsonb("limits").$type<Readonly<Record<string, number>>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("organization_settings_organization_id_idx").on(table.organizationId)],
)
