import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { applyMapping, newId, PostbagError, StreamInputSchema, validateMapping, type Mapping } from "@postbag/core"
import { and, count, desc, eq, gte, lt, or, type SQL } from "drizzle-orm"
import {
  events,
  formSchemas,
  forms,
  routes,
  streamSchemas,
  streamSources,
  streams,
  submissions,
  type Database,
} from "@postbag/db"

import { decodeCursor, page, parseLimit } from "../../lib/pagination.js"
import { assertScope, type AppEnv } from "../../lib/scope.js"
import { asJson, serializeRoute, serializeStream } from "../../repo/serialize.js"
import {
  CursorQuerySchema,
  errorResponses,
  IdSchema,
  JsonRecord,
  SafeSchemaInputSchema,
  SafeStreamSourceInputSchema,
  SchemaVersionSchema,
  StreamDetailSchema,
  StreamSchema,
  StreamSourceSchema,
  type RouteSchema,
} from "../../schemas.js"

const StreamListSchema = z.object({ data: z.array(StreamSchema), next_cursor: z.string().nullable() })
// StreamInputSchema embeds core's recursive z.json() schema (nested schema/mapping
// fields) that crashes OpenAPI doc generation — swap in the safe versions.
const SafeStreamInputSchema = StreamInputSchema.extend({
  schema: SafeSchemaInputSchema.optional(),
  sources: z.array(SafeStreamSourceInputSchema).default([]),
})

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "")
  return base.length === 0 ? "stream" : base.slice(0, 50)
}

async function getStreamCounts(db: Database, organizationId: string, streamId: string) {
  const [sourceCount] = await db
    .select({ value: count() })
    .from(streamSources)
    .where(and(eq(streamSources.organizationId, organizationId), eq(streamSources.streamId, streamId)))
  const [routeCount] = await db
    .select({ value: count() })
    .from(routes)
    .where(and(eq(routes.organizationId, organizationId), eq(routes.streamId, streamId)))
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000)
  const [submissionCount] = await db
    .select({ value: count() })
    .from(submissions)
    .innerJoin(streamSources, eq(streamSources.formId, submissions.formId))
    .where(
      and(
        eq(submissions.organizationId, organizationId),
        eq(streamSources.streamId, streamId),
        gte(submissions.receivedAt, since),
      ),
    )
  return {
    sources: sourceCount?.value ?? 0,
    routes: routeCount?.value ?? 0,
    submissions30d: submissionCount?.value ?? 0,
  }
}

const listRoute = createRoute({
  method: "get",
  path: "/v1/streams",
  operationId: "streams_list",
  tags: ["streams"],
  summary: "List streams",
  request: { query: CursorQuerySchema },
  responses: { 200: { description: "ok", content: { "application/json": { schema: StreamListSchema } } } },
})

const createRouteDef = createRoute({
  method: "post",
  path: "/v1/streams",
  operationId: "streams_create",
  tags: ["streams"],
  summary: "Create a stream (optionally with its first schema version and sources)",
  description: "A stream (shown as 'Bag' in the dashboard) fans one canonical schema in from many forms.",
  request: { body: { content: { "application/json": { schema: SafeStreamInputSchema } } } },
  responses: {
    201: { description: "created", content: { "application/json": { schema: StreamSchema } } },
    ...errorResponses,
  },
})

const getRoute = createRoute({
  method: "get",
  path: "/v1/streams/{streamId}",
  operationId: "streams_get",
  tags: ["streams"],
  summary: "Get a stream with schema, sources, mapping status and routes",
  request: { params: z.object({ streamId: IdSchema }) },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: StreamDetailSchema } } },
    ...errorResponses,
  },
})

const patchRoute = createRoute({
  method: "patch",
  path: "/v1/streams/{streamId}",
  operationId: "streams_update",
  tags: ["streams"],
  summary: "Update name/slug",
  request: {
    params: z.object({ streamId: IdSchema }),
    body: { content: { "application/json": { schema: SafeStreamInputSchema.partial() } } },
  },
  responses: { 200: { description: "ok", content: { "application/json": { schema: StreamSchema } } }, ...errorResponses },
})

