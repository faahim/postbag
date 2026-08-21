import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import type { Database } from "@postbag/db"

import { computeHealth } from "../lib/health.js"
import type { AppEnv } from "../lib/scope.js"

const HealthSchema = z.object({
  ok: z.boolean(),
  db: z.enum(["up", "down"]),
  worker: z.object({ heartbeat_at: z.string().nullable(), alive: z.boolean() }),
  oldest_pending_delivery_s: z.number().nullable(),
  version: z.string(),
})

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  operationId: "health_get",
  tags: ["discovery"],
  summary: "Liveness and readiness",
  description: "Public, unauthenticated. Reports database connectivity, worker heartbeat and the oldest pending delivery age.",
  security: [],
  responses: {
    200: { description: "ok", content: { "application/json": { schema: HealthSchema } } },
    503: { description: "db down", content: { "application/json": { schema: HealthSchema } } },
  },
})

export function registerHealthRoute(app: OpenAPIHono<AppEnv>, db: Database, version: string): void {
  app.openapi(healthRoute, async (c) => {
    const report = await computeHealth(db, version)
    return c.json(report, report.ok ? 200 : 503)
  })
}
