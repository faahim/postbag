import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { newId, PostbagError, SystemWebhookInputSchema } from "@postbag/core"
import { and, desc, eq, lt, or, type SQL } from "drizzle-orm"
import { events, systemWebhookDeliveries, systemWebhooks, type Database } from "@postbag/db"

import { decodeCursor, page, parseLimit } from "../../lib/pagination.js"
import { assertScope, type AppEnv } from "../../lib/scope.js"
import { serializeEvent, serializeSystemWebhook, serializeSystemWebhookDelivery } from "../../repo/serialize.js"
import {
  CursorQuerySchema,
  errorResponses,
  EventSchema,
  IdSchema,
  SystemWebhookDeliverySchema,
  SystemWebhookSchema,
} from "../../schemas.js"

const EventListSchema = z.object({ data: z.array(EventSchema), next_cursor: z.string().nullable() })

const listEventsRoute = createRoute({
  method: "get",
  path: "/v1/events",
  operationId: "events_list",
  tags: ["events"],
  summary: "Organization event log",
  description: "Every notable thing that happened in this org — form.created, form.schema.changed, stream.schema.changed, submission.received, and more. System webhooks (below) are just subscriptions to this same log.",
  request: {
    query: CursorQuerySchema.extend({
      type: z.string().optional().describe("Filter to one event type, e.g. 'submission.received'."),
      since: z.string().optional().describe("ISO timestamp; only events after this."),
    }),
  },
  responses: { 200: { description: "ok", content: { "application/json": { schema: EventListSchema } } } },
})

const listWebhooksRoute = createRoute({
  method: "get",
  path: "/v1/webhooks",
  operationId: "webhooks_list",
  tags: ["events"],
  summary: "List system webhooks",
  description: "System webhooks notify an external system when org events happen (not to be confused with a webhook destination, which delivers submissions).",
  responses: {
    200: { description: "ok", content: { "application/json": { schema: z.array(SystemWebhookSchema) } } },
  },
})

const createWebhookRoute = createRoute({
  method: "post",
  path: "/v1/webhooks",
  operationId: "webhooks_create",
  tags: ["events"],
  summary: "Subscribe a URL to event types",
  description: "Every delivery is signed with the returned (or supplied) secret so the receiver can verify authenticity.",
  request: { body: { content: { "application/json": { schema: SystemWebhookInputSchema } } } },
  responses: {
    201: { description: "created", content: { "application/json": { schema: SystemWebhookSchema } } },
    ...errorResponses,
  },
})

const patchWebhookRoute = createRoute({
  method: "patch",
  path: "/v1/webhooks/{webhookId}",
  operationId: "webhooks_update",
  tags: ["events"],
  summary: "Update a system webhook",
  request: {
    params: z.object({ webhookId: IdSchema }),
    body: { content: { "application/json": { schema: SystemWebhookInputSchema.partial() } } },
  },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: SystemWebhookSchema } } },
    ...errorResponses,
  },
})

const deleteWebhookRoute = createRoute({
  method: "delete",
  path: "/v1/webhooks/{webhookId}",
  operationId: "webhooks_delete",
  tags: ["events"],
  summary: "Delete a system webhook",
  request: { params: z.object({ webhookId: IdSchema }) },
  responses: { 204: { description: "deleted" }, ...errorResponses },
})

const WebhookDeliveryListSchema = z.object({
  data: z.array(SystemWebhookDeliverySchema),
  next_cursor: z.string().nullable(),
})

const listWebhookDeliveriesRoute = createRoute({
  method: "get",
  path: "/v1/webhooks/{webhookId}/deliveries",
  operationId: "webhooks_deliveries",
  tags: ["events"],
  summary: "Delivery history for a system webhook",
  request: { params: z.object({ webhookId: IdSchema }), query: CursorQuerySchema },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: WebhookDeliveryListSchema } } },
    ...errorResponses,
  },
})

