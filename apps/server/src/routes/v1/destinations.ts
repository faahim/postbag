import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { DestinationInputSchema, newId, PostbagError } from "@postbag/core"
import { and, count, desc, eq, lt, or, type SQL } from "drizzle-orm"
import { destinations, routes, type Database } from "@postbag/db"

import type { AnyDestinationAdapter } from "../../destinations/types.js"
import { decodeCursor, page, parseLimit } from "../../lib/pagination.js"
import { assertScope, type AppEnv } from "../../lib/scope.js"
import { serializeDestination, type DestinationRow } from "../../repo/serialize.js"
import { CursorQuerySchema, DeliveryResultSchema, DestinationSchema, errorResponses } from "../../schemas.js"

const DestinationListSchema = z.object({ data: z.array(DestinationSchema), next_cursor: z.string().nullable() })

const listRoute = createRoute({
  method: "get",
  path: "/v1/destinations",
  tags: ["destinations"],
  summary: "List destinations (secrets redacted)",
  request: { query: CursorQuerySchema },
  responses: { 200: { description: "ok", content: { "application/json": { schema: DestinationListSchema } } } },
})

const createRouteDef = createRoute({
  method: "post",
  path: "/v1/destinations",
  tags: ["destinations"],
  summary: "Create a destination",
  request: { body: { content: { "application/json": { schema: DestinationInputSchema } } } },
  responses: {
    201: { description: "created", content: { "application/json": { schema: DestinationSchema } } },
    ...errorResponses,
  },
})

const getRoute = createRoute({
  method: "get",
  path: "/v1/destinations/{destinationId}",
  tags: ["destinations"],
  summary: "Get",
  request: { params: z.object({ destinationId: z.string() }) },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: DestinationSchema } } },
    ...errorResponses,
  },
})

const patchRoute = createRoute({
  method: "patch",
  path: "/v1/destinations/{destinationId}",
  tags: ["destinations"],
  summary: "Update config",
  request: {
    params: z.object({ destinationId: z.string() }),
    body: { content: { "application/json": { schema: z.object({ name: z.string().optional(), config: z.record(z.string(), z.unknown()).optional() }) } } },
  },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: DestinationSchema } } },
    ...errorResponses,
  },
})

const deleteRoute = createRoute({
  method: "delete",
  path: "/v1/destinations/{destinationId}",
  tags: ["destinations"],
  summary: "Delete (fails if routes reference it)",
  request: { params: z.object({ destinationId: z.string() }) },
  responses: { 204: { description: "deleted" }, ...errorResponses },
})

const testRoute = createRoute({
  method: "post",
  path: "/v1/destinations/{destinationId}/test",
  tags: ["destinations"],
  summary: "Send a sample payload now and return the provider response",
  request: {
    params: z.object({ destinationId: z.string() }),
    body: { content: { "application/json": { schema: z.object({ sample: z.record(z.string(), z.unknown()).optional() }) } } },
  },
  responses: {
    200: { description: "result", content: { "application/json": { schema: DeliveryResultSchema } } },
    ...errorResponses,
  },
})

function redactFor(registry: ReadonlyMap<string, AnyDestinationAdapter>, row: DestinationRow): unknown {
  const adapter = registry.get(row.type);
  if (adapter === undefined) return row.config
  try {
    return adapter.redactConfig(row.config)
  } catch {
    return row.config
  }
}

const SAMPLE_PAYLOAD = { name: "Ada Lovelace", email: "ada@example.com", message: "Testing this destination." }

