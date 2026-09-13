import { createRoute, type OpenAPIHono } from "@hono/zod-openapi"
import type { Database } from "@postbag/db"

import type { Env } from "../../env.js"
import { loadPlatformGrowthMetrics } from "../../lib/growthMetrics.js"
import { PLATFORM_ADMIN_GATE_DESCRIPTION, requirePlatformAdmin } from "../../lib/platformAdmin.js"
import { assertScope, type AppEnv } from "../../lib/scope.js"
import { errorResponses, GrowthMetricsSchema } from "../../schemas.js"

const getGrowthMetricsRoute = createRoute({
  method: "get",
  path: "/v1/admin/growth-metrics",
  operationId: "admin_growth_metrics",
  tags: ["admin"],
  summary: "Platform-wide growth KPIs (platform admin only; aggregates only)",
  description:
    `${PLATFORM_ADMIN_GATE_DESCRIPTION} Returns COUNT aggregates across every organization — ` +
    "never emails, names, submission payloads, API keys, or per-organization dumps. " +
    "Requires the read scope. This is the narrow platform aggregate exception defined by ADR-011. " +
    "Every value is a current snapshot of retained database rows, so retention and user deletion " +
    "can reduce totals and window counts; this is not an append-only historical funnel. Sandbox " +
    "fields are explicitly prefixed `retained_` because housekeeping deletes every sandbox after " +
    "expires_at, including claimed rows. `orgs_with_real_delivery_30d` is organizations " +
    "with at least one successful (status=sent) Delivery of a non-test Submission in 30 days.",
  responses: {
    200: { description: "ok", content: { "application/json": { schema: GrowthMetricsSchema } } },
    ...errorResponses,
  },
})

export function registerGrowthMetricsRoutes(
  app: OpenAPIHono<AppEnv>,
  db: Database,
  env: Env,
): void {
  app.openapi(getGrowthMetricsRoute, async (c) => {
    const scope = c.var.scope
    // Preserve endpoint concealment for non-admins, then enforce the ordinary read
    // capability before any platform-wide aggregate query runs.
    await requirePlatformAdmin(db, scope, env.PLATFORM_ADMIN_EMAILS)
    assertScope(scope, "read")
    return c.json(await loadPlatformGrowthMetrics(db), 200)
  })
}