export function registerEventRoutes(app: OpenAPIHono<AppEnv>, db: Database): void {
  app.openapi(listEventsRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const query = c.req.valid("query")
    const limit = parseLimit(query.limit)
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor)
    const conditions: SQL[] = [eq(events.organizationId, scope.organizationId)]
    if (query.type !== undefined) conditions.push(eq(events.type, query.type))
    if (cursor !== null) {
      const cursorCondition = or(
        lt(events.createdAt, cursor.createdAt),
        and(eq(events.createdAt, cursor.createdAt), lt(events.id, cursor.id)),
      )
      if (cursorCondition !== undefined) conditions.push(cursorCondition)
    }
    const rows = await db
      .select()
      .from(events)
      .where(and(...conditions))
      .orderBy(desc(events.createdAt), desc(events.id))
      .limit(limit + 1)
    const { data, nextCursor } = page(rows, limit)
    const body: z.infer<typeof EventListSchema> = { data: data.map(serializeEvent), next_cursor: nextCursor }
    return c.json(body)
  })

  app.openapi(listWebhooksRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const rows = await db.select().from(systemWebhooks).where(eq(systemWebhooks.organizationId, scope.organizationId))
    const body: z.infer<typeof SystemWebhookSchema>[] = rows.map(serializeSystemWebhook)
    return c.json(body)
  })

  app.openapi(createWebhookRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const input = c.req.valid("json")
    const [created] = await db
      .insert(systemWebhooks)
      .values({
        id: newId("wh"),
        organizationId: scope.organizationId,
        url: input.url,
        events: [...input.events],
        secret: input.secret ?? globalThis.crypto.randomUUID(),
        enabled: input.enabled,
      })
      .returning()
    if (created === undefined) throw new Error("Failed to create webhook.")
    const body: z.infer<typeof SystemWebhookSchema> = serializeSystemWebhook(created)
    return c.json(body, 201)
  })

  app.openapi(patchWebhookRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { webhookId } = c.req.valid("param")
    const input = c.req.valid("json")
    const updates: Partial<typeof systemWebhooks.$inferInsert> = {}
    if (input.url !== undefined) updates.url = input.url
    if (input.events !== undefined) updates.events = [...input.events]
    if (input.secret !== undefined) updates.secret = input.secret
    if (input.enabled !== undefined) updates.enabled = input.enabled
    updates.updatedAt = new Date()
    const [row] = await db
      .update(systemWebhooks)
      .set(updates)
      .where(and(eq(systemWebhooks.organizationId, scope.organizationId), eq(systemWebhooks.id, webhookId)))
      .returning()
    if (row === undefined) throw new PostbagError("not_found", "No webhook with that id.")
    const body: z.infer<typeof SystemWebhookSchema> = serializeSystemWebhook(row)
    return c.json(body)
  })

  app.openapi(deleteWebhookRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { webhookId } = c.req.valid("param")
    const [row] = await db
      .select({ id: systemWebhooks.id })
      .from(systemWebhooks)
      .where(and(eq(systemWebhooks.organizationId, scope.organizationId), eq(systemWebhooks.id, webhookId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No webhook with that id.")
    await db
      .delete(systemWebhooks)
      .where(and(eq(systemWebhooks.organizationId, scope.organizationId), eq(systemWebhooks.id, webhookId)))
    return c.body(null, 204)
  })

  app.openapi(listWebhookDeliveriesRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const { webhookId } = c.req.valid("param")
    const [webhook] = await db
      .select({ id: systemWebhooks.id })
      .from(systemWebhooks)
      .where(and(eq(systemWebhooks.organizationId, scope.organizationId), eq(systemWebhooks.id, webhookId)))
      .limit(1)
    if (webhook === undefined) throw new PostbagError("not_found", "No webhook with that id.")

    const query = c.req.valid("query")
    const limit = parseLimit(query.limit)
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor)
    const conditions: SQL[] = [
      eq(systemWebhookDeliveries.organizationId, scope.organizationId),
      eq(systemWebhookDeliveries.webhookId, webhookId),
    ]
    if (cursor !== null) {
      const cursorCondition = or(
        lt(systemWebhookDeliveries.createdAt, cursor.createdAt),
        and(eq(systemWebhookDeliveries.createdAt, cursor.createdAt), lt(systemWebhookDeliveries.id, cursor.id)),
      )
      if (cursorCondition !== undefined) conditions.push(cursorCondition)
    }
    const rows = await db
      .select()
      .from(systemWebhookDeliveries)
      .where(and(...conditions))
      .orderBy(desc(systemWebhookDeliveries.createdAt), desc(systemWebhookDeliveries.id))
      .limit(limit + 1)
    const { data, nextCursor } = page(rows, limit)
    const body: z.infer<typeof WebhookDeliveryListSchema> = {
      data: data.map(serializeSystemWebhookDelivery),
      next_cursor: nextCursor,
    }
    return c.json(body)
  })
}
