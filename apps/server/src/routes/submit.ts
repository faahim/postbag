import {
  applyMapping,
  detectDrift,
  normalizeBody,
  planDeliveries,
  scoreSpam,
  validateAgainstSchema,
  PayloadTooLarge,
  PostbagError,
  type Mapping,
} from "@postbag/core"
import { and, eq, sql } from "drizzle-orm"
import {
  deliveries,
  driftEvents,
  forms,
  formSchemas,
  notifyDeliveries,
  organizationSettings,
  submissions,
  type Database,
} from "@postbag/db"
import type { Context, Hono } from "hono"

import type { Env } from "../env.js"
import { decideCors } from "../lib/cors.js"
import { envelope } from "../lib/errors.js"
import type { Logger } from "../logger.js"
import type { TokenBucketLimiter } from "../lib/rateLimit.js"
import type { AppEnv } from "../lib/scope.js"
import { getDirectRoutesForForm, getStreamMembershipsForForm, getStreamSchemaJson } from "../repo/routing.js"

const MAX_BODY_BYTES = 256 * 1_024
// See the digest TODO near the delivery insert below.
const DIGEST_PARKED_UNTIL = new Date("9999-01-01T00:00:00.000Z")

type ControlFields = Partial<{
  _redirect: unknown
  _gotcha: unknown
  _idempotency: unknown
  _subject: unknown
  _test: unknown
}>

export type SubmitDeps = {
  readonly db: Database
  readonly env: Env
  readonly logger: Logger
  readonly rateLimiter: TokenBucketLimiter
}

type FormSettings = {
  readonly allowed_origins?: readonly string[]
  readonly redirect_url?: string | null
  readonly honeypot_field?: string
  readonly rate_limit?: { readonly per_minute?: number; readonly burst?: number }
  readonly reply_to_field?: string | null
  readonly turnstile?: { readonly secret?: string; readonly enabled?: boolean }
}

function clientIp(c: Context<AppEnv>): string {
  const forwarded = c.req.header("x-forwarded-for")
  if (forwarded !== undefined) return forwarded.split(",")[0]?.trim() ?? "unknown"
  return "unknown"
}

async function readBoundedBody(request: Request): Promise<{ raw: ArrayBuffer; contentType: string }> {
  const contentType = (request.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? ""
  const raw = await request.arrayBuffer()
  if (raw.byteLength > MAX_BODY_BYTES) {
    throw new PayloadTooLarge(`The submission body exceeds ${String(MAX_BODY_BYTES)} bytes.`)
  }
  return { raw, contentType }
}

function parseUrlEncoded(text: string): Record<string, unknown> {
  const params = new URLSearchParams(text)
  const result: Record<string, unknown> = {}
  for (const key of params.keys()) {
    const values = params.getAll(key)
    result[key] = values.length > 1 ? values : (values[0] ?? "")
  }
  return result
}

async function parseMultipart(raw: ArrayBuffer, contentType: string): Promise<Record<string, unknown>> {
  const request = new Request("http://local/multipart", {
    method: "POST",
    headers: { "content-type": contentType },
    body: raw,
  })
  const form = await request.formData()
  const grouped = new Map<string, unknown[]>()
  form.forEach((value, key) => {
    if (value instanceof File) {
      throw new PostbagError("unsupported_media_type", "File uploads are not supported yet.", { field: key })
    }
    const existing = grouped.get(key) ?? []
    existing.push(value)
    grouped.set(key, existing)
  })
  const result: Record<string, unknown> = {}
  for (const [key, values] of grouped) {
    result[key] = values.length > 1 ? values : values[0]
  }
  return result
}

async function parseBody(
  request: Request,
): Promise<{ readonly input: Record<string, unknown>; readonly contentType: string; readonly isForm: boolean }> {
  const { raw, contentType } = await readBoundedBody(request)
  const text = new TextDecoder().decode(raw)
  if (contentType === "application/json") {
    if (text.trim().length === 0) return { input: {}, contentType, isForm: false }
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new PayloadTooLarge("The JSON submission body must be an object.")
    }
    return { input: parsed as Record<string, unknown>, contentType, isForm: false }
  }
  if (contentType === "application/x-www-form-urlencoded") {
    return { input: parseUrlEncoded(text), contentType, isForm: true }
  }
  if (contentType.startsWith("multipart/form-data")) {
    return { input: await parseMultipart(raw, contentType), contentType, isForm: true }
  }
  return {
    input: parseUrlEncoded(text),
    contentType: contentType.length > 0 ? contentType : "application/x-www-form-urlencoded",
    isForm: true,
  }
}

