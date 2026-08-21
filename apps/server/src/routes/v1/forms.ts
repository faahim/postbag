import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { FormInputSchema, newId, PostbagError, validateMapping, type Mapping } from "@postbag/core"
import { and, arrayContains, desc, eq, isNull, lt, or, type SQL } from "drizzle-orm"
import {
  driftEvents,
  events,
  forms,
  formSchemaDrafts,
  formSchemas,
  streamSchemas,
  streamSources,
  streams,
  submissions,
  type Database,
} from "@postbag/db"

import { decodeCursor, page, parseLimit } from "../../lib/pagination.js"
import { assertScope, type AppEnv } from "../../lib/scope.js"
import { renderEmbed } from "../../lib/snippets.js"
import { getFormById, getFormCounts, getFormStreams } from "../../repo/forms.js"
import { resolveProjectRef } from "../../repo/projects.js"
import { inferFormSchemaDraft } from "../../repo/schemaInference.js"
import { asJson, serializeForm, serializeSubmission, type Json } from "../../repo/serialize.js"
import {
  CursorQuerySchema,
  EmbedSchema,
  errorResponses,
  FormCreatedSchema,
  FormSchema,
  SafeSchemaInputSchema,
  SchemaVersionSchema,
  SubmissionSchema,
} from "../../schemas.js"

const FormListSchema = z.object({ data: z.array(FormSchema), next_cursor: z.string().nullable() })
// FormInputSchema.schema embeds core's recursive z.json() fields, which crash OpenAPI
// doc generation (see schemas.ts SafeSchemaInputSchema) — swap in the safe version.
const SafeFormInputSchema = FormInputSchema.extend({ schema: SafeSchemaInputSchema.optional() })

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "")
  return base.length === 0 ? "form" : base.slice(0, 50)
}

const listRoute = createRoute({
  method: "get",
  path: "/v1/forms",
  tags: ["forms"],
  summary: "List forms",
  request: {
    query: CursorQuerySchema.extend({
      project: z.string().optional(),
      tag: z.string().optional(),
      stream: z.string().optional(),
    }),
  },
  responses: { 200: { description: "ok", content: { "application/json": { schema: FormListSchema } } } },
})

const createRouteDef = createRoute({
  method: "post",
  path: "/v1/forms",
  tags: ["forms"],
  summary: "Create a form",
  request: { body: { content: { "application/json": { schema: SafeFormInputSchema } } } },
  responses: {
    201: { description: "created", content: { "application/json": { schema: FormCreatedSchema } } },
    ...errorResponses,
  },
})

const getRoute = createRoute({
  method: "get",
  path: "/v1/forms/{formId}",
  tags: ["forms"],
  summary: "Get a form",
  request: { params: z.object({ formId: z.string() }) },
  responses: { 200: { description: "ok", content: { "application/json": { schema: FormSchema } } }, ...errorResponses },
})

const patchRoute = createRoute({
  method: "patch",
  path: "/v1/forms/{formId}",
  tags: ["forms"],
  summary: "Update a form",
  request: {
    params: z.object({ formId: z.string() }),
    body: { content: { "application/json": { schema: SafeFormInputSchema.partial() } } },
  },
  responses: { 200: { description: "ok", content: { "application/json": { schema: FormSchema } } }, ...errorResponses },
})

const deleteRoute = createRoute({
  method: "delete",
  path: "/v1/forms/{formId}",
  tags: ["forms"],
  summary: "Delete a form",
  request: { params: z.object({ formId: z.string() }) },
  responses: { 204: { description: "deleted" }, ...errorResponses },
})

const embedRoute = createRoute({
  method: "get",
  path: "/v1/forms/{formId}/embed",
  tags: ["forms"],
  summary: "Embed snippets",
  request: { params: z.object({ formId: z.string() }) },
  responses: { 200: { description: "ok", content: { "application/json": { schema: EmbedSchema } } }, ...errorResponses },
})

const getSchemaRoute = createRoute({
  method: "get",
  path: "/v1/forms/{formId}/schema",
  tags: ["forms"],
  summary: "Current schema version",
  request: { params: z.object({ formId: z.string() }) },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: SchemaVersionSchema } } },
    ...errorResponses,
  },
})