export function registerDestinationRoutes(
  app: OpenAPIHono<AppEnv>,
  db: Database,
  registry: ReadonlyMap<string, AnyDestinationAdapter>,
): void {
  app.openapi(listRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const query = c.req.valid("query")
    const limit = parseLimit(query.limit)
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor)
    const conditions: SQL[] = [eq(destinations.organizationId, scope.organizationId)]
    if (cursor !== null) {
      const cursorCondition = or(
        lt(destinations.createdAt, cursor.createdAt),
        and(eq(destinations.createdAt, cursor.createdAt), lt(destinations.id, cursor.id)),
      )
      if (cursorCondition !== undefined) conditions.push(cursorCondition)
    }
    const rows = await db
      .select()
      .from(destinations)
      .where(and(...conditions))
      .orderBy(desc(destinations.createdAt), desc(destinations.id))
      .limit(limit + 1)
    const { data, nextCursor } = page(rows, limit)
    const body: z.infer<typeof DestinationListSchema> = {
      data: data.map((row) => serializeDestination(row, redactFor(registry, row))),
      next_cursor: nextCursor,
    }
    return c.json(body)
  })

  app.openapi(createRouteDef, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const input = c.req.valid("json")
    const adapter = registry.get(input.type)
    if (adapter === undefined) {
      throw new PostbagError("validation_failed", `Destination type '${input.type}' is not supported yet.`)
    }
    const parsedConfig = adapter.configSchema.parse(input.config)
    const [created] = await db
      .insert(destinations)
      .values({
        id: newId("ds"),
        organizationId: scope.organizationId,
        type: input.type,
        name: input.name ?? input.type,
        config: parsedConfig as Record<string, unknown>,
        verified: true,
      })
      .returning()
    if (created === undefined) throw new Error("Failed to create destination.")
    const body: z.infer<typeof DestinationSchema> = serializeDestination(created, redactFor(registry, created))
    return c.json(body, 201)
  })

  app.openapi(getRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const { destinationId } = c.req.valid("param")
    const [row] = await db
      .select()
      .from(destinations)
      .where(and(eq(destinations.organizationId, scope.organizationId), eq(destinations.id, destinationId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No destination with that id.")
    const body: z.infer<typeof DestinationSchema> = serializeDestination(row, redactFor(registry, row))
    return c.json(body)
  })

  app.openapi(patchRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { destinationId } = c.req.valid("param")
    const input = c.req.valid("json")
    const [existing] = await db
      .select()
      .from(destinations)
      .where(and(eq(destinations.organizationId, scope.organizationId), eq(destinations.id, destinationId)))
      .limit(1)
    if (existing === undefined) throw new PostbagError("not_found", "No destination with that id.")
    const adapter = registry.get(existing.type)
    const mergedConfig = { ...existing.config, ...(input.config ?? {}) }
    const parsedConfig = adapter === undefined ? mergedConfig : adapter.configSchema.parse(mergedConfig)
    const [updated] = await db
      .update(destinations)
      .set({
        name: input.name ?? existing.name,
        config: parsedConfig as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(and(eq(destinations.organizationId, scope.organizationId), eq(destinations.id, destinationId)))
      .returning()
    if (updated === undefined) throw new Error("Failed to update destination.")
    const body: z.infer<typeof DestinationSchema> = serializeDestination(updated, redactFor(registry, updated))
    return c.json(body)
  })

  app.openapi(deleteRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { destinationId } = c.req.valid("param")
    const [row] = await db
      .select({ id: destinations.id })
      .from(destinations)
      .where(and(eq(destinations.organizationId, scope.organizationId), eq(destinations.id, destinationId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No destination with that id.")
    const [routeCountRow] = await db
      .select({ value: count() })
      .from(routes)
      .where(and(eq(routes.organizationId, scope.organizationId), eq(routes.destinationId, destinationId)))
    if ((routeCountRow?.value ?? 0) > 0) {
      throw new PostbagError("conflict", "Delete or repoint routes using this destination before deleting it.")
    }
    await db
      .delete(destinations)
      .where(and(eq(destinations.organizationId, scope.organizationId), eq(destinations.id, destinationId)))
    return c.body(null, 204)
  })

  app.openapi(testRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { destinationId } = c.req.valid("param")
    const { sample } = c.req.valid("json")
    const [row] = await db
      .select()
      .from(destinations)
      .where(and(eq(destinations.organizationId, scope.organizationId), eq(destinations.id, destinationId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No destination with that id.")
    const adapter = registry.get(row.type)
    if (adapter === undefined) {
      throw new PostbagError("validation_failed", `Destination type '${row.type}' is not supported yet.`)
    }
    const result = await adapter.test(row.config, sample ?? SAMPLE_PAYLOAD)
    const body: z.infer<typeof DeliveryResultSchema> = result
    return c.json(body)
  })
}