const deleteRoute = createRoute({
  method: "delete",
  path: "/v1/streams/{streamId}",
  operationId: "streams_delete",
  tags: ["streams"],
  summary: "Delete a stream",
  request: { params: z.object({ streamId: IdSchema }) },
  responses: { 204: { description: "deleted" }, ...errorResponses },
})

const getSchemaRoute = createRoute({
  method: "get",
  path: "/v1/streams/{streamId}/schema",
  operationId: "streams_schema_get",
  tags: ["streams"],
  summary: "Current stream schema",
  request: { params: z.object({ streamId: IdSchema }) },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: SchemaVersionSchema } } },
    ...errorResponses,
  },
})

const publishSchemaRoute = createRoute({
  method: "post",
  path: "/v1/streams/{streamId}/schema",
  operationId: "streams_schema_publish",
  tags: ["streams"],
  summary: "Publish a new stream schema version",
  description:
    "Schemas are immutable versions — this always creates version N+1. Re-validates every attached " +
    "source's mapping against the new schema and returns the updated mapping statuses alongside it.",
  request: {
    params: z.object({ streamId: IdSchema }),
    body: { content: { "application/json": { schema: SafeSchemaInputSchema } } },
  },
  responses: {
    201: {
      description: "published",
      content: {
        "application/json": {
          schema: z.object({ schema: SchemaVersionSchema, mappings: z.array(StreamSourceSchema) }),
        },
      },
    },
    ...errorResponses,
  },
})

const listSourcesRoute = createRoute({
  method: "get",
  path: "/v1/streams/{streamId}/sources",
  operationId: "streams_sources_list",
  tags: ["streams"],
  summary: "List sources and their mapping status",
  request: { params: z.object({ streamId: IdSchema }) },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: z.array(StreamSourceSchema) } } },
  },
})

const attachSourceRoute = createRoute({
  method: "post",
  path: "/v1/streams/{streamId}/sources",
  operationId: "streams_sources_add",
  tags: ["streams"],
  summary: "Attach a form or selector with a mapping",
  description:
    "Fails 422 mapping_incomplete (with the missing fields listed) if the mapping does not cover every " +
    "field the stream's current schema requires — a form can't join a stream it can't feed.",
  request: {
    params: z.object({ streamId: IdSchema }),
    body: { content: { "application/json": { schema: SafeStreamSourceInputSchema } } },
  },
  responses: {
    201: { description: "attached", content: { "application/json": { schema: StreamSourceSchema } } },
    ...errorResponses,
  },
})

const updateSourceRoute = createRoute({
  method: "patch",
  path: "/v1/streams/{streamId}/sources/{sourceId}",
  operationId: "streams_sources_update",
  tags: ["streams"],
  summary: "Update the mapping",
  request: {
    params: z.object({ streamId: IdSchema, sourceId: IdSchema }),
    body: { content: { "application/json": { schema: SafeStreamSourceInputSchema } } },
  },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: StreamSourceSchema } } },
    ...errorResponses,
  },
})

const deleteSourceRoute = createRoute({
  method: "delete",
  path: "/v1/streams/{streamId}/sources/{sourceId}",
  operationId: "streams_sources_remove",
  tags: ["streams"],
  summary: "Detach",
  request: { params: z.object({ streamId: IdSchema, sourceId: IdSchema }) },
  responses: { 204: { description: "detached" }, ...errorResponses },
})

const PreviewResponseSchema = z.object({ payload: JsonRecord, extras: JsonRecord, problems: z.array(z.string()) })

const previewRoute = createRoute({
  method: "post",
  path: "/v1/streams/{streamId}/preview",
  operationId: "streams_preview",
  tags: ["streams"],
  summary: "Run a sample submission through a source's mapping",
  description: "Dry-runs a form's attached mapping against sample data without storing anything — useful before publishing a schema change.",
  request: {
    params: z.object({ streamId: IdSchema }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            form_id: IdSchema.describe("The form whose attached mapping to run."),
            data: z.record(z.string(), z.unknown()).describe("Sample submission data to map through."),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "ok",
      content: {
        "application/json": { schema: PreviewResponseSchema },
      },
    },
  },
})