const publishSchemaRoute = createRoute({
  method: "post",
  path: "/v1/forms/{formId}/schema",
  tags: ["forms"],
  summary: "Publish a new schema version",
  request: {
    params: z.object({ formId: z.string() }),
    body: { content: { "application/json": { schema: SafeSchemaInputSchema } } },
  },
  responses: {
    201: { description: "published", content: { "application/json": { schema: SchemaVersionSchema } } },
    ...errorResponses,
  },
})

const schemaVersionsRoute = createRoute({
  method: "get",
  path: "/v1/forms/{formId}/schema/versions",
  tags: ["forms"],
  summary: "All schema versions",
  request: { params: z.object({ formId: z.string() }) },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: z.array(SchemaVersionSchema) } } },
  },
})

const inferSchemaRoute = createRoute({
  method: "post",
  path: "/v1/forms/{formId}/schema/infer",
  tags: ["forms"],
  summary: "Infer a draft schema now, from recent submissions (observe mode, no schema yet)",
  request: { params: z.object({ formId: z.string() }) },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: SchemaVersionSchema } } },
    ...errorResponses,
  },
})

const driftRoute = createRoute({
  method: "get",
  path: "/v1/forms/{formId}/drift",
  tags: ["forms"],
  summary: "Unresolved drift events",
  request: { params: z.object({ formId: z.string() }) },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: z.array(z.record(z.string(), z.unknown())) } } },
  },
})

const formSubmissionsRoute = createRoute({
  method: "get",
  path: "/v1/forms/{formId}/submissions",
  tags: ["submissions"],
  summary: "List submissions for a form",
  request: {
    params: z.object({ formId: z.string() }),
    query: CursorQuerySchema.extend({ status: z.string().optional(), since: z.string().optional(), q: z.string().optional() }),
  },
  responses: {
    200: {
      description: "ok",
      content: { "application/json": { schema: z.object({ data: z.array(SubmissionSchema), next_cursor: z.string().nullable() }) } },
    },
  },
})

async function queryFormsList(
  db: Database,
  organizationId: string,
  query: {
    readonly project?: string | undefined
    readonly tag?: string | undefined
    readonly cursor?: string | undefined
    readonly limit?: number | undefined
  },
): Promise<{ readonly rows: (typeof forms.$inferSelect)[]; readonly limit: number }> {
  const limit = parseLimit(query.limit)
  const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor)
  const conditions: SQL[] = [eq(forms.organizationId, organizationId)]
  if (query.project !== undefined) conditions.push(eq(forms.projectId, query.project))
  if (query.tag !== undefined) conditions.push(arrayContains(forms.tags, [query.tag]))
  if (cursor !== null) {
    const cursorCondition = or(
      lt(forms.createdAt, cursor.createdAt),
      and(eq(forms.createdAt, cursor.createdAt), lt(forms.id, cursor.id)),
    )
    if (cursorCondition !== undefined) conditions.push(cursorCondition)
  }
  const rows = await db
    .select()
    .from(forms)
    .where(and(...conditions))
    .orderBy(desc(forms.createdAt), desc(forms.id))
    .limit(limit + 1)
  return { rows, limit }
}

