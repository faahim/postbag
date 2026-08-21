import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { newId, PostbagError, RouteInputSchema } from "@postbag/core"
import { and, desc, eq, lt, or, type SQL } from "drizzle-orm"
import { destinations, forms, routes, streams, type Database } from "@postbag/db"

import { decodeCursor, page, parseLimit } from "../../lib/pagination.js"
import { assertScope, type AppEnv } from "../../lib/scope.js"
import { serializeRoute } from "../../repo/serialize.js"
import { CursorQuerySchema, errorResponses, IdSchema, RouteSchema } from "../../schemas.js"

const RouteListSchema = z.object({ data: z.array(RouteSchema), next_cursor: z.string().nullable() })

// RouteInputSchema carries a superRefine (exactly one of form_id/stream_id), and zod
// disallows `.partial()` on refined schemas — hand-roll the patch body instead.
const RoutePatchInputSchema = z.object({
  enabled: z.boolean().optional().describe("Disable a route without deleting it."),
  mode: z
    .object({
      type: z.enum(["instant", "digest"]),
      cron: z.string().optional().describe("Cron expression for digest mode, e.g. '0 9 * * *'."),
      timezone: z.string().optional().describe("IANA timezone the cron runs in; defaults to the org's timezone."),
    })
    .optional()
    .describe("instant delivers as submissions arrive; digest batches into one payload per period."),
  window: z
    .object({ from: z.iso.datetime().nullable().optional(), until: z.iso.datetime().nullable().optional() })
    .optional()
    .describe("Only deliver submissions received in this ISO datetime range."),
  quality: z
    .object({
      exclude_spam: z.boolean().optional(),
      exclude_quarantined: z.boolean().optional(),
    })
    .optional()
    .describe("Defaults to excluding spam and quarantined submissions from delivery."),
  filter: z.string().optional().describe("A JSONata boolean expression; only matching submissions are delivered."),
  transform: z.string().optional().describe("A JSONata expression applied to the payload before delivery."),
})

const listRoute = createRoute({
  method: "get",
  path: "/v1/routes",
  operationId: "routes_list",
  tags: ["routes"],
  summary: "List routes",
  request: {
    query: CursorQuerySchema.extend({
      form: z.string().optional().describe("Filter to routes whose source is this form id."),
      stream: z.string().optional().describe("Filter to routes whose source is this stream id."),
      destination: z.string().optional().describe("Filter to routes pointing at this destination id."),
    }),
  },
  responses: { 200: { description: "ok", content: { "application/json": { schema: RouteListSchema } } } },
})

const createRouteDef = createRoute({
  method: "post",
  path: "/v1/routes",
  operationId: "routes_create",
  tags: ["routes"],
  summary: "Create a route (source is exactly one of form_id / stream_id)",
  description: "A route ties one source (a form or a stream) to one destination, with a mode (instant or digest) and optional filter/transform/quality rules.",
  request: { body: { content: { "application/json": { schema: RouteInputSchema } } } },
  responses: {
    201: { description: "created", content: { "application/json": { schema: RouteSchema } } },
    ...errorResponses,
  },
})

const getRoute = createRoute({
  method: "get",
  path: "/v1/routes/{routeId}",
  operationId: "routes_get",
  tags: ["routes"],
  summary: "Get a route",
  request: { params: z.object({ routeId: IdSchema }) },
  responses: { 200: { description: "ok", content: { "application/json": { schema: RouteSchema } } }, ...errorResponses },
})

const patchRoute = createRoute({
  method: "patch",
  path: "/v1/routes/{routeId}",
  operationId: "routes_update",
  tags: ["routes"],
  summary: "Update rules / enable / disable",
  request: {
    params: z.object({ routeId: IdSchema }),
    body: { content: { "application/json": { schema: RoutePatchInputSchema } } },
  },
  responses: { 200: { description: "ok", content: { "application/json": { schema: RouteSchema } } }, ...errorResponses },
})

const deleteRoute = createRoute({
  method: "delete",
  path: "/v1/routes/{routeId}",
  operationId: "routes_delete",
  tags: ["routes"],
  summary: "Delete a route",
  request: { params: z.object({ routeId: IdSchema }) },
  responses: { 204: { description: "deleted" }, ...errorResponses },
})

async function assertDestinationExists(db: Database, organizationId: string, destinationId: string): Promise<void> {
  const [row] = await db
    .select({ id: destinations.id })
    .from(destinations)
    .where(and(eq(destinations.organizationId, organizationId), eq(destinations.id, destinationId)))
    .limit(1)
  if (row === undefined) throw new PostbagError("not_found", "No destination with that id.")
}