type FormRow = typeof forms.$inferSelect

async function getForm(db: Database, formId: string): Promise<FormRow | null> {
  const [row] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1)
  return row ?? null
}

async function countSubmissionsThisMonth(db: Database, organizationId: string): Promise<number> {
  const now = new Date()
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const rows = await db.execute<{ count: string }>(sql`
    select count(*)::text as count from submissions
    where organization_id = ${organizationId} and test = false and received_at >= ${startOfMonth.toISOString()}
  `)
  return Number.parseInt(rows[0]?.count ?? "0", 10)
}

async function verifyTurnstile(secret: string, token: string | undefined): Promise<boolean> {
  if (token === undefined || token.length === 0) return false
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(3_000),
    })
    const body: unknown = await response.json()
    return typeof body === "object" && body !== null && (body as { success?: boolean }).success === true
  } catch {
    return false
  }
}

function respond(
  c: Context<AppEnv>,
  form: FormRow,
  settings: FormSettings,
  redirectOverride: string | undefined,
  body: Record<string, unknown>,
  isForm: boolean,
): Response {
  const accept = c.req.header("accept") ?? ""
  const wantsHtml = isForm && !accept.includes("application/json")
  if (wantsHtml) {
    const redirect = redirectOverride ?? settings.redirect_url ?? `/s/${form.id}/thanks`
    return c.redirect(redirect, 303)
  }
  return c.json(body, 200)
}

