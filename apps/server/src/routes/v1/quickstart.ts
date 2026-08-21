import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { newId, QuickstartInputSchema } from "@postbag/core"
import { and, eq } from "drizzle-orm"
import { destinations, forms, projects, routes, type Database } from "@postbag/db"

import { renderEmbed } from "../../lib/snippets.js"
import type { AppEnv } from "../../lib/scope.js"
import { serializeDestination, serializeForm, serializeRoute } from "../../repo/serialize.js"
import { DestinationSchema, EmbedSchema, errorResponses, FormSchema, NextSchema, RouteSchema, VerifySchema } from "../../schemas.js"

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "")
  return base.length === 0 ? "form" : base.slice(0, 50)
}

const QuickstartResponseSchema = z.object({
  form: FormSchema,
  destinations: z.array(DestinationSchema),
  routes: z.array(RouteSchema),
  embed: EmbedSchema,
  verify: VerifySchema,
  next: NextSchema,
})

const quickstartRoute = createRoute({
  method: "post",
  path: "/v1/quickstart",
  operationId: "quickstart",
  tags: ["discovery"],
  summary: "One call to a working, routed form",
  description:
    "Creates (idempotently, by name within project) the project if missing, the form, a destination for " +
    "whichever of notify_email/telegram/webhook was given, and a direct route, then returns the form, an " +
    "embeddable snippet, a curl command to verify delivery, and next steps. Everything it does is also " +
    "available as individual calls (POST /v1/forms, /v1/destinations, /v1/routes); this is a convenience, not a special path.",
  request: { body: { content: { "application/json": { schema: QuickstartInputSchema } } } },
  responses: {
    201: { description: "created (or returned)", content: { "application/json": { schema: QuickstartResponseSchema } } },
    ...errorResponses,
  },
})

export function registerQuickstartRoutes(app: OpenAPIHono<AppEnv>, db: Database, appUrl: string): void {
  app.openapi(quickstartRoute, async (c) => {
    const scope = c.var.scope
    const input = c.req.valid("json")
    const organizationId = scope.organizationId

    const projectSlug = input.project
    let [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.organizationId, organizationId), eq(projects.slug, projectSlug)))
      .limit(1)
    if (project === undefined) {
      ;[project] = await db
        .insert(projects)
        .values({
          id: newId("prj"),
          organizationId,
          slug: projectSlug,
          name: projectSlug === "default" ? "Default" : projectSlug,
          tags: [],
        })
        .returning()
    }
    if (project === undefined) throw new Error("Failed to resolve project.")

    const formSlug = slugify(input.name)
    let [form] = await db
      .select()
      .from(forms)
      .where(and(eq(forms.organizationId, organizationId), eq(forms.projectId, project.id), eq(forms.slug, formSlug)))
      .limit(1)

    const createdDestinations: (typeof destinations.$inferSelect)[] = []
    const createdRoutes: (typeof routes.$inferSelect)[] = []

    if (form === undefined) {
      const settings: Record<string, unknown> = {}
      if (input.origin !== undefined) settings["allowed_origins"] = [input.origin]
      if (input.redirect_url !== undefined) settings["redirect_url"] = input.redirect_url
      ;[form] = await db
        .insert(forms)
        .values({
          id: newId("fm"),
          organizationId,
          projectId: project.id,
          slug: formSlug,
          name: input.name,
          tags: [...input.tags],
          settings,
        })
        .returning()
      if (form === undefined) throw new Error("Failed to create form.")

      if (input.notify_email !== undefined) {
        const [destination] = await db
          .insert(destinations)
          .values({
            id: newId("ds"),
            organizationId,
            type: "email",
            name: "Email",
            config: { to: [input.notify_email], cc: [], subject_template: "New submission: {{form.name}}" },
            verified: true,
          })
          .returning()
        if (destination !== undefined) {
          createdDestinations.push(destination)
          const [route] = await db
            .insert(routes)
            .values({ id: newId("rt"), organizationId, formId: form.id, destinationId: destination.id })
            .returning()
          if (route !== undefined) createdRoutes.push(route)
        }
      }
      if (input.telegram !== undefined) {
        const [destination] = await db
          .insert(destinations)
          .values({
            id: newId("ds"),
            organizationId,
            type: "telegram",
            name: "Telegram",
            config: { bot_token: input.telegram.bot_token, chat_id: input.telegram.chat_id },
            verified: true,
          })
          .returning()
        if (destination !== undefined) {
          createdDestinations.push(destination)
          const [route] = await db
            .insert(routes)
            .values({ id: newId("rt"), organizationId, formId: form.id, destinationId: destination.id })
            .returning()
          if (route !== undefined) createdRoutes.push(route)
        }
      }
      if (input.webhook !== undefined) {
        const [destination] = await db
          .insert(destinations)
          .values({
            id: newId("ds"),
            organizationId,
            type: "webhook",
            name: "Webhook",
            config: { url: input.webhook.url, secret: input.webhook.secret, headers: {} },
            verified: true,
          })
          .returning()
        if (destination !== undefined) {
          createdDestinations.push(destination)
          const [route] = await db
            .insert(routes)
            .values({ id: newId("rt"), organizationId, formId: form.id, destinationId: destination.id })
            .returning()
          if (route !== undefined) createdRoutes.push(route)
        }
      }
    } else {
      const existingRoutes = await db
        .select()
        .from(routes)
        .where(and(eq(routes.organizationId, organizationId), eq(routes.formId, form.id)))
      for (const route of existingRoutes) {
        createdRoutes.push(route)
        const [destination] = await db
          .select()
          .from(destinations)
          .where(and(eq(destinations.organizationId, organizationId), eq(destinations.id, route.destinationId)))
          .limit(1)
        if (destination !== undefined) createdDestinations.push(destination)
      }
    }

    const submitUrl = `${appUrl}/s/${form.id}`
    const embed = renderEmbed(submitUrl, undefined)

    const body: z.infer<typeof QuickstartResponseSchema> = {
      form: serializeForm(form, appUrl, [], { submissions: 0, lastSubmissionAt: null }),
      destinations: createdDestinations.map((d) => serializeDestination(d, redact(d))),
      routes: createdRoutes.map(serializeRoute),
      embed,
      verify: {
        curl: `curl -X POST ${submitUrl} -H 'Content-Type: application/json' -d '{"_test":true,"email":"you@example.com","message":"Hello"}'`,
        then: `GET /v1/forms/${form.id}/submissions?limit=1`,
      },
      next:
        createdDestinations.length === 0
          ? [
              {
                why: "Add a destination",
                method: "POST",
                path: "/v1/destinations",
                body: { type: "webhook", config: { url: "https://example.com/hook" } },
              },
            ]
          : [
              {
                why: "Add another destination (Telegram, webhook, …)",
                method: "POST",
                path: "/v1/destinations",
                body: { type: "webhook", config: { url: "https://example.com/hook" } },
              },
            ],
    }
    return c.json(body, 201)
  })
}

function redact(destination: { readonly type: string; readonly config: Readonly<Record<string, unknown>> }): unknown {
  const { config } = destination
  if (destination.type === "telegram") return { ...config, bot_token: "" }
  if (destination.type === "webhook") return { ...config, secret: config["secret"] === undefined ? undefined : "" }
  return config
}
