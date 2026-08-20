import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { newId, ProjectInputSchema, PostbagError } from "@postbag/core"
import { and, count, desc, eq, lt, or } from "drizzle-orm"
import { forms, projects, type Database } from "@postbag/db"

import { decodeCursor, page, parseLimit } from "../../lib/pagination.js"
import { assertScope, type AppEnv } from "../../lib/scope.js"
import { serializeProject } from "../../repo/serialize.js"
import { CursorQuerySchema, errorResponses, ProjectSchema } from "../../schemas.js"

const ProjectListSchema = z.object({ data: z.array(ProjectSchema), next_cursor: z.string().nullable() })

const listRoute = createRoute({
  method: "get",
  path: "/v1/projects",
  tags: ["projects"],
  summary: "List projects",
  request: { query: CursorQuerySchema },
  responses: { 200: { description: "ok", content: { "application/json": { schema: ProjectListSchema } } } },
})

const createRouteDef = createRoute({
  method: "post",
  path: "/v1/projects",
  tags: ["projects"],
  summary: "Create a project",
  request: { body: { content: { "application/json": { schema: ProjectInputSchema } } } },
  responses: {
    201: { description: "created", content: { "application/json": { schema: ProjectSchema } } },
    ...errorResponses,
  },
})

const getRoute = createRoute({
  method: "get",
  path: "/v1/projects/{projectId}",
  tags: ["projects"],
  summary: "Get a project",
  request: { params: z.object({ projectId: z.string() }) },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: ProjectSchema } } },
    ...errorResponses,
  },
})

const patchRoute = createRoute({
  method: "patch",
  path: "/v1/projects/{projectId}",
  tags: ["projects"],
  summary: "Update a project",
  request: {
    params: z.object({ projectId: z.string() }),
    body: { content: { "application/json": { schema: ProjectInputSchema.partial() } } },
  },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: ProjectSchema } } },
    ...errorResponses,
  },
})

const deleteRoute = createRoute({
  method: "delete",
  path: "/v1/projects/{projectId}",
  tags: ["projects"],
  summary: "Delete an empty project",
  request: { params: z.object({ projectId: z.string() }) },
  responses: { 204: { description: "deleted" }, ...errorResponses },
})

export function registerProjectRoutes(app: OpenAPIHono<AppEnv>, db: Database): void {
  app.openapi(listRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const limit = parseLimit(c.req.valid("query").limit)
    const cursorParam = c.req.valid("query").cursor
    const cursor = cursorParam === undefined ? null : decodeCursor(cursorParam)
    const rows = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.organizationId, scope.organizationId),
          cursor === null
            ? undefined
            : or(
                lt(projects.createdAt, cursor.createdAt),
                and(eq(projects.createdAt, cursor.createdAt), lt(projects.id, cursor.id)),
              ),
        ),
      )
      .orderBy(desc(projects.createdAt), desc(projects.id))
      .limit(limit + 1)
    const { data, nextCursor } = page(rows, limit)
    return c.json({ data: data.map(serializeProject), next_cursor: nextCursor })
  })

  app.openapi(createRouteDef, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const input = c.req.valid("json")
    const slug = input.slug ?? slugify(input.name ?? "project")
    const [existing] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.organizationId, scope.organizationId), eq(projects.slug, slug)))
      .limit(1)
    if (existing !== undefined) {
      if (input.if_exists === "return") return c.json(serializeProject(existing), 201)
      throw new PostbagError("conflict", `A project with slug '${slug}' already exists.`)
    }
    const [created] = await db
      .insert(projects)
      .values({
        id: newId("prj"),
        organizationId: scope.organizationId,
        slug,
        name: input.name ?? slug,
        tags: [...input.tags],
      })
      .returning()
    if (created === undefined) throw new Error("Failed to create project.")
    return c.json(serializeProject(created), 201)
  })

  app.openapi(getRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const { projectId } = c.req.valid("param")
    const [row] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.organizationId, scope.organizationId), eq(projects.id, projectId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No project with that id.")
    return c.json(serializeProject(row))
  })

  app.openapi(patchRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { projectId } = c.req.valid("param")
    const input = c.req.valid("json")
    const updates: Partial<typeof projects.$inferInsert> = {}
    if (input.name !== undefined) updates.name = input.name
    if (input.slug !== undefined) updates.slug = input.slug
    if (input.tags !== undefined) updates.tags = [...input.tags]
    updates.updatedAt = new Date()
    const [row] = await db
      .update(projects)
      .set(updates)
      .where(and(eq(projects.organizationId, scope.organizationId), eq(projects.id, projectId)))
      .returning()
    if (row === undefined) throw new PostbagError("not_found", "No project with that id.")
    return c.json(serializeProject(row))
  })

  app.openapi(deleteRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { projectId } = c.req.valid("param")
    const [row] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.organizationId, scope.organizationId), eq(projects.id, projectId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No project with that id.")
    const [formCountRow] = await db
      .select({ value: count() })
      .from(forms)
      .where(and(eq(forms.organizationId, scope.organizationId), eq(forms.projectId, projectId)))
    if ((formCountRow?.value ?? 0) > 0) {
      throw new PostbagError("conflict", "Delete or move this project's forms before deleting it.")
    }
    await db.delete(projects).where(and(eq(projects.organizationId, scope.organizationId), eq(projects.id, projectId)))
    return c.body(null, 204)
  })
}

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "")
  return base.length === 0 ? "project" : base.slice(0, 50)
}