export function registerFormRoutes(app: OpenAPIHono<AppEnv>, db: Database, appUrl: string): void {
  app.openapi(listRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const query = c.req.valid("query")
    const { rows, limit } = await queryFormsList(db, scope.organizationId, query)
    const { data, nextCursor } = page(rows, limit)
    const serialized = await Promise.all(
      data.map(async (row) => {
        const [counts, streamsInfo] = await Promise.all([
          getFormCounts(db, scope.organizationId, row.id),
          getFormStreams(db, scope.organizationId, row.id),
        ])
        return serializeForm(row, appUrl, streamsInfo, counts)
      }),
    )
    const body: z.infer<typeof FormListSchema> = { data: serialized, next_cursor: nextCursor }
    return c.json(body)
  })

  app.openapi(createRouteDef, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const input = c.req.valid("json")
    const project = await resolveProjectRef(db, scope.organizationId, input.project)
    if (project === null) throw new PostbagError("not_found", `No project '${input.project}'.`)

    const slug = input.slug ?? slugify(input.name ?? "form")
    const [existing] = await db
      .select()
      .from(forms)
      .where(and(eq(forms.organizationId, scope.organizationId), eq(forms.projectId, project.id), eq(forms.slug, slug)))
      .limit(1)
    if (existing !== undefined) {
      if (input.if_exists === "return") {
        const [counts, streamsInfo] = await Promise.all([
          getFormCounts(db, scope.organizationId, existing.id),
          getFormStreams(db, scope.organizationId, existing.id),
        ])
        const existingBody: z.infer<typeof FormCreatedSchema> = serializeForm(existing, appUrl, streamsInfo, counts)
        return c.json(existingBody, 201)
      }
      throw new PostbagError("conflict", `A form with slug '${slug}' already exists in this project.`)
    }

    const { created, publishedSchema } = await db.transaction(async (tx) => {
      // If attaching to a stream template and no explicit schema was given, adopt the
      // stream's schema 1:1 so the mapping is trivially complete (AGENT-NATIVE.md §4).
      let schemaInput = input.schema
      let templateStreamId: string | null = null
      let templateStreamSchema: { readonly jsonSchema: Readonly<Record<string, unknown>>; readonly version: number } | null = null
      if (input.from_template !== undefined) {
        const [stream] = await tx.select().from(streams).where(eq(streams.id, input.from_template)).limit(1)
        if (stream === undefined) throw new PostbagError("not_found", "No stream with that id.")
        if (stream.currentSchemaVersion === null) {
          throw new PostbagError("not_found", "That stream has no published schema.")
        }
        const [streamSchema] = await tx
          .select()
          .from(streamSchemas)
          .where(and(eq(streamSchemas.streamId, stream.id), eq(streamSchemas.version, stream.currentSchemaVersion)))
          .limit(1)
        if (streamSchema === undefined) throw new PostbagError("not_found", "Stream schema not found.")
        templateStreamId = stream.id
        templateStreamSchema = { jsonSchema: streamSchema.jsonSchema, version: streamSchema.version }
        schemaInput ??= {
          json_schema: asJson(streamSchema.jsonSchema),
          ui: streamSchema.ui as unknown as Record<string, Record<string, Json>>,
        }
      }

      const [createdForm] = await tx
        .insert(forms)
        .values({
          id: newId("fm"),
          organizationId: scope.organizationId,
          projectId: project.id,
          slug,
          name: input.name ?? slug,
          tags: [...input.tags],
          schemaMode: input.schema_mode,
          status: input.status,
          settings: input.settings ?? {},
        })
        .returning()
      if (createdForm === undefined) throw new Error("Failed to create form.")

      let published: z.infer<typeof SchemaVersionSchema> | undefined
      if (schemaInput !== undefined) {
        const [schemaRow] = await tx
          .insert(formSchemas)
          .values({
            id: newId("fs"),
            organizationId: scope.organizationId,
            formId: createdForm.id,
            version: 1,
            jsonSchema: schemaInput.json_schema,
            ui: schemaInput.ui ?? {},
            changelog: schemaInput.changelog,
          })
          .returning()
        if (schemaRow !== undefined) {
          await tx.update(forms).set({ currentSchemaVersion: 1 }).where(eq(forms.id, createdForm.id))
          published = {
            json_schema: asJson(schemaRow.jsonSchema),
            ui: asJson(schemaRow.ui),
            version: schemaRow.version,
            created_at: schemaRow.createdAt.toISOString(),
          }
        }
      }

      if (templateStreamId !== null && templateStreamSchema !== null) {
        const fields = isRecord(templateStreamSchema.jsonSchema["properties"])
          ? Object.keys(templateStreamSchema.jsonSchema["properties"])
          : []
        const mapping: Record<string, { from: string }> = {}
        for (const field of fields) mapping[field] = { from: field }
        const validation = validateMapping(mapping, templateStreamSchema.jsonSchema, schemaInput?.json_schema)
        if (validation.status === "incomplete") {
          throw new PostbagError(
            "mapping_incomplete",
            `Stream requires fields this form does not provide: ${validation.missing.join(", ")}.`,
            { missing: validation.missing },
          )
        }
        await tx.insert(streamSources).values({
          id: newId("src"),
          organizationId: scope.organizationId,
          streamId: templateStreamId,
          formId: createdForm.id,
          mapping,
          mappingStatus: validation.status,
          missing: [...validation.missing],
          streamSchemaVersion: templateStreamSchema.version,
        })
      }

      await tx.insert(events).values({
        id: newId("ev"),
        organizationId: scope.organizationId,
        type: "form.created",
        subject: { form_id: createdForm.id },
        data: { slug: createdForm.slug },
      })

      return { created: createdForm, publishedSchema: published }
    })

    const submitUrl = `${appUrl}/s/${created.id}`
    const body: z.infer<typeof FormCreatedSchema> = {
      ...serializeForm(created, appUrl, [], { submissions: 0, lastSubmissionAt: null }),
      embed: renderEmbed(submitUrl, publishedSchema?.ui as never),
      verify: {
        curl: `curl -X POST ${submitUrl} -H 'Content-Type: application/json' -d '{"_test":true}'`,
        then: `GET /v1/forms/${created.id}/submissions?limit=1`,
      },
      next: [{ why: "Add a destination", method: "POST", path: "/v1/destinations", body: { type: "webhook" } }],
    }
    return c.json(body, 201)
  })

  app.openapi(getRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const { formId } = c.req.valid("param")
    const row = await getFormById(db, scope.organizationId, formId)
    if (row === null) throw new PostbagError("not_found", "No form with that id.")
    const [counts, streamsInfo] = await Promise.all([
      getFormCounts(db, scope.organizationId, formId),
      getFormStreams(db, scope.organizationId, formId),
    ])
    const body: z.infer<typeof FormSchema> = serializeForm(row, appUrl, streamsInfo, counts)
    return c.json(body)
  })

  app.openapi(patchRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { formId } = c.req.valid("param")
    const input = c.req.valid("json")
    const updates: Partial<typeof forms.$inferInsert> = {}
    if (input.name !== undefined) updates.name = input.name
    if (input.slug !== undefined) updates.slug = input.slug
    if (input.tags !== undefined) updates.tags = [...input.tags]
    if (input.status !== undefined) updates.status = input.status
    if (input.schema_mode !== undefined) updates.schemaMode = input.schema_mode
    if (input.settings !== undefined) updates.settings = input.settings
    updates.updatedAt = new Date()
    const [row] = await db
      .update(forms)
      .set(updates)
      .where(and(eq(forms.organizationId, scope.organizationId), eq(forms.id, formId)))
      .returning()
    if (row === undefined) throw new PostbagError("not_found", "No form with that id.")
    const [counts, streamsInfo] = await Promise.all([
      getFormCounts(db, scope.organizationId, formId),
      getFormStreams(db, scope.organizationId, formId),
    ])
    const body: z.infer<typeof FormSchema> = serializeForm(row, appUrl, streamsInfo, counts)
    return c.json(body)
  })

  app.openapi(deleteRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { formId } = c.req.valid("param")
    const row = await getFormById(db, scope.organizationId, formId)
    if (row === null) throw new PostbagError("not_found", "No form with that id.")
    await db.delete(forms).where(and(eq(forms.organizationId, scope.organizationId), eq(forms.id, formId)))
    return c.body(null, 204)
  })

  app.openapi(embedRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const { formId } = c.req.valid("param")
    const row = await getFormById(db, scope.organizationId, formId)
    if (row === null) throw new PostbagError("not_found", "No form with that id.")
    let ui: Record<string, unknown> | undefined
    if (row.currentSchemaVersion !== null) {
      const [schemaRow] = await db
        .select({ ui: formSchemas.ui })
        .from(formSchemas)
        .where(and(eq(formSchemas.formId, formId), eq(formSchemas.version, row.currentSchemaVersion)))
        .limit(1)
      ui = schemaRow?.ui
    }
    const body: z.infer<typeof EmbedSchema> = renderEmbed(`${appUrl}/s/${formId}`, ui as never)
    return c.json(body)
  })

  app.openapi(getSchemaRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const { formId } = c.req.valid("param")
    const row = await getFormById(db, scope.organizationId, formId)
    if (row === null) throw new PostbagError("not_found", "No form with that id.")
    if (row.currentSchemaVersion === null) {
      // Job D §4: observe-mode forms with no published schema fall back to the inferred
      // draft (if the housekeeping loop or an on-demand infer has produced one). This is
      // never a version — publishing is still the explicit act.
      const [draft] = await db
        .select()
        .from(formSchemaDrafts)
        .where(and(eq(formSchemaDrafts.organizationId, scope.organizationId), eq(formSchemaDrafts.formId, formId)))
        .limit(1)
      if (draft === undefined) throw new PostbagError("not_found", "This form has no published schema.")
      const body: z.infer<typeof SchemaVersionSchema> = {
        json_schema: asJson(draft.jsonSchema),
        ui: asJson(draft.ui),
        inferred: true,
        created_at: draft.inferredAt.toISOString(),
      }
      return c.json(body)
    }
    const [schemaRow] = await db
      .select()
      .from(formSchemas)
      .where(and(eq(formSchemas.formId, formId), eq(formSchemas.version, row.currentSchemaVersion)))
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
    const { formId } = c.req.valid("param")
    const input = c.req.valid("json")
    const row = await getFormById(db, scope.organizationId, formId)
    if (row === null) throw new PostbagError("not_found", "No form with that id.")

    const nextVersion = (row.currentSchemaVersion ?? 0) + 1
    const [schemaRow] = await db
      .insert(formSchemas)
      .values({
        id: newId("fs"),
        organizationId: scope.organizationId,
        formId,
        version: nextVersion,
        jsonSchema: input.json_schema,
        ui: input.ui ?? {},
        changelog: input.changelog,
      })
      .returning()
    if (schemaRow === undefined) throw new Error("Failed to publish schema.")
    await db.update(forms).set({ currentSchemaVersion: nextVersion, updatedAt: new Date() }).where(eq(forms.id, formId))
    await db.insert(events).values({
      id: newId("ev"),
      organizationId: scope.organizationId,
      type: "form.schema.changed",
      subject: { form_id: formId },
      data: { version: nextVersion },
    })

    const openDrift = await db
      .select()
      .from(driftEvents)
      .where(
        and(
          eq(driftEvents.organizationId, scope.organizationId),
          eq(driftEvents.formId, formId),
          isNull(driftEvents.resolvedAt),
        ),
      )
    const properties = isRecord(input.json_schema["properties"]) ? input.json_schema["properties"] : {}
    const required = Array.isArray(input.json_schema["required"]) ? (input.json_schema["required"] as string[]) : []
    for (const drift of openDrift) {
      const resolved =
        drift.kind === "missing_field" ? !required.includes(drift.field) : Object.hasOwn(properties, drift.field)
      if (resolved) {
        await db.update(driftEvents).set({ resolvedAt: new Date() }).where(eq(driftEvents.id, drift.id))
      }
    }

    const sources = await db
      .select()
      .from(streamSources)
      .where(and(eq(streamSources.organizationId, scope.organizationId), eq(streamSources.formId, formId)))
    for (const source of sources) {
      const [streamSchema] = await db
        .select({ jsonSchema: streamSchemas.jsonSchema })
        .from(streamSchemas)
        .where(and(eq(streamSchemas.streamId, source.streamId), eq(streamSchemas.version, source.streamSchemaVersion)))
        .limit(1)
      if (streamSchema === undefined) continue
      const validation = validateMapping(source.mapping as unknown as Mapping, streamSchema.jsonSchema, input.json_schema)
      await db
        .update(streamSources)
        .set({ mappingStatus: validation.status, missing: [...validation.missing], updatedAt: new Date() })
        .where(eq(streamSources.id, source.id))
    }

    const body: z.infer<typeof SchemaVersionSchema> = {
      json_schema: asJson(schemaRow.jsonSchema),
      ui: asJson(schemaRow.ui),
      changelog: schemaRow.changelog ?? undefined,
      version: schemaRow.version,
      created_at: schemaRow.createdAt.toISOString(),
    }
    return c.json(body, 201)
  })

  app.openapi(schemaVersionsRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const { formId } = c.req.valid("param")
    const rows = await db
      .select()
      .from(formSchemas)
      .where(and(eq(formSchemas.organizationId, scope.organizationId), eq(formSchemas.formId, formId)))
      .orderBy(desc(formSchemas.version))
    const body: z.infer<typeof SchemaVersionSchema>[] = rows.map((row) => ({
      json_schema: asJson(row.jsonSchema),
      ui: asJson(row.ui),
      changelog: row.changelog ?? undefined,
      version: row.version,
      created_at: row.createdAt.toISOString(),
    }))
    return c.json(body)
  })

  app.openapi(inferSchemaRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { formId } = c.req.valid("param")
    const row = await getFormById(db, scope.organizationId, formId)
    if (row === null) throw new PostbagError("not_found", "No form with that id.")
    if (row.schemaMode !== "observe" || row.currentSchemaVersion !== null) {
      throw new PostbagError(
        "conflict",
        "Schema inference only runs for observe-mode forms that have no published schema yet.",
      )
    }
    const sampleCount = await inferFormSchemaDraft(db, scope.organizationId, formId)
    const [draft] = await db
      .select()
      .from(formSchemaDrafts)
      .where(and(eq(formSchemaDrafts.organizationId, scope.organizationId), eq(formSchemaDrafts.formId, formId)))
      .limit(1)
    if (sampleCount === null || draft === undefined) {
      throw new PostbagError("not_found", "No non-spam submissions yet to infer a schema from.")
    }
    const body: z.infer<typeof SchemaVersionSchema> = {
      json_schema: asJson(draft.jsonSchema),
      ui: asJson(draft.ui),
      inferred: true,
      created_at: draft.inferredAt.toISOString(),
    }
    return c.json(body)
  })

  app.openapi(driftRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const { formId } = c.req.valid("param")
    const rows = await db
      .select()
      .from(driftEvents)
      .where(
        and(
          eq(driftEvents.organizationId, scope.organizationId),
          eq(driftEvents.formId, formId),
          isNull(driftEvents.resolvedAt),
        ),
      )
      .orderBy(desc(driftEvents.detectedAt))
    const body: Record<string, unknown>[] = rows.map((row) => ({
      id: row.id,
      form_id: row.formId,
      submission_id: row.submissionId,
      kind: row.kind,
      field: row.field,
      details: asJson(row.details),
      detected_at: row.detectedAt.toISOString(),
      resolved_at: row.resolvedAt?.toISOString() ?? null,
    }))
    return c.json(body)
  })

  app.openapi(formSubmissionsRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const { formId } = c.req.valid("param")
    const query = c.req.valid("query")
    const limit = parseLimit(query.limit)
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor)
    const conditions: SQL[] = [eq(submissions.organizationId, scope.organizationId), eq(submissions.formId, formId)]
    if (query.status !== undefined) conditions.push(eq(submissions.status, query.status))
    if (cursor !== null) {
      const cursorCondition = or(
        lt(submissions.receivedAt, cursor.createdAt),
        and(eq(submissions.receivedAt, cursor.createdAt), lt(submissions.id, cursor.id)),
      )
      if (cursorCondition !== undefined) conditions.push(cursorCondition)
    }
    const rows = await db
      .select()
      .from(submissions)
      .where(and(...conditions))
      .orderBy(desc(submissions.receivedAt), desc(submissions.id))
      .limit(limit + 1)
    const mapped = rows.map((row) => ({ ...row, createdAt: row.receivedAt }))
    const { data, nextCursor } = page(mapped, limit)
    const body: { data: z.infer<typeof SubmissionSchema>[]; next_cursor: string | null } = {
      data: data.map(serializeSubmission),
      next_cursor: nextCursor,
    }
    return c.json(body)
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
