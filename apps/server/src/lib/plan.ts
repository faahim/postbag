import type { Plan, PlanLimits } from "@postbag/core"

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