async function assertSourceExists(
  db: Database,
  organizationId: string,
  formId: string | undefined,
  streamId: string | undefined,
): Promise<void> {
  if (formId !== undefined) {
    const [row] = await db
      .select({ id: forms.id })
      .from(forms)
      .where(and(eq(forms.organizationId, organizationId), eq(forms.id, formId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No form with that id.")
  }
  if (streamId !== undefined) {
    const [row] = await db
      .select({ id: streams.id })
      .from(streams)
      .where(and(eq(streams.organizationId, organizationId), eq(streams.id, streamId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No stream with that id.")
  }
}

export function registerRouteResourceRoutes(app: OpenAPIHono<AppEnv>, db: Database): void {
  app.openapi(listRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const query = c.req.valid("query")
    const limit = parseLimit(query.limit)
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor)
    const conditions: SQL[] = [eq(routes.organizationId, scope.organizationId)]
    if (query.form !== undefined) conditions.push(eq(routes.formId, query.form))
    if (query.stream !== undefined) conditions.push(eq(routes.streamId, query.stream))
    if (query.destination !== undefined) conditions.push(eq(routes.destinationId, query.destination))
    if (cursor !== null) {
      const cursorCondition = or(
        lt(routes.createdAt, cursor.createdAt),
        and(eq(routes.createdAt, cursor.createdAt), lt(routes.id, cursor.id)),
      )
      if (cursorCondition !== undefined) conditions.push(cursorCondition)
    }
    const rows = await db
      .select()
      .from(routes)
      .where(and(...conditions))
      .orderBy(desc(routes.createdAt), desc(routes.id))
      .limit(limit + 1)
    const { data, nextCursor } = page(rows, limit)
    const body: z.infer<typeof RouteListSchema> = { data: data.map(serializeRoute), next_cursor: nextCursor }
    return c.json(body)
  })

  app.openapi(createRouteDef, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const input = c.req.valid("json")
    await assertDestinationExists(db, scope.organizationId, input.destination_id)
    await assertSourceExists(db, scope.organizationId, input.form_id, input.stream_id)
    const [created] = await db
      .insert(routes)
      .values({
        id: newId("rt"),
        organizationId: scope.organizationId,
        formId: input.form_id,
        streamId: input.stream_id,
        destinationId: input.destination_id,
        enabled: input.enabled,
        mode: input.mode,
        window: input.window ?? {},
        quality: input.quality ?? { exclude_spam: true, exclude_quarantined: true },
        filter: input.filter,
        transform: input.transform,
      })
      .returning()
    if (created === undefined) throw new Error("Failed to create route.")
    const body: z.infer<typeof RouteSchema> = serializeRoute(created)
    return c.json(body, 201)
  })

  app.openapi(getRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const { routeId } = c.req.valid("param")
    const [row] = await db
      .select()
      .from(routes)
      .where(and(eq(routes.organizationId, scope.organizationId), eq(routes.id, routeId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No route with that id.")
    const body: z.infer<typeof RouteSchema> = serializeRoute(row)
    return c.json(body)
  })

  app.openapi(patchRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { routeId } = c.req.valid("param")
    const input = c.req.valid("json")
    const updates: Partial<typeof routes.$inferInsert> = {}
    if (input.enabled !== undefined) updates.enabled = input.enabled
    if (input.mode !== undefined) updates.mode = input.mode
    if (input.window !== undefined) updates.window = input.window
    if (input.quality !== undefined) updates.quality = input.quality
    if (input.filter !== undefined) updates.filter = input.filter
    if (input.transform !== undefined) updates.transform = input.transform
    updates.updatedAt = new Date()
    const [row] = await db
      .update(routes)
      .set(updates)
      .where(and(eq(routes.organizationId, scope.organizationId), eq(routes.id, routeId)))
      .returning()
    if (row === undefined) throw new PostbagError("not_found", "No route with that id.")
    const body: z.infer<typeof RouteSchema> = serializeRoute(row)
    return c.json(body)
  })

  app.openapi(deleteRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { routeId } = c.req.valid("param")
    const [row] = await db
      .select({ id: routes.id })
      .from(routes)
      .where(and(eq(routes.organizationId, scope.organizationId), eq(routes.id, routeId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No route with that id.")
    await db.delete(routes).where(and(eq(routes.organizationId, scope.organizationId), eq(routes.id, routeId)))
    return c.body(null, 204)
  })
}
