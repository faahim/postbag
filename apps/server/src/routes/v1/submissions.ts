import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { PostbagError } from "@postbag/core"
import { and, desc, eq, lt, or, type SQL } from "drizzle-orm"
import { deliveries, driftEvents, submissions, type Database } from "@postbag/db"

import { decodeCursor, page, parseLimit } from "../../lib/pagination.js"
import { assertScope, type AppEnv } from "../../lib/scope.js"
import { restoreSubmission } from "../../repo/submissionRecovery.js"
import { asJson, serializeDelivery, serializeSubmission } from "../../repo/serialize.js"
import {
  CursorQuerySchema,
  errorResponses,
  SubmissionDetailSchema,
  SubmissionSchema,
} from "../../schemas.js"

const SubmissionListSchema = z.object({
  data: z.array(SubmissionSchema),
  next_cursor: z.string().nullable(),
})

const searchRoute = createRoute({
  method: "get",
  path: "/v1/submissions",
  operationId: "submissions_list",
  tags: ["submissions"],
  summary: "Search submissions across the organization",
  request: {
    query: CursorQuerySchema.extend({
      stream: z
        .string()
        .optional()
        .describe("Filter to submissions routed through this stream id."),
      form: z.string().optional().describe("Filter to one form id."),
      status: z.string().optional().describe("Filter by status: received, quarantined or spam."),
      q: z.string().optional().describe("Free-text search over submission data."),
    }),
  },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: SubmissionListSchema } } },
  },
})

const getRoute = createRoute({
  method: "get",
  path: "/v1/submissions/{submissionId}",
  operationId: "submissions_get",
  tags: ["submissions"],
  summary: "Get a submission with its deliveries",
  request: { params: z.object({ submissionId: z.string() }) },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: SubmissionDetailSchema } } },
    ...errorResponses,
  },
})

const patchRoute = createRoute({
  method: "patch",
  path: "/v1/submissions/{submissionId}",
  operationId: "submissions_update",
  tags: ["submissions"],
  summary: "Change status (re-routes if moving to received)",
  description:
    "Moving a quarantined submission to `received` re-runs routing and queues deliveries for it. An `over_quota` submission stays quarantined until the current plan has capacity.",
  request: {
    params: z.object({ submissionId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ status: z.enum(["received", "quarantined", "spam"]) }),
        },
      },
    },
  },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: SubmissionSchema } } },
    ...errorResponses,
  },
})

const deleteRoute = createRoute({
  method: "delete",
  path: "/v1/submissions/{submissionId}",
  operationId: "submissions_delete",
  tags: ["submissions"],
  summary: "Delete permanently (GDPR)",
  description:
    "Irreversible. Use for data-subject deletion requests; deliveries already sent are unaffected.",
  request: { params: z.object({ submissionId: z.string() }) },
  responses: { 204: { description: "deleted" }, ...errorResponses },
})

export function registerSubmissionRoutes(app: OpenAPIHono<AppEnv>, db: Database): void {
  app.openapi(searchRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const query = c.req.valid("query")
    const limit = parseLimit(query.limit)
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor)
    const conditions: SQL[] = [eq(submissions.organizationId, scope.organizationId)]
    if (query.form !== undefined) conditions.push(eq(submissions.formId, query.form))
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
    const body: z.infer<typeof SubmissionListSchema> = {
      data: data.map(serializeSubmission),
      next_cursor: nextCursor,
    }
    return c.json(body)
  })

  app.openapi(getRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const { submissionId } = c.req.valid("param")
    const [row] = await db
      .select()
      .from(submissions)
      .where(
        and(eq(submissions.organizationId, scope.organizationId), eq(submissions.id, submissionId)),
      )
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No submission with that id.")
    const deliveryRows = await db
      .select()
      .from(deliveries)
      .where(
        and(
          eq(deliveries.organizationId, scope.organizationId),
          eq(deliveries.submissionId, submissionId),
        ),
      )
    const driftRows = await db
      .select()
      .from(driftEvents)
      .where(
        and(
          eq(driftEvents.organizationId, scope.organizationId),
          eq(driftEvents.submissionId, submissionId),
        ),
      )
    const body: z.infer<typeof SubmissionDetailSchema> = {
      ...serializeSubmission(row),
      deliveries: deliveryRows.map(serializeDelivery),
      drift: driftRows.map((drift) => ({
        id: drift.id,
        form_id: drift.formId,
        submission_id: drift.submissionId,
        kind: drift.kind,
        field: drift.field,
        details: asJson(drift.details),
        detected_at: drift.detectedAt.toISOString(),
        resolved_at: drift.resolvedAt?.toISOString() ?? null,
      })),
    }
    return c.json(body)
  })

  app.openapi(patchRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { submissionId } = c.req.valid("param")
    const { status } = c.req.valid("json")
    const [existing] = await db
      .select()
      .from(submissions)
      .where(
        and(eq(submissions.organizationId, scope.organizationId), eq(submissions.id, submissionId)),
      )
      .limit(1)
    if (existing === undefined) throw new PostbagError("not_found", "No submission with that id.")

    let updated: typeof submissions.$inferSelect | undefined
    if (status === "received" && existing.status !== "received") {
      updated = await restoreSubmission(db, {
        organizationId: scope.organizationId,
        submission: existing,
      })
    } else {
      ;[updated] = await db
        .update(submissions)
        .set({
          status,
          quarantineReason: status === "quarantined" ? existing.quarantineReason : null,
        })
        .where(
          and(
            eq(submissions.organizationId, scope.organizationId),
            eq(submissions.id, submissionId),
          ),
        )
        .returning()
    }
    if (updated === undefined) throw new Error("Failed to update submission.")

    const body: z.infer<typeof SubmissionSchema> = serializeSubmission(updated)
    return c.json(body)
  })

  app.openapi(deleteRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { submissionId } = c.req.valid("param")
    const [row] = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(eq(submissions.organizationId, scope.organizationId), eq(submissions.id, submissionId)),
      )
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No submission with that id.")
    await db
      .delete(submissions)
      .where(
        and(eq(submissions.organizationId, scope.organizationId), eq(submissions.id, submissionId)),
      )
    return c.body(null, 204)
  })
}
