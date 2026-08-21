import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { applyMapping, PostbagError, type Mapping } from "@postbag/core"
import { and, desc, eq, lt, or, type SQL } from "drizzle-orm"
import { deliveries, forms, notifyDeliveries, routes, streamSchemas, streamSources, submissions, type Database } from "@postbag/db"

import { decodeCursor, page, parseLimit } from "../../lib/pagination.js"
import { assertScope, type AppEnv } from "../../lib/scope.js"
import { serializeDelivery } from "../../repo/serialize.js"
import { CursorQuerySchema, DeliverySchema, errorResponses, IdSchema } from "../../schemas.js"

const DeliveryListSchema = z.object({ data: z.array(DeliverySchema), next_cursor: z.string().nullable() })

const listRoute = createRoute({
  method: "get",
  path: "/v1/deliveries",
  operationId: "deliveries_list",
  tags: ["deliveries"],
  summary: "List deliveries (the outbox)",
  description: "A submission is a row before it is anything else; delivery is this outbox drained by a worker. Poll here to confirm a submission actually arrived at its destination.",
  request: {
    query: CursorQuerySchema.extend({
      status: z.string().optional().describe("Filter by status: pending, sending, sent, failed, dead or skipped."),
      route: z.string().optional().describe("Filter to one route id."),
      destination: z.string().optional().describe("Filter to one destination id."),
      submission: z.string().optional().describe("Filter to one submission id."),
    }),
  },
  responses: { 200: { description: "ok", content: { "application/json": { schema: DeliveryListSchema } } } },
})

const getRoute = createRoute({
  method: "get",
  path: "/v1/deliveries/{deliveryId}",
  operationId: "deliveries_get",
  tags: ["deliveries"],
  summary: "Get a delivery with payload snapshot and last response",
  request: { params: z.object({ deliveryId: IdSchema }) },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: DeliverySchema } } },
    ...errorResponses,
  },
})

const retryRoute = createRoute({
  method: "post",
  path: "/v1/deliveries/{deliveryId}/retry",
  operationId: "deliveries_retry",
  tags: ["deliveries"],
  summary: "Re-snapshot the payload against current mapping/transform and queue again",
  description: "Use after fixing a destination's config or a stream's mapping so a `failed` or `dead` delivery gets another chance.",
  request: { params: z.object({ deliveryId: IdSchema }) },
  responses: {
    202: { description: "queued", content: { "application/json": { schema: DeliverySchema } } },
    ...errorResponses,
  },
})

export function registerDeliveryRoutes(app: OpenAPIHono<AppEnv>, db: Database): void {
  app.openapi(listRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const query = c.req.valid("query")
    const limit = parseLimit(query.limit)
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor)
    const conditions: SQL[] = [eq(deliveries.organizationId, scope.organizationId)]
    if (query.status !== undefined) conditions.push(eq(deliveries.status, query.status))
    if (query.route !== undefined) conditions.push(eq(deliveries.routeId, query.route))
    if (query.destination !== undefined) conditions.push(eq(deliveries.destinationId, query.destination))
    if (query.submission !== undefined) conditions.push(eq(deliveries.submissionId, query.submission))
    if (cursor !== null) {
      const cursorCondition = or(
        lt(deliveries.createdAt, cursor.createdAt),
        and(eq(deliveries.createdAt, cursor.createdAt), lt(deliveries.id, cursor.id)),
      )
      if (cursorCondition !== undefined) conditions.push(cursorCondition)
    }
    const rows = await db
      .select()
      .from(deliveries)
      .where(and(...conditions))
      .orderBy(desc(deliveries.createdAt), desc(deliveries.id))
      .limit(limit + 1)
    const { data, nextCursor } = page(rows, limit)
    const body: z.infer<typeof DeliveryListSchema> = { data: data.map(serializeDelivery), next_cursor: nextCursor }
    return c.json(body)
  })

  app.openapi(getRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const { deliveryId } = c.req.valid("param")
    const [row] = await db
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.organizationId, scope.organizationId), eq(deliveries.id, deliveryId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No delivery with that id.")
    const body: z.infer<typeof DeliverySchema> = serializeDelivery(row)
    return c.json(body)
  })

  app.openapi(retryRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { deliveryId } = c.req.valid("param")
    const [delivery] = await db
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.organizationId, scope.organizationId), eq(deliveries.id, deliveryId)))
      .limit(1)
    if (delivery === undefined) throw new PostbagError("not_found", "No delivery with that id.")

    const [route] = await db
      .select()
      .from(routes)
      .where(and(eq(routes.organizationId, scope.organizationId), eq(routes.id, delivery.routeId)))
      .limit(1)
    const [submission] = await db
      .select()
      .from(submissions)
      .where(and(eq(submissions.organizationId, scope.organizationId), eq(submissions.id, delivery.submissionId)))
      .limit(1)

    let payload: Readonly<Record<string, unknown>> = submission?.data ?? delivery.payload
    if (route?.streamId !== null && route?.streamId !== undefined && submission !== undefined) {
      const [form] = await db
        .select()
        .from(forms)
        .where(and(eq(forms.organizationId, scope.organizationId), eq(forms.id, submission.formId)))
        .limit(1)
      if (form !== undefined) {
        const [source] = await db
          .select()
          .from(streamSources)
          .where(and(eq(streamSources.organizationId, scope.organizationId), eq(streamSources.streamId, route.streamId), eq(streamSources.formId, form.id)))
          .limit(1)
        if (source !== undefined) {
          const [streamSchema] = await db
            .select({ jsonSchema: streamSchemas.jsonSchema })
            .from(streamSchemas)
            .where(and(eq(streamSchemas.streamId, route.streamId), eq(streamSchemas.version, source.streamSchemaVersion)))
            .limit(1)
          if (streamSchema !== undefined) {
            const mapped = applyMapping(submission.data, source.mapping as unknown as Mapping, streamSchema.jsonSchema)
            payload = mapped.payload
          }
        }
      }
    }

    const [updated] = await db
      .update(deliveries)
      .set({
        status: "pending",
        payload,
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
      })
      .where(and(eq(deliveries.organizationId, scope.organizationId), eq(deliveries.id, deliveryId)))
      .returning()
    if (updated === undefined) throw new Error("Failed to retry delivery.")
    await notifyDeliveries(db)
    const body: z.infer<typeof DeliverySchema> = serializeDelivery(updated)
    return c.json(body, 202)
  })
}
