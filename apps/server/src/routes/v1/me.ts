import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { count, eq } from "drizzle-orm"
import {
  apikey,
  destinations,
  forms,
  organization,
  organizationSettings,
  projects,
  routes,
  streams,
  submissions,
  type Database,
} from "@postbag/db"

import { limitsFor } from "../../lib/plan.js"
import type { AppEnv } from "../../lib/scope.js"
import { NextSchema, ScopeSchema } from "../../schemas.js"

const MeSchema = z.object({
  organization: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    plan: z.string(),
    timezone: z.string(),
  }),
  key: z.object({ prefix: z.string().optional(), scopes: z.array(ScopeSchema) }),
  counts: z.object({
    projects: z.number().int(),
    forms: z.number().int(),
    streams: z.number().int(),
    destinations: z.number().int(),
    routes: z.number().int(),
  }),
  limits: z.object({
    forms: z.number().int(),
    submissions_per_month: z.number().int(),
    destinations: z.number().int(),
    retention_days: z.number().int(),
    used: z.object({ forms: z.number().int(), submissions_this_month: z.number().int() }),
  }),
  next: NextSchema,
})

const meRoute = createRoute({
  method: "get",
  path: "/v1/me",
  tags: ["discovery"],
  summary: "Identify the caller and summarise the organization",
  responses: { 200: { description: "ok", content: { "application/json": { schema: MeSchema } } } },
})

export function registerMeRoutes(app: OpenAPIHono<AppEnv>, db: Database): void {
  app.openapi(meRoute, async (c) => {
    const scope = c.var.scope
    const [org] = await db.select().from(organization).where(eq(organization.id, scope.organizationId)).limit(1)
    if (org === undefined) throw new Error("Organization not found for an authenticated scope.")
    const [settingsRow] = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, scope.organizationId))
      .limit(1)

    const [[projectCount], [formCount], [streamCount], [destinationCount], [routeCount], [submissionCount]] =
      await Promise.all([
        db.select({ value: count() }).from(projects).where(eq(projects.organizationId, scope.organizationId)),
        db.select({ value: count() }).from(forms).where(eq(forms.organizationId, scope.organizationId)),
        db.select({ value: count() }).from(streams).where(eq(streams.organizationId, scope.organizationId)),
        db.select({ value: count() }).from(destinations).where(eq(destinations.organizationId, scope.organizationId)),
        db.select({ value: count() }).from(routes).where(eq(routes.organizationId, scope.organizationId)),
        db.select({ value: count() }).from(submissions).where(eq(submissions.organizationId, scope.organizationId)),
      ])

    let keyPrefix: string | undefined
    if (scope.actor.type === "api_key") {
      const [keyRow] = await db.select({ prefix: apikey.prefix }).from(apikey).where(eq(apikey.id, scope.actor.apiKeyId)).limit(1)
      keyPrefix = keyRow?.prefix ?? undefined
    }

    const plan = settingsRow?.plan ?? "free"
    const limits = limitsFor(plan, settingsRow?.limits ?? {})

    return c.json({
      organization: { id: org.id, slug: org.slug, name: org.name, plan, timezone: settingsRow?.timezone ?? "UTC" },
      key: { prefix: keyPrefix, scopes: [...scope.scopes] },
      counts: {
        projects: projectCount?.value ?? 0,
        forms: formCount?.value ?? 0,
        streams: streamCount?.value ?? 0,
        destinations: destinationCount?.value ?? 0,
        routes: routeCount?.value ?? 0,
      },
      limits: { ...limits, used: { forms: formCount?.value ?? 0, submissions_this_month: submissionCount?.value ?? 0 } },
      next:
        formCount?.value === 0
          ? [{ why: "Create your first form", method: "POST", path: "/v1/quickstart", body: { name: "My first form" } }]
          : [],
    })
  })
}