export function registerSubmitRoutes(app: Hono<AppEnv>, deps: SubmitDeps): void {
  const { db, logger, rateLimiter } = deps
  void deps.env

  app.options("/s/:formId", (c) => {
    const origin = c.req.header("origin")
    c.header("Access-Control-Allow-Origin", origin ?? "*")
    c.header("Vary", "Origin")
    c.header("Access-Control-Allow-Methods", "POST, OPTIONS")
    c.header("Access-Control-Allow-Headers", "content-type, idempotency-key")
    return c.body(null, 204)
  })

  app.get("/s/:formId/schema", async (c) => {
    const form = await getForm(db, c.req.param("formId"))
    if (form === null) return c.json(envelope("not_found", "No form with that id."), 404)
    if (form.currentSchemaVersion === null) {
      return c.json(envelope("not_found", "This form has no published schema."), 404)
    }
    const [row] = await db
      .select()
      .from(formSchemas)
      .where(and(eq(formSchemas.formId, form.id), eq(formSchemas.version, form.currentSchemaVersion)))
      .limit(1)
    if (row === undefined) return c.json(envelope("not_found", "Schema version not found."), 404)
    c.header("Access-Control-Allow-Origin", "*")
    return c.json({
      json_schema: row.jsonSchema,
      ui: row.ui,
      changelog: row.changelog ?? undefined,
      version: row.version,
      created_at: row.createdAt.toISOString(),
    })
  })

  app.get("/s/:formId/thanks", (c) =>
    c.html(
      '<!doctype html><html><head><meta charset="utf-8"><title>Thanks</title></head>' +
        '<body style="font-family: system-ui, sans-serif; display: grid; place-items: center; height: 100vh; margin: 0;">' +
        '<div style="text-align:center"><h1>Thanks!</h1><p>Your submission was received.</p></div>' +
        "</body></html>",
    ),
  )

  app.post("/s/:formId", async (c) => {
    const requestId = c.get("requestId") as string | undefined
    const formId = c.req.param("formId")
    const form = await getForm(db, formId)
    if (form === null) return c.json(envelope("not_found", "No form with that id."), 404)

    const settings = form.settings as FormSettings
    const allowedOrigins = settings.allowed_origins ?? []
    const requestOrigin = c.req.header("origin")
    const cors = decideCors(requestOrigin, allowedOrigins)
    c.header("Vary", "Origin")
    if (cors.allowOrigin !== null) c.header("Access-Control-Allow-Origin", cors.allowOrigin)

    const { input, contentType, isForm } = await parseBody(c.req.raw)
    const { data, control } = normalizeBody(input, contentType)
    const ctrl = control as ControlFields
    const isTest = ctrl._test === true || ctrl._test === "true"
    const redirectOverride = typeof ctrl._redirect === "string" ? ctrl._redirect : undefined

    const idempotencyKey =
      c.req.header("idempotency-key") ??
      (typeof ctrl._idempotency === "string" ? ctrl._idempotency : undefined)
    if (idempotencyKey !== undefined) {
      const [existing] = await db
        .select({ id: submissions.id, status: submissions.status })
        .from(submissions)
        .where(and(eq(submissions.formId, formId), eq(submissions.idempotencyKey, idempotencyKey)))
        .limit(1)
      if (existing !== undefined) {
        return respond(
          c,
          form,
          settings,
          redirectOverride,
          { ok: true, submission_id: existing.id, status: existing.status, idempotent: true },
          isForm,
        )
      }
    }

    const meta = {
      ip: clientIp(c),
      user_agent: c.req.header("user-agent") ?? "",
      origin: requestOrigin ?? null,
      referer: c.req.header("referer") ?? null,
      country: c.req.header("cf-ipcountry") ?? null,
      content_type: contentType,
      reply_to_field: settings.reply_to_field ?? null,
    }

    const honeypotField = settings.honeypot_field ?? "_gotcha"
    const spam = scoreSpam({ data, control, meta, honeypotField })

    let status: "received" | "quarantined" | "spam" = spam.score >= 0.5 ? "spam" : "received"
    let quarantineReason: string | null = null

    if (status !== "spam" && requestOrigin !== undefined && allowedOrigins.length > 0 && cors.allowOrigin === null) {
      status = "quarantined"
      quarantineReason = "origin_rejected"
    }
    if (status === "received") {
      const rateLimit = settings.rate_limit ?? {}
      const allowed = rateLimiter.consume(`${formId}:${meta.ip}`, rateLimit.per_minute ?? 10, rateLimit.burst ?? 20)
      if (!allowed) {
        status = "quarantined"
        quarantineReason = "rate_limited"
      }
    }
    if (status === "received" && settings.turnstile?.enabled === true && settings.turnstile.secret !== undefined) {
      const token = typeof data["cf-turnstile-response"] === "string" ? data["cf-turnstile-response"] : undefined
      const ok = await verifyTurnstile(settings.turnstile.secret, token)
      if (!ok) {
        status = "quarantined"
        quarantineReason = "turnstile_failed"
      }
    }

    let formSchemaVersion: number | null = null
    const driftFindings: { readonly kind: string; readonly field: string; readonly details: Readonly<Record<string, unknown>> }[] = []
    if (form.currentSchemaVersion !== null) {
      const [schemaRow] = await db
        .select()
        .from(formSchemas)
        .where(and(eq(formSchemas.formId, formId), eq(formSchemas.version, form.currentSchemaVersion)))
        .limit(1)
      if (schemaRow !== undefined) {
        formSchemaVersion = schemaRow.version
        const jsonSchema = schemaRow.jsonSchema
        if (form.schemaMode === "enforce" || form.schemaMode === "managed") {
          const result = validateAgainstSchema(data, jsonSchema)
          if (!result.valid) {
            if (status === "received") {
              status = "quarantined"
              quarantineReason = "schema_violation"
            }
            driftFindings.push(...detectDrift(data, jsonSchema))
          }
        } else {
          driftFindings.push(...detectDrift(data, jsonSchema))
        }
      }
    }

    if (status === "received" && !isTest) {
      const [settingsRow] = await db
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, form.organizationId))
        .limit(1)
      const plan = settingsRow?.plan ?? "free"
      const configuredLimit = settingsRow?.limits["submissions_per_month"]
      const limit = configuredLimit ?? (plan === "selfhost" ? Number.POSITIVE_INFINITY : 1_000)
      if (Number.isFinite(limit)) {
        const used = await countSubmissionsThisMonth(db, form.organizationId)
        if (used >= limit) {
          status = "quarantined"
          quarantineReason = "over_quota"
        }
      }
    }

    const directRoutes =
      form.status === "paused" ? [] : await getDirectRoutesForForm(db, form.organizationId, formId)
    const streamMemberships =
      form.status === "paused"
        ? []
        : await getStreamMembershipsForForm(db, {
            id: form.id,
            organizationId: form.organizationId,
            projectId: form.projectId,
            tags: form.tags,
          })

    const receivedAt = new Date()
    const plans = planDeliveries({
      submission: { id: "pending", status, receivedAt },
      form: { status: form.status as "active" | "paused", schemaVersion: form.currentSchemaVersion },
      directRoutes,
      streamMemberships,
    })

    const mappingByStream = new Map(streamMemberships.map((membership) => [membership.streamId, membership]))
    const schemaJsonByStream = new Map<string, Readonly<Record<string, unknown>>>()
    for (const membership of streamMemberships) {
      if (membership.schemaVersion === null) continue
      const schemaJson = await getStreamSchemaJson(db, form.organizationId, membership.streamId, membership.schemaVersion)
      if (schemaJson !== null) schemaJsonByStream.set(membership.streamId, schemaJson)
    }

    const submissionId = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(submissions)
        .values({
          organizationId: form.organizationId,
          formId,
          data,
          formSchemaVersion,
          status,
          quarantineReason,
          spam,
          meta,
          idempotencyKey: idempotencyKey ?? null,
          test: isTest,
          receivedAt,
        })
        .returning({ id: submissions.id })
      const newSubmissionId = inserted?.id
      if (newSubmissionId === undefined) throw new Error("Failed to insert submission.")

      if (driftFindings.length > 0) {
        await tx.insert(driftEvents).values(
          driftFindings.map((finding) => ({
            organizationId: form.organizationId,
            formId,
            submissionId: newSubmissionId,
            kind: finding.kind,
            field: finding.field,
            details: finding.details,
          })),
        )
      }

      for (const plan of plans) {
        if (plan.status === "skipped") {
          await tx.insert(deliveries).values({
            organizationId: form.organizationId,
            submissionId: newSubmissionId,
            routeId: plan.routeId,
            destinationId: plan.destinationId,
            status: "skipped",
            skipReason: plan.skipReason ?? null,
            attempts: 0,
            payload: {},
            schemaVersion: plan.schemaVersion,
            dedupeKey: `${newSubmissionId}:${plan.routeId}`,
          })
          continue
        }
        let payload: Readonly<Record<string, unknown>> = data
        if (plan.streamId !== null) {
          const membership = mappingByStream.get(plan.streamId)
          const schemaJson = schemaJsonByStream.get(plan.streamId)
          if (membership !== undefined && schemaJson !== undefined) {
            const mapped = applyMapping(data, membership.mapping as unknown as Mapping, schemaJson)
            payload = mapped.payload
          }
        }
        // TODO(digest): a future job should batch these by (route_id, digestPeriodKey)
        // into a `digests` row and send one delivery per period. For now, per the spec,
        // digest-route deliveries are left `pending` but parked far in the future so the
        // instant worker's claim query (`next_attempt_at <= now()`) never picks them up.
        await tx.insert(deliveries).values({
          organizationId: form.organizationId,
          submissionId: newSubmissionId,
          routeId: plan.routeId,
          destinationId: plan.destinationId,
          status: "pending",
          attempts: 0,
          payload,
          schemaVersion: plan.schemaVersion,
          nextAttemptAt: plan.digestPeriodKey === undefined ? new Date() : DIGEST_PARKED_UNTIL,
          dedupeKey: `${newSubmissionId}:${plan.routeId}`,
        })
      }

      return newSubmissionId
    })

    if (plans.some((plan) => plan.status === "pending" && plan.digestPeriodKey === undefined)) {
      await notifyDeliveries(db)
    }

    logger.info(
      { org_id: form.organizationId, form_id: formId, submission_id: submissionId, request_id: requestId },
      "submission.received",
    )

    const responseBody: Record<string, unknown> = { ok: true, submission_id: submissionId, status }
    if (isTest) {
      const rows = await db.select({ id: deliveries.id }).from(deliveries).where(eq(deliveries.submissionId, submissionId))
      responseBody["deliveries"] = rows.map((row) => row.id)
    }
    return respond(c, form, settings, redirectOverride, responseBody, isForm)
  })
}
