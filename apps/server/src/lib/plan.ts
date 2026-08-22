import { PostbagError, type Plan, type PlanLimits } from "@postbag/core"

// Job K: tier ordering for the plan_grants redeem rule ("redeeming a lower tier than
// current is refused"). `selfhost` is not a purchasable/redeemable tier in practice but
// ranks highest so nothing downgrades a self-hosted instance by accident.
export const PLAN_ORDER: Record<Plan, number> = { free: 0, pro: 1, team: 2, selfhost: 3 }

export const DEFAULT_PLAN_LIMITS: Record<Plan, Omit<PlanLimits, "used">> = {
  free: { forms: 5, submissions_per_month: 1_000, destinations: 5, retention_days: 90 },
  pro: { forms: 50, submissions_per_month: 50_000, destinations: 50, retention_days: 365 },
  team: { forms: 500, submissions_per_month: 500_000, destinations: 500, retention_days: 730 },
  selfhost: {
    forms: 1_000_000,
    submissions_per_month: 1_000_000_000,
    destinations: 1_000_000,
    retention_days: 36_500,
  },
}

function isPlan(value: string): value is Plan {
  return value === "free" || value === "pro" || value === "team" || value === "selfhost"
}

export function limitsFor(plan: string, stored: Readonly<Record<string, number>>): Omit<PlanLimits, "used"> {
  const defaults = isPlan(plan) ? DEFAULT_PLAN_LIMITS[plan] : DEFAULT_PLAN_LIMITS.free
  return {
    forms: stored["forms"] ?? defaults.forms,
    submissions_per_month: stored["submissions_per_month"] ?? defaults.submissions_per_month,
    destinations: stored["destinations"] ?? defaults.destinations,
    retention_days: stored["retention_days"] ?? defaults.retention_days,
  }
}

/**
 * Job K — the checkout guard, written now even though checkout (ADR-007/Polar) doesn't
 * exist yet: billing code must never downgrade a complimentary org and must refuse to
 * start checkout for one. Call this at the top of the future `POST /v1/billing/checkout`
 * handler; it throws `409 plan_is_complimentary` (with a hint) when checkout must not
 * proceed, and is a no-op otherwise.
 */
export function canStartCheckout(planSource: string): void {
  if (planSource === "complimentary") {
    throw new PostbagError(
      "plan_is_complimentary",
      "This organization has complimentary access; billing does not apply while it is active.",
    )
  }
  if (planSource === "selfhost") {
    throw new PostbagError(
      "billing_disabled",
      "Hosted billing does not apply to a self-hosted organization.",
    )
  }
}
