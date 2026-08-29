import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { asc, count, eq } from "drizzle-orm"
import {
  apikey,
  destinations,
  forms,
  member,
  organization,
  organizationSettings,
  projects,
  routes,
  streams,
  type Database,
} from "@postbag/db"

import { limitsFor } from "../../lib/plan.js"
import { countMonthlySubmissions, retainedAttachmentStorageBytes } from "../../lib/planUsage.js"
import { isMemberRole } from "../../lib/orgs.js"
import type { AppEnv } from "../../lib/scope.js"
import { NextSchema, OrganizationSummarySchema, ScopeSchema } from "../../schemas.js"

const MeSchema = z.object({
  organization: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    plan: z.string(),
    // Job K: *what tier* (plan) vs *why the org has it* (plan_source). plan_expires_at is
    // only set for time-boxed complimentary grants; plan_note is a short line shown to
    // the org, e.g. "Courtesy of Postbag".
    plan_source: z.string(),
    plan_expires_at: z.string().nullable(),
    plan_note: z.string().nullable(),
    timezone: z.string(),
  }),
  key: z.object({ prefix: z.string().optional(), scopes: z.array(ScopeSchema) }),
  // Job L §1: only orgs the caller is a member of — the user's own data, never
  // cross-tenant. For a session actor this is every Membership row for that user; an API
  // key has no user of its own (see OrganizationSummarySchema), so it's just its one org.
  organizations: z.array(OrganizationSummarySchema),
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
    attachment_max_bytes: z.number().int(),
    attachments_per_submission: z.number().int(),
    attachment_storage_bytes: z.number().int(),
    used: z.object({
      forms: z.number().int(),
      submissions_this_month: z.number().int(),
      attachment_storage_bytes: z.number().int(),
    }),
  }),
  next: NextSchema,
})

const meRoute = createRoute({
  method: "get",
  path: "/v1/me",
  operationId: "me_get",
  tags: ["discovery"],
  summary: "Identify the caller and summarise the organization",
  description:
    "The first call an agent holding only an API key should make: who it is, which org, which " +
    "scopes the key has, plan limits and usage, and what already exists (counts). Call this before anything else.",
  responses: { 200: { description: "ok", content: { "application/json": { schema: MeSchema } } } },
})

export function registerMeRoutes(app: OpenAPIHono<AppEnv>, db: Database): void {
  app.openapi(meRoute, async (c) => {
    const scope = c.var.scope
    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, scope.organizationId))
      .limit(1)
    if (org === undefined) throw new Error("Organization not found for an authenticated scope.")
    const [settingsRow] = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, scope.organizationId))
      .limit(1)

    const [
      [projectCount],
      [formCount],
      [streamCount],
      [destinationCount],
      [routeCount],
      submissionCount,
      attachmentStorageBytes,
    ] = await Promise.all([
      db
        .select({ value: count() })
        .from(projects)
        .where(eq(projects.organizationId, scope.organizationId)),
      db
        .select({ value: count() })
        .from(forms)
        .where(eq(forms.organizationId, scope.organizationId)),
      db
        .select({ value: count() })
        .from(streams)
        .where(eq(streams.organizationId, scope.organizationId)),
      db
        .select({ value: count() })
        .from(destinations)
        .where(eq(destinations.organizationId, scope.organizationId)),
      db
        .select({ value: count() })
        .from(routes)
        .where(eq(routes.organizationId, scope.organizationId)),
      countMonthlySubmissions(db, scope.organizationId),
      retainedAttachmentStorageBytes(db, scope.organizationId),
    ])

    let keyPrefix: string | undefined
    if (scope.actor.type === "api_key") {
      const [keyRow] = await db
        .select({ prefix: apikey.prefix })
        .from(apikey)
        .where(eq(apikey.id, scope.actor.apiKeyId))
        .limit(1)
      keyPrefix = keyRow?.prefix ?? undefined
    }

    const plan = settingsRow?.plan ?? "free"
    const limits = limitsFor(plan, settingsRow?.limits ?? {})

    let organizations: z.infer<typeof MeSchema>["organizations"]
    if (scope.actor.type === "session") {
      const rows = await db
        .select({
          id: organization.id,
          slug: organization.slug,
          name: organization.name,
          role: member.role,
        })
        .from(member)
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .where(eq(member.userId, scope.actor.userId))
        .orderBy(asc(member.createdAt))
      organizations = rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        role: isMemberRole(row.role) ? row.role : "member",
        is_active: row.id === scope.organizationId,
      }))
    } else {
      organizations = [{ id: org.id, slug: org.slug, name: org.name, role: null, is_active: true }]
    }

    return c.json({
      organization: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        plan,
        plan_source: settingsRow?.planSource ?? "free",
        plan_expires_at: settingsRow?.planExpiresAt?.toISOString() ?? null,
        plan_note: settingsRow?.planNote ?? null,
        timezone: settingsRow?.timezone ?? "UTC",
      },
      key: { prefix: keyPrefix, scopes: [...scope.scopes] },
      organizations,
      counts: {
        projects: projectCount?.value ?? 0,
        forms: formCount?.value ?? 0,
        streams: streamCount?.value ?? 0,
        destinations: destinationCount?.value ?? 0,
        routes: routeCount?.value ?? 0,
      },
      limits: {
        ...limits,
        used: {
          forms: formCount?.value ?? 0,
          submissions_this_month: submissionCount,
          attachment_storage_bytes: attachmentStorageBytes,
        },
      },
      next:
        formCount?.value === 0
          ? [
              {
                why: "Create your first form",
                method: "POST",
                path: "/v1/quickstart",
                body: { name: "My first form" },
              },
            ]
          : [],
    })
  })
}
