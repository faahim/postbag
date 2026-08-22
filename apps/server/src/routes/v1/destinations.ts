import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { DestinationInputSchema, newId, PostbagError } from "@postbag/core"
import { and, count, desc, eq, lt, or, type SQL } from "drizzle-orm"
import { destinations, routes, type Database } from "@postbag/db"

import type { AnyDestinationAdapter } from "../../destinations/types.js"
import { decodeCursor, page, parseLimit } from "../../lib/pagination.js"
import { assertPlanCapacity } from "../../lib/planUsage.js"
import { assertScope, type AppEnv } from "../../lib/scope.js"
import { serializeDestination, type DestinationRow } from "../../repo/serialize.js"
import { CursorQuerySchema, DeliveryResultSchema, DestinationSchema, errorResponses, IdSchema } from "../../schemas.js"

const DestinationListSchema = z.object({ data: z.array(DestinationSchema), next_cursor: z.string().nullable() })

const listRoute = createRoute({
  method: "get",
  path: "/v1/destinations",
  operationId: "destinations_list",
  tags: ["destinations"],
  summary: "List destinations (secrets redacted)",
  request: { query: CursorQuerySchema },
  responses: { 200: { description: "ok", content: { "application/json": { schema: DestinationListSchema } } } },
})

const createRouteDef = createRoute({
  method: "post",
  path: "/v1/destinations",
  operationId: "destinations_create",
  tags: ["destinations"],
  summary: "Create a destination",
  description: "type is one of email, telegram, webhook, slack, discord; config shape depends on type. Call destinations_test after creating to verify it works.",
  request: { body: { content: { "application/json": { schema: DestinationInputSchema } } } },
  responses: {
    201: { description: "created", content: { "application/json": { schema: DestinationSchema } } },
    ...errorResponses,
  },
})

const getRoute = createRoute({
  method: "get",
  path: "/v1/destinations/{destinationId}",
  operationId: "destinations_get",
  tags: ["destinations"],
  summary: "Get a destination (secrets redacted)",
  request: { params: z.object({ destinationId: IdSchema }) },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: DestinationSchema } } },
    ...errorResponses,
  },
})

const patchRoute = createRoute({
  method: "patch",
  path: "/v1/destinations/{destinationId}",
  operationId: "destinations_update",
  tags: ["destinations"],
  summary: "Update config",
  request: {
    params: z.object({ destinationId: IdSchema }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().optional().describe("A display label for this destination."),
            config: z
              .record(z.string(), z.unknown())
              .optional()
              .describe("Merged shallowly into the existing config (type-specific: to/cc for email, chat_id/bot_token for telegram, url/secret for webhook)."),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: DestinationSchema } } },
    ...errorResponses,
  },
})

const deleteRoute = createRoute({
  method: "delete",
  path: "/v1/destinations/{destinationId}",
  operationId: "destinations_delete",
  tags: ["destinations"],
  summary: "Delete (fails if routes reference it)",
  description: "Fails with 409 while a route still points at this destination — delete or repoint those routes first.",
  request: { params: z.object({ destinationId: IdSchema }) },
  responses: { 204: { description: "deleted" }, ...errorResponses },
})

const testRoute = createRoute({
  method: "post",
  path: "/v1/destinations/{destinationId}/test",
  operationId: "destinations_test",
  tags: ["destinations"],
  summary: "Send a sample payload now and return the provider response",
  description: "Verifies a destination is actually reachable and configured correctly — do this right after creating one, before wiring routes to it.",
  request: {
    params: z.object({ destinationId: IdSchema }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ sample: z.record(z.string(), z.unknown()).optional().describe("Override the default sample payload sent for the test.") }),
        },
      },
    },
  },
  responses: {
    200: { description: "result", content: { "application/json": { schema: DeliveryResultSchema } } },
    ...errorResponses,
  },
})

/** A destination with no name still has to say *where* it goes — "email" tells nobody
 * anything, "eric@example.com" does. Used when `name` is omitted on create. */
function defaultName(type: string, config: Record<string, unknown>): string {
  const first = (value: unknown): string | undefined => {
    if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined
    return typeof value === "string" && value.length > 0 ? value : undefined
  }
  switch (type) {
    case "email":
      return first(config["to"]) ?? "Email"
    case "telegram": {
      const chat = first(config["chat_id"])
      return chat === undefined ? "Telegram" : `Telegram chat ${chat}`
    }
    case "webhook":
    case "slack":
    case "discord": {
      const url = first(config["url"])
      if (url === undefined) return type.charAt(0).toUpperCase() + type.slice(1)
      try {
        return new URL(url).host
      } catch {
        return url
      }
    }
    default:
      return type
  }
}

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
    const created = await db.transaction(async (tx) => {
      await assertPlanCapacity(tx, scope.organizationId, "destinations")
      const [destination] = await tx
        .insert(destinations)
        .values({
          id: newId("ds"),
          organizationId: scope.organizationId,
          type: input.type,
          name: input.name ?? defaultName(input.type, parsedConfig as Record<string, unknown>),
          config: parsedConfig as Record<string, unknown>,
          verified: true,
        })
        .returning()
      if (destination === undefined) throw new Error("Failed to create destination.")
      return destination
    })
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