export function registerStreamRoutes(app: OpenAPIHono<AppEnv>, db: Database): void {
  app.openapi(listRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const query = c.req.valid("query")
    const limit = parseLimit(query.limit)
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor)
    const conditions: SQL[] = [eq(streams.organizationId, scope.organizationId)]
    if (cursor !== null) {
      const cursorCondition = or(
        lt(streams.createdAt, cursor.createdAt),
        and(eq(streams.createdAt, cursor.createdAt), lt(streams.id, cursor.id)),
      )
      if (cursorCondition !== undefined) conditions.push(cursorCondition)
    }
    const rows = await db
      .select()
      .from(streams)
      .where(and(...conditions))
      .orderBy(desc(streams.createdAt), desc(streams.id))
      .limit(limit + 1)
    const { data, nextCursor } = page(rows, limit)
    const serialized = await Promise.all(
      data.map(async (row) => serializeStream(row, await getStreamCounts(db, scope.organizationId, row.id))),
    )
    const body: z.infer<typeof StreamListSchema> = { data: serialized, next_cursor: nextCursor }
    return c.json(body)
  })

  app.openapi(createRouteDef, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const input = c.req.valid("json")
    const slug = input.slug ?? slugify(input.name ?? "stream")
    const [existing] = await db
      .select()
      .from(streams)
      .where(and(eq(streams.organizationId, scope.organizationId), eq(streams.slug, slug)))
      .limit(1)
    if (existing !== undefined) {
      if (input.if_exists === "return") {
        const body: z.infer<typeof StreamSchema> = serializeStream(
          existing,
          await getStreamCounts(db, scope.organizationId, existing.id),
        )
        return c.json(body, 201)
      }
      throw new PostbagError("conflict", `A stream with slug '${slug}' already exists.`)
    }

    const created = await db.transaction(async (tx) => {
      const [createdStream] = await tx
        .insert(streams)
        .values({ id: newId("st"), organizationId: scope.organizationId, slug, name: input.name ?? slug })
        .returning()
      if (createdStream === undefined) throw new Error("Failed to create stream.")

      let schemaVersion: number | null = null
      let schemaJson: Record<string, unknown> | null = null
      if (input.schema !== undefined) {
        const [schemaRow] = await tx
          .insert(streamSchemas)
          .values({
            id: newId("ss"),
            organizationId: scope.organizationId,
            streamId: createdStream.id,
            version: 1,
            jsonSchema: input.schema.json_schema,
            ui: input.schema.ui ?? {},
            changelog: input.schema.changelog,
          })
          .returning()
        if (schemaRow !== undefined) {
          await tx.update(streams).set({ currentSchemaVersion: 1 }).where(eq(streams.id, createdStream.id))
          schemaVersion = 1
          schemaJson = schemaRow.jsonSchema
        }
      }

      for (const source of input.sources) {
        if (schemaJson === null || schemaVersion === null) {
          throw new PostbagError("validation_failed", "Attach sources only after (or while) publishing a schema.")
        }
        let formSchemaJson: Record<string, unknown> | undefined
        if (source.form_id !== undefined) {
          const [form] = await tx.select().from(forms).where(eq(forms.id, source.form_id)).limit(1)
          if (form?.currentSchemaVersion !== null && form?.currentSchemaVersion !== undefined) {
            const [formSchema] = await tx
              .select({ jsonSchema: formSchemas.jsonSchema })
              .from(formSchemas)
              .where(and(eq(formSchemas.formId, form.id), eq(formSchemas.version, form.currentSchemaVersion)))
              .limit(1)
            formSchemaJson = formSchema?.jsonSchema
          }
        }
        const validation = validateMapping(source.mapping as unknown as Mapping, schemaJson, formSchemaJson)
        if (validation.status === "incomplete") {
          throw new PostbagError(
            "mapping_incomplete",
            `Stream requires fields this source does not provide: ${validation.missing.join(", ")}.`,
            { missing: validation.missing },
          )
        }
        await tx.insert(streamSources).values({
          id: newId("src"),
          organizationId: scope.organizationId,
          streamId: createdStream.id,
          formId: source.form_id,
          selector: source.selector,
          mapping: source.mapping,
          mappingStatus: validation.status,
          missing: [...validation.missing],
          streamSchemaVersion: schemaVersion,
        })
      }

      return createdStream
    })

    const body: z.infer<typeof StreamSchema> = serializeStream(created, { sources: 0, routes: 0, submissions30d: 0 })
    return c.json(body, 201)
  })

  app.openapi(getRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const { streamId } = c.req.valid("param")
    const [row] = await db
      .select()
      .from(streams)
      .where(and(eq(streams.organizationId, scope.organizationId), eq(streams.id, streamId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No stream with that id.")

    const counts = await getStreamCounts(db, scope.organizationId, streamId)
    let schema: z.infer<typeof SchemaVersionSchema> | undefined
    if (row.currentSchemaVersion !== null) {
      const [schemaRow] = await db
        .select()
        .from(streamSchemas)
        .where(and(eq(streamSchemas.streamId, streamId), eq(streamSchemas.version, row.currentSchemaVersion)))
        .limit(1)
      if (schemaRow !== undefined) {
        schema = {
          json_schema: asJson(schemaRow.jsonSchema),
          ui: asJson(schemaRow.ui),
          version: schemaRow.version,
          created_at: schemaRow.createdAt.toISOString(),
        }
      }
    }
    const sourceRows = await db
      .select()
      .from(streamSources)
      .where(and(eq(streamSources.organizationId, scope.organizationId), eq(streamSources.streamId, streamId)))
    const routeRows = await db
      .select()
      .from(routes)
      .where(and(eq(routes.organizationId, scope.organizationId), eq(routes.streamId, streamId)))

    const body: z.infer<typeof StreamDetailSchema> = {
      ...serializeStream(row, counts),
      schema,
      sources: sourceRows.map((source) => ({
        id: source.id,
        form_id: source.formId ?? undefined,
        selector: source.selector ?? undefined,
        mapping: asJson(source.mapping),
        mapping_status: source.mappingStatus === "incomplete" ? "incomplete" : "valid",
        missing: source.missing,
        stream_schema_version: source.streamSchemaVersion,
      })),
      routes: routeRows.map((route): z.infer<typeof RouteSchema> => serializeRoute(route)),
    }
    return c.json(body)
  })

  app.openapi(patchRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { streamId } = c.req.valid("param")
    const input = c.req.valid("json")
    const updates: Partial<typeof streams.$inferInsert> = {}
    if (input.name !== undefined) updates.name = input.name
    if (input.slug !== undefined) updates.slug = input.slug
    updates.updatedAt = new Date()
    const [row] = await db
      .update(streams)
      .set(updates)
      .where(and(eq(streams.organizationId, scope.organizationId), eq(streams.id, streamId)))
      .returning()
    if (row === undefined) throw new PostbagError("not_found", "No stream with that id.")
    const body: z.infer<typeof StreamSchema> = serializeStream(row, await getStreamCounts(db, scope.organizationId, streamId))
    return c.json(body)
  })

  app.openapi(deleteRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { streamId } = c.req.valid("param")
    const [row] = await db
      .select({ id: streams.id })
      .from(streams)
      .where(and(eq(streams.organizationId, scope.organizationId), eq(streams.id, streamId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No stream with that id.")
    await db.delete(streams).where(and(eq(streams.organizationId, scope.organizationId), eq(streams.id, streamId)))
    return c.body(null, 204)
  })

  app.openapi(getSchemaRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const { streamId } = c.req.valid("param")
    const [row] = await db
      .select()
      .from(streams)
      .where(and(eq(streams.organizationId, scope.organizationId), eq(streams.id, streamId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No stream with that id.")
    if (row.currentSchemaVersion === null) throw new PostbagError("not_found", "This stream has no published schema.")
    const [schemaRow] = await db
      .select()
      .from(streamSchemas)
      .where(and(eq(streamSchemas.streamId, streamId), eq(streamSchemas.version, row.currentSchemaVersion)))
      .limit(1)
    if (schemaRow === undefined) throw new PostbagError("not_found", "Schema version not found.")
    const body: z.infer<typeof SchemaVersionSchema> = {
      json_schema: asJson(schemaRow.jsonSchema),
      ui: asJson(schemaRow.ui),
      changelog: schemaRow.changelog ?? undefined,
      version: schemaRow.version,
      created_at: schemaRow.createdAt.toISOString(),
    }
    return c.json(body)
  })

  app.openapi(publishSchemaRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { streamId } = c.req.valid("param")
    const input = c.req.valid("json")
    const [row] = await db
      .select()
      .from(streams)
      .where(and(eq(streams.organizationId, scope.organizationId), eq(streams.id, streamId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No stream with that id.")

    const nextVersion = (row.currentSchemaVersion ?? 0) + 1
    const [schemaRow] = await db
      .insert(streamSchemas)
      .values({
        id: newId("ss"),
        organizationId: scope.organizationId,
        streamId,
        version: nextVersion,
        jsonSchema: input.json_schema,
        ui: input.ui ?? {},
        changelog: input.changelog,
      })
      .returning()
    if (schemaRow === undefined) throw new Error("Failed to publish stream schema.")
    await db.update(streams).set({ currentSchemaVersion: nextVersion, updatedAt: new Date() }).where(eq(streams.id, streamId))
    await db.insert(events).values({
      id: newId("ev"),
      organizationId: scope.organizationId,
      type: "stream.schema.changed",
      subject: { stream_id: streamId },
      data: { version: nextVersion },
    })

    const sources = await db
      .select()
      .from(streamSources)
      .where(and(eq(streamSources.organizationId, scope.organizationId), eq(streamSources.streamId, streamId)))
    const updatedSources: z.infer<typeof StreamSourceSchema>[] = []
    for (const source of sources) {
      let formSchemaJson: Record<string, unknown> | undefined
      if (source.formId !== null) {
        const [form] = await db.select().from(forms).where(eq(forms.id, source.formId)).limit(1)
        if (form?.currentSchemaVersion !== null && form?.currentSchemaVersion !== undefined) {
          const [formSchema] = await db
            .select({ jsonSchema: formSchemas.jsonSchema })
            .from(formSchemas)
            .where(and(eq(formSchemas.formId, form.id), eq(formSchemas.version, form.currentSchemaVersion)))
            .limit(1)
          formSchemaJson = formSchema?.jsonSchema
        }
      }
      const validation = validateMapping(source.mapping as unknown as Mapping, input.json_schema, formSchemaJson)
      const [updated] = await db
        .update(streamSources)
        .set({ mappingStatus: validation.status, missing: [...validation.missing], streamSchemaVersion: nextVersion, updatedAt: new Date() })
        .where(eq(streamSources.id, source.id))
        .returning()
      if (updated !== undefined) {
        updatedSources.push({
          id: updated.id,
          form_id: updated.formId ?? undefined,
          selector: updated.selector ?? undefined,
          mapping: asJson(updated.mapping),
          mapping_status: updated.mappingStatus === "incomplete" ? "incomplete" : "valid",
          missing: updated.missing,
          stream_schema_version: updated.streamSchemaVersion,
        })
      }
    }

    const body: { schema: z.infer<typeof SchemaVersionSchema>; mappings: z.infer<typeof StreamSourceSchema>[] } = {
      schema: {
        json_schema: asJson(schemaRow.jsonSchema),
        ui: asJson(schemaRow.ui),
        changelog: schemaRow.changelog ?? undefined,
        version: schemaRow.version,
        created_at: schemaRow.createdAt.toISOString(),
      },
      mappings: updatedSources,
    }
    return c.json(body, 201)
  })

  app.openapi(listSourcesRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const { streamId } = c.req.valid("param")
    const rows = await db
      .select()
      .from(streamSources)
      .where(and(eq(streamSources.organizationId, scope.organizationId), eq(streamSources.streamId, streamId)))
    const body: z.infer<typeof StreamSourceSchema>[] = rows.map((source) => ({
      id: source.id,
      form_id: source.formId ?? undefined,
      selector: source.selector ?? undefined,
      mapping: asJson(source.mapping),
      mapping_status: source.mappingStatus === "incomplete" ? "incomplete" : "valid",
      missing: source.missing,
      stream_schema_version: source.streamSchemaVersion,
    }))
    return c.json(body)
  })

  app.openapi(attachSourceRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { streamId } = c.req.valid("param")
    const input = c.req.valid("json")
    const [stream] = await db
      .select()
      .from(streams)
      .where(and(eq(streams.organizationId, scope.organizationId), eq(streams.id, streamId)))
      .limit(1)
    if (stream === undefined) throw new PostbagError("not_found", "No stream with that id.")
    if (stream.currentSchemaVersion === null) {
      throw new PostbagError("validation_failed", "Publish a stream schema before attaching sources.")
    }
    const [schemaRow] = await db
      .select({ jsonSchema: streamSchemas.jsonSchema })
      .from(streamSchemas)
      .where(and(eq(streamSchemas.streamId, streamId), eq(streamSchemas.version, stream.currentSchemaVersion)))
      .limit(1)
    if (schemaRow === undefined) throw new PostbagError("not_found", "Stream schema not found.")

    let formSchemaJson: Record<string, unknown> | undefined
    if (input.form_id !== undefined) {
      const [form] = await db.select().from(forms).where(eq(forms.id, input.form_id)).limit(1)
      if (form?.currentSchemaVersion !== null && form?.currentSchemaVersion !== undefined) {
        const [formSchema] = await db
          .select({ jsonSchema: formSchemas.jsonSchema })
          .from(formSchemas)
          .where(and(eq(formSchemas.formId, form.id), eq(formSchemas.version, form.currentSchemaVersion)))
          .limit(1)
        formSchemaJson = formSchema?.jsonSchema
      }
    }
    const validation = validateMapping(input.mapping as unknown as Mapping, schemaRow.jsonSchema, formSchemaJson)
    if (validation.status === "incomplete") {
      throw new PostbagError(
        "mapping_incomplete",
        `Stream requires fields this source does not provide: ${validation.missing.join(", ")}.`,
        { missing: validation.missing },
      )
    }
    const [created] = await db
      .insert(streamSources)
      .values({
        id: newId("src"),
        organizationId: scope.organizationId,
        streamId,
        formId: input.form_id,
        selector: input.selector,
        mapping: input.mapping,
        mappingStatus: validation.status,
        missing: [...validation.missing],
        streamSchemaVersion: stream.currentSchemaVersion,
      })
      .returning()
    if (created === undefined) throw new Error("Failed to attach source.")
    const body: z.infer<typeof StreamSourceSchema> = {
      id: created.id,
      form_id: created.formId ?? undefined,
      selector: created.selector ?? undefined,
      mapping: asJson(created.mapping),
      mapping_status: created.mappingStatus === "incomplete" ? "incomplete" : "valid",
      missing: created.missing,
      stream_schema_version: created.streamSchemaVersion,
    }
    return c.json(body, 201)
  })

  app.openapi(updateSourceRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { streamId, sourceId } = c.req.valid("param")
    const input = c.req.valid("json")
    const [existing] = await db
      .select()
      .from(streamSources)
      .where(and(eq(streamSources.organizationId, scope.organizationId), eq(streamSources.id, sourceId), eq(streamSources.streamId, streamId)))
      .limit(1)
    if (existing === undefined) throw new PostbagError("not_found", "No source with that id.")
    const [schemaRow] = await db
      .select({ jsonSchema: streamSchemas.jsonSchema })
      .from(streamSchemas)
      .where(and(eq(streamSchemas.streamId, streamId), eq(streamSchemas.version, existing.streamSchemaVersion)))
      .limit(1)
    if (schemaRow === undefined) throw new PostbagError("not_found", "Stream schema not found.")

    let formSchemaJson: Record<string, unknown> | undefined
    const formId = input.form_id ?? existing.formId ?? undefined
    if (formId !== undefined) {
      const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1)
      if (form?.currentSchemaVersion !== null && form?.currentSchemaVersion !== undefined) {
        const [formSchema] = await db
          .select({ jsonSchema: formSchemas.jsonSchema })
          .from(formSchemas)
          .where(and(eq(formSchemas.formId, form.id), eq(formSchemas.version, form.currentSchemaVersion)))
          .limit(1)
        formSchemaJson = formSchema?.jsonSchema
      }
    }
    const validation = validateMapping(input.mapping as unknown as Mapping, schemaRow.jsonSchema, formSchemaJson)
    if (validation.status === "incomplete") {
      throw new PostbagError(
        "mapping_incomplete",
        `Stream requires fields this source does not provide: ${validation.missing.join(", ")}.`,
        { missing: validation.missing },
      )
    }
    const [updated] = await db
      .update(streamSources)
      .set({
        formId: input.form_id ?? existing.formId,
        selector: input.selector ?? existing.selector,
        mapping: input.mapping,
        mappingStatus: validation.status,
        missing: [...validation.missing],
        updatedAt: new Date(),
      })
      .where(eq(streamSources.id, sourceId))
      .returning()
    if (updated === undefined) throw new Error("Failed to update source.")
    const body: z.infer<typeof StreamSourceSchema> = {
      id: updated.id,
      form_id: updated.formId ?? undefined,
      selector: updated.selector ?? undefined,
      mapping: asJson(updated.mapping),
      mapping_status: updated.mappingStatus === "incomplete" ? "incomplete" : "valid",
      missing: updated.missing,
      stream_schema_version: updated.streamSchemaVersion,
    }
    return c.json(body)
  })

  app.openapi(deleteSourceRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { streamId, sourceId } = c.req.valid("param")
    const [row] = await db
      .select({ id: streamSources.id })
      .from(streamSources)
      .where(and(eq(streamSources.organizationId, scope.organizationId), eq(streamSources.id, sourceId), eq(streamSources.streamId, streamId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No source with that id.")
    await db.delete(streamSources).where(eq(streamSources.id, sourceId))
    return c.body(null, 204)
  })

  app.openapi(previewRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const { streamId } = c.req.valid("param")
    const { form_id, data } = c.req.valid("json")
    const [stream] = await db
      .select()
      .from(streams)
      .where(and(eq(streams.organizationId, scope.organizationId), eq(streams.id, streamId)))
      .limit(1)
    if (stream === undefined) throw new PostbagError("not_found", "No stream with that id.")
    if (stream.currentSchemaVersion === null) {
      throw new PostbagError("not_found", "That stream has no published schema.")
    }
    const [schemaRow] = await db
      .select({ jsonSchema: streamSchemas.jsonSchema })
      .from(streamSchemas)
      .where(and(eq(streamSchemas.streamId, streamId), eq(streamSchemas.version, stream.currentSchemaVersion)))
      .limit(1)
    if (schemaRow === undefined) throw new PostbagError("not_found", "Stream schema not found.")
    const [source] = await db
      .select()
      .from(streamSources)
      .where(and(eq(streamSources.organizationId, scope.organizationId), eq(streamSources.streamId, streamId), eq(streamSources.formId, form_id)))
      .limit(1)
    if (source === undefined) throw new PostbagError("not_found", "No source attached for that form.")
    const result = applyMapping(data, source.mapping as unknown as Mapping, schemaRow.jsonSchema)
    const body: z.infer<typeof PreviewResponseSchema> = {
      payload: asJson(result.payload),
      extras: asJson(result.extras),
      problems: [...result.problems],
    }
    return c.json(body)
  })
}
