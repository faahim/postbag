import { createRoute, type OpenAPIHono } from "@hono/zod-openapi"
import type { Database } from "@postbag/db"

import type { Env } from "../../env.js"
import { loadPlatformGrowthMetrics } from "../../lib/growthMetrics.js"
import { PLATFORM_ADMIN_GATE_DESCRIPTION, requirePlatformAdmin } from "../../lib/platformAdmin.js"
import type { AppEnv } from "../../lib/scope.js"
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
    "Sandbox `expired_or_blocked_30d` counts rows currently marked expired or blocked whose " +
    "created_at or expires_at is in the last 30 days; housekeeping deletes expired sandboxes, " +
    "so that figure is typically near zero. `orgs_with_real_delivery_30d` is organizations " +
    "with at least one successful (status=sent) Delivery of a non-test Submission in 30 days.",
  responses: {
    200: { description: "ok", content: { "application/json": { schema: GrowthMetricsSchema } } },
    ...errorResponses,
  },
})

export function registerGrowthMetricsRoutes(app: OpenAPIHono<AppEnv>, db: Database, env: Env): void {
  app.openapi(getGrowthMetricsRoute, async (c) => {
    await requirePlatformAdmin(db, c.var.scope, env.PLATFORM_ADMIN_EMAILS)
    return c.json(await loadPlatformGrowthMetrics(db), 200)
  })
}
