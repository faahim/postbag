import {
  applyMapping,
  detectDrift,
  normalizeBody,
  planDeliveries,
  scoreSpam,
  validateAgainstSchema,
  PayloadTooLarge,
  PostbagError,
  newId,
  type Mapping,
} from "@postbag/core"
import { and, eq, inArray } from "drizzle-orm"
import { createHash } from "node:crypto"
import {
  acceptAnonymousSubmission,
  anonymousSandboxes,
  deliveries,
  driftEvents,
  forms,
  formSchemas,
  notifyDeliveries,
  objectDeletions,
  submissionAttachments,
  submissions,
  type Database,
} from "@postbag/db"
import type { Context } from "hono"
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"

import type { Env } from "../env.js"
import { clientIp } from "../lib/clientIp.js"
import { jsonDepth, sandboxSubmissionIdempotencyHash } from "../lib/anonymousSandbox.js"
import { decideCors } from "../lib/cors.js"
import { envelope } from "../lib/errors.js"
import {
  assertLockedAttachmentStorageCapacity,
  countMonthlySubmissions,
  lockPlanCapacity,
  organizationLimits,
  retainedAttachmentStorageBytes,
} from "../lib/planUsage.js"
import type { Logger } from "../logger.js"
import type { TokenBucketLimiter } from "../lib/rateLimit.js"
import type { ObjectStorage } from "../lib/objectStorage.js"
import type { AppEnv } from "../lib/scope.js"
import {
  getDirectRoutesForForm,
  getStreamMembershipsForForm,
  getStreamSchemaJson,
} from "../repo/routing.js"

const MAX_BODY_BYTES = 256 * 1_024
const MAX_ANONYMOUS_BODY_BYTES = 16 * 1_024
// Multipart parsing is deliberately bounded because the platform parser buffers the
// request. Keep this conservative until uploads move to a genuinely streaming parser.
const MAX_MULTIPART_BODY_BYTES = 16 * 1_024 * 1_024
const MULTIPART_OVERHEAD_BYTES = 1 * 1_024 * 1_024
const UPLOAD_RESERVATION_DELAY_MS = 60 * 60_000
const IDEMPOTENT_UPLOAD_WAIT_MS = 10_000
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
  readonly storage: ObjectStorage | null
}

type ParsedAttachment = {
  readonly id: string
  readonly fieldName: string
  readonly filename: string
  readonly contentType: string
  readonly sizeBytes: number
  readonly sha256: string
  readonly storageKey: string
  readonly body: Uint8Array
}

type FormSettings = {
  readonly allowed_origins?: readonly string[]
  readonly redirect_url?: string | null
  readonly honeypot_field?: string
  readonly rate_limit?: { readonly per_minute?: number; readonly burst?: number }
  readonly reply_to_field?: string | null
  readonly turnstile?: { readonly secret?: string; readonly enabled?: boolean }
}

const PublicSubmitReceiptSchema = z.object({
  ok: z.boolean(),
  submission_id: z.string(),
  status: z.enum(["received", "quarantined", "spam"]),
  idempotent: z.boolean().optional(),
  deliveries: z.array(z.string()).optional(),
  attachments: z.array(z.object({ id: z.string() })).optional(),
})

const publicSubmitContract = createRoute({
  method: "post",
  path: "/s/{formId}",
  operationId: "submissions_submit",
  tags: ["submissions"],
  summary: "Receive a public Submission",
  description:
    "Accepts JSON, URL-encoded data, or multipart form data. Multipart file fields become fl_ references in Submission data. Anonymous sandbox Forms do not accept files.",
  security: [],
  request: {
    params: z.object({ formId: z.string() }),
    body: {
      required: true,
      content: {
        "application/json": { schema: z.record(z.string(), z.unknown()) },
        "application/x-www-form-urlencoded": { schema: z.record(z.string(), z.unknown()) },
        "multipart/form-data": { schema: z.record(z.string(), z.unknown()) },
      },
    },
  },
  responses: {
    200: {
      description: "Submission accepted",
      content: { "application/json": { schema: PublicSubmitReceiptSchema } },
    },
    303: { description: "Browser form redirect after acceptance" },
    400: { description: "Malformed request" },
    402: {
      description: "Retained attachment storage limit reached, including pending work",
    },
    413: { description: "Body, attachment size, or attachment count limit exceeded" },
    422: { description: "Validation failed" },
    503: { description: "Attachment storage unavailable" },
  },
})

async function readBoundedBody(
  request: Request,
  maxBytes = MAX_BODY_BYTES,
): Promise<{ raw: ArrayBuffer; contentType: string }> {
  const contentType = request.headers.get("content-type")?.trim() ?? ""
  const declaredLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new PayloadTooLarge(`The submission body exceeds ${String(maxBytes)} bytes.`)
  }
  if (request.body === null) return { raw: new ArrayBuffer(0), contentType }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let next = await reader.read()
  while (!next.done) {
    total += next.value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new PayloadTooLarge(`The submission body exceeds ${String(maxBytes)} bytes.`)
    }
    chunks.push(next.value)
    next = await reader.read()
  }
  const joined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { raw: joined.buffer, contentType }
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

async function parseMultipart(
  raw: ArrayBuffer,
  contentType: string,
  limits: { readonly maxFileBytes: number; readonly maxFiles: number },
): Promise<{
  readonly input: Record<string, unknown>
  readonly attachments: readonly ParsedAttachment[]
}> {
  const request = new Request("http://local/multipart", {
    method: "POST",
    headers: { "content-type": contentType },
    body: raw,
  })
  let form: FormData
  try {
    form = await request.formData()
  } catch (error) {
    throw new PostbagError(
      "validation_failed",
      "The multipart Submission body is malformed.",
      undefined,
      { cause: error },
    )
  }
  const grouped = new Map<string, unknown[]>()
  const attachments: ParsedAttachment[] = []
  const entries: { readonly key: string; readonly value: FormDataEntryValue }[] = []
  form.forEach((value, key) => entries.push({ key, value }))
  for (const { key, value } of entries) {
    if (value instanceof File) {
      if (value.size === 0 && value.name.length === 0) continue
      if (attachments.length >= limits.maxFiles) {
        throw new PostbagError(
          "attachment_limit_reached",
          "This Submission has too many attachments.",
          {
            limit: limits.maxFiles,
          },
        )
      }
      if (value.size > limits.maxFileBytes) {
        throw new PostbagError(
          "attachment_too_large",
          "An attachment exceeds this organization's per-file limit.",
          {
            field: key,
            size_bytes: value.size,
            limit_bytes: limits.maxFileBytes,
          },
        )
      }
      const id = newId("fl")
      const body = new Uint8Array(await value.arrayBuffer())
      const filename = sanitizeFilename(value.name)
      attachments.push({
        id,
        fieldName: key,
        filename,
        contentType: value.type || "application/octet-stream",
        sizeBytes: body.byteLength,
        sha256: createHash("sha256").update(body).digest("hex"),
        storageKey: `attachments/${id}`,
        body,
      })
      const existing = grouped.get(key) ?? []
      existing.push(id)
      grouped.set(key, existing)
      continue
    }
    const existing = grouped.get(key) ?? []
    existing.push(value)
    grouped.set(key, existing)
  }
  const result: Record<string, unknown> = {}
  for (const [key, values] of grouped) {
    result[key] = values.length > 1 ? values : values[0]
  }
  return { input: result, attachments }
}

function sanitizeFilename(value: string): string {
  const basename = value.replace(/\\/g, "/").split("/").at(-1) ?? ""
  let withoutControls = ""
  for (const character of basename) {
    const code = character.codePointAt(0) ?? 0
    if (code > 31 && code !== 127) withoutControls += character
  }
  const cleaned = withoutControls.trim()
  return (cleaned || "attachment").slice(0, 180)
}

async function cleanupUploadedAttachments(
  db: Pick<Database, "delete" | "insert">,
  storage: ObjectStorage,
  organizationId: string,
  attachments: readonly ParsedAttachment[],
): Promise<void> {
  for (const attachment of attachments) {
    try {
      await storage.delete(attachment.storageKey)
      await db.delete(objectDeletions).where(eq(objectDeletions.storageKey, attachment.storageKey))
    } catch {
      await db
        .insert(objectDeletions)
        .values({
          storageKey: attachment.storageKey,
          organizationId,
          sizeBytes: attachment.sizeBytes,
        })
        .onConflictDoUpdate({
          target: objectDeletions.storageKey,
          set: {
            organizationId,
            sizeBytes: attachment.sizeBytes,
            uploadReservation: false,
            uploadIdempotencyHash: null,
            nextAttemptAt: new Date(),
          },
        })
    }
  }
}

async function parseBody(
  request: Request,
  maxBytes = MAX_BODY_BYTES,
  fileLimits: { readonly maxFileBytes: number; readonly maxFiles: number } | null = null,
): Promise<{
  readonly input: Record<string, unknown>
  readonly contentType: string
  readonly isForm: boolean
  readonly attachments: readonly ParsedAttachment[]
}> {
  const { raw, contentType } = await readBoundedBody(request, maxBytes)
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? ""
  if (mediaType === "application/json") {
    const text = new TextDecoder().decode(raw)
    if (text.trim().length === 0)
      return { input: {}, contentType: mediaType, isForm: false, attachments: [] }
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new PayloadTooLarge("The JSON submission body must be an object.")
    }
    return {
      input: parsed as Record<string, unknown>,
      contentType: mediaType,
      isForm: false,
      attachments: [],
    }
  }
  if (mediaType === "application/x-www-form-urlencoded") {
    const text = new TextDecoder().decode(raw)
    return { input: parseUrlEncoded(text), contentType: mediaType, isForm: true, attachments: [] }
  }
  if (mediaType === "multipart/form-data") {
    if (fileLimits === null) {
      throw new PostbagError(
        "unsupported_media_type",
        "File uploads are not available for this Form.",
      )
    }
    const parsed = await parseMultipart(raw, contentType, fileLimits)
    return { ...parsed, contentType: mediaType, isForm: true }
  }
  const text = new TextDecoder().decode(raw)
  return {
    input: parseUrlEncoded(text),
    contentType: mediaType.length > 0 ? mediaType : "application/x-www-form-urlencoded",
    isForm: true,
    attachments: [],
  }
}

type FormRow = typeof forms.$inferSelect

async function existingSubmissionReceipt(
  db: Pick<Database, "select">,
  form: FormRow,
  idempotencyKey: string,
): Promise<Record<string, unknown> | null> {
  const [existing] = await db
    .select({ id: submissions.id, status: submissions.status })
    .from(submissions)
    .where(
      and(
        eq(submissions.organizationId, form.organizationId),
        eq(submissions.formId, form.id),
        eq(submissions.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1)
  if (existing === undefined) return null

  const existingAttachments = await db
    .select({ id: submissionAttachments.id })
    .from(submissionAttachments)
    .where(
      and(
        eq(submissionAttachments.organizationId, form.organizationId),
        eq(submissionAttachments.submissionId, existing.id),
      ),
    )
  return {
    ok: true,
    submission_id: existing.id,
    status: existing.status,
    idempotent: true,
    ...(existingAttachments.length === 0
      ? {}
      : { attachments: existingAttachments.map((attachment) => ({ id: attachment.id })) }),
  }
}

async function getForm(db: Database, formId: string): Promise<FormRow | null> {
  const [row] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1)
  return row ?? null
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
    return (
      typeof body === "object" && body !== null && (body as { success?: boolean }).success === true
    )
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

export function registerSubmitRoutes(app: OpenAPIHono<AppEnv>, deps: SubmitDeps): void {
  const { db, logger, rateLimiter } = deps

  app.openAPIRegistry.registerPath(publicSubmitContract)

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
      .where(
        and(eq(formSchemas.formId, form.id), eq(formSchemas.version, form.currentSchemaVersion)),
      )
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
    let form = await getForm(db, formId)
    let parsedBody:
      | {
          readonly input: Record<string, unknown>
          readonly contentType: string
          readonly isForm: boolean
          readonly attachments: readonly ParsedAttachment[]
        }
      | undefined

    if (form === null) {
      const [sandbox] = await db
        .select({
          id: anonymousSandboxes.id,
          allowedOrigin: anonymousSandboxes.allowedOrigin,
        })
        .from(anonymousSandboxes)
        .where(eq(anonymousSandboxes.id, formId))
        .limit(1)
      if (sandbox === undefined) return c.json(envelope("not_found", "No form with that id."), 404)

      const requestOrigin = c.req.header("origin")
      c.header("Vary", "Origin")
      if (sandbox.allowedOrigin === null) {
        c.header("Access-Control-Allow-Origin", requestOrigin ?? "*")
      } else if (requestOrigin === sandbox.allowedOrigin) {
        c.header("Access-Control-Allow-Origin", sandbox.allowedOrigin)
      } else if (requestOrigin !== undefined) {
        throw new PostbagError(
          "origin_rejected",
          "This origin is not allowed to submit to the sandbox Form.",
        )
      }

      parsedBody = await parseBody(c.req.raw, MAX_ANONYMOUS_BODY_BYTES, {
        maxFileBytes: 0,
        maxFiles: 0,
      })
      const normalized = normalizeBody(parsedBody.input, parsedBody.contentType)
      if (jsonDepth(normalized.data) > 4) {
        throw new PayloadTooLarge(
          "Anonymous submission data may be nested at most four levels deep.",
        )
      }
      const idempotencyKey =
        c.req.header("idempotency-key") ??
        (typeof normalized.control._idempotency === "string"
          ? normalized.control._idempotency
          : undefined)
      const receivedAt = new Date()
      const anonymousResult = await acceptAnonymousSubmission(db, {
        sandboxId: formId,
        data: normalized.data,
        meta: {
          origin: requestOrigin ?? null,
          content_type: parsedBody.contentType,
          user_agent: c.req.header("user-agent") ?? "",
        },
        idempotencyKeyHash:
          idempotencyKey === undefined
            ? null
            : sandboxSubmissionIdempotencyHash(deps.env.BETTER_AUTH_SECRET, formId, idempotencyKey),
        receivedAt,
      })

      if (anonymousResult.kind === "accepted") {
        logger.info(
          {
            sandbox_id: formId,
            submission_id: anonymousResult.submissionId,
            request_id: requestId,
            idempotent: anonymousResult.idempotent,
          },
          "anonymous_submission.accepted",
        )
        const accept = c.req.header("accept") ?? ""
        if (parsedBody.isForm && !accept.includes("application/json")) {
          return c.redirect(`/s/${formId}/thanks`, 303)
        }
        return c.json({
          ok: true,
          submission_id: anonymousResult.submissionId,
          status: "received",
          test: true,
          ...(anonymousResult.idempotent ? { idempotent: true } : {}),
        })
      }

      // Claim may have committed between the initial normal-Form lookup and the sandbox's
      // conditional counter update. Resolve the real Form again before reporting a sandbox
      // error so the stable /s/{id} URL never has a claim-race gap.
      form = await getForm(db, formId)
      if (form === null) {
        if (anonymousResult.expiresAt !== null && anonymousResult.expiresAt <= receivedAt) {
          throw new PostbagError("sandbox_expired", "This sandbox has expired.")
        }
        if (anonymousResult.acceptedCount !== null && anonymousResult.acceptedCount >= 5) {
          throw new PostbagError(
            "sandbox_limit_reached",
            "This sandbox has already accepted five Submissions.",
          )
        }
        if (anonymousResult.status === "claimed") {
          throw new PostbagError("sandbox_claimed", "This sandbox was already claimed.")
        }
        throw new PostbagError("sandbox_unauthorized", "This sandbox is not available.")
      }
    }

    const settings = form.settings as FormSettings
    const allowedOrigins = settings.allowed_origins ?? []
    const requestOrigin = c.req.header("origin")
    const cors = decideCors(requestOrigin, allowedOrigins)
    c.header("Vary", "Origin")
    if (cors.allowOrigin !== null) c.header("Access-Control-Allow-Origin", cors.allowOrigin)

    const requestMediaType = (c.req.header("content-type") ?? "")
      .split(";", 1)[0]
      ?.trim()
      .toLowerCase()
    const headerIdempotencyKey = c.req.header("idempotency-key")
    const bodyIndependentReplay =
      requestMediaType === "application/json" ||
      (c.req.header("accept") ?? "").includes("application/json")
    if (headerIdempotencyKey !== undefined && bodyIndependentReplay) {
      const existingReceipt = await existingSubmissionReceipt(db, form, headerIdempotencyKey)
      if (existingReceipt !== null) {
        return respond(
          c,
          form,
          settings,
          undefined,
          existingReceipt,
          requestMediaType !== "application/json",
        )
      }
    }

    const limits = await organizationLimits(db, form.organizationId)
    const multipartBodyLimit = Math.min(
      MAX_MULTIPART_BODY_BYTES,
      limits.attachment_max_bytes * limits.attachments_per_submission + MULTIPART_OVERHEAD_BYTES,
    )
    const { input, contentType, isForm, attachments } =
      parsedBody ??
      (await parseBody(
        c.req.raw,
        requestMediaType === "multipart/form-data" ? multipartBodyLimit : MAX_BODY_BYTES,
        {
          maxFileBytes: limits.attachment_max_bytes,
          maxFiles: limits.attachments_per_submission,
        },
      ))
    if (attachments.length > 0 && deps.storage === null) {
      throw new PostbagError(
        "attachment_storage_unavailable",
        "This Postbag instance is not configured to accept file attachments.",
      )
    }
    const { data, control } = normalizeBody(input, contentType)
    const ctrl = control as ControlFields
    const isTest = ctrl._test === true || ctrl._test === "true"
    const redirectOverride = typeof ctrl._redirect === "string" ? ctrl._redirect : undefined

    const idempotencyKey =
      headerIdempotencyKey ??
      (typeof ctrl._idempotency === "string" ? ctrl._idempotency : undefined)
    if (idempotencyKey !== undefined) {
      const existingReceipt = await existingSubmissionReceipt(db, form, idempotencyKey)
      if (existingReceipt !== null) {
        return respond(c, form, settings, redirectOverride, existingReceipt, isForm)
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

    if (
      status !== "spam" &&
      requestOrigin !== undefined &&
      allowedOrigins.length > 0 &&
      cors.allowOrigin === null
    ) {
      status = "quarantined"
      quarantineReason = "origin_rejected"
    }
    if (status === "received") {
      const rateLimit = settings.rate_limit ?? {}
      const allowed = rateLimiter.consume(
        `${formId}:${meta.ip}`,
        rateLimit.per_minute ?? 10,
        rateLimit.burst ?? 20,
      )
      if (!allowed) {
        status = "quarantined"
        quarantineReason = "rate_limited"
      }
    }
    if (
      status === "received" &&
      settings.turnstile?.enabled === true &&
      settings.turnstile.secret !== undefined
    ) {
      const token =
        typeof data["cf-turnstile-response"] === "string"
          ? data["cf-turnstile-response"]
          : undefined
      const ok = await verifyTurnstile(settings.turnstile.secret, token)
      if (!ok) {
        status = "quarantined"
        quarantineReason = "turnstile_failed"
      }
    }

    let formSchemaVersion: number | null = null
    const driftFindings: {
      readonly kind: string
      readonly field: string
      readonly details: Readonly<Record<string, unknown>>
    }[] = []
    if (form.currentSchemaVersion !== null) {
      const [schemaRow] = await db
        .select()
        .from(formSchemas)
        .where(
          and(eq(formSchemas.formId, formId), eq(formSchemas.version, form.currentSchemaVersion)),
        )
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
    const mappingByStream = new Map(
      streamMemberships.map((membership) => [membership.streamId, membership]),
    )
    const schemaJsonByStream = new Map<string, Readonly<Record<string, unknown>>>()
    for (const membership of streamMemberships) {
      if (membership.schemaVersion === null) continue
      const schemaJson = await getStreamSchemaJson(
        db,
        form.organizationId,
        membership.streamId,
        membership.schemaVersion,
      )
      if (schemaJson !== null) schemaJsonByStream.set(membership.streamId, schemaJson)
    }

    const requestedAttachmentBytes = attachments.reduce(
      (total, attachment) => total + attachment.sizeBytes,
      0,
    )
    if (requestedAttachmentBytes > 0) {
      const usedAttachmentBytes = await retainedAttachmentStorageBytes(db, form.organizationId)
      if (usedAttachmentBytes + requestedAttachmentBytes > limits.attachment_storage_bytes) {
        throw new PostbagError(
          "attachment_storage_limit_reached",
          "This organization has reached its attachment storage limit.",
          {
            resource: "attachment_storage_bytes",
            limit: limits.attachment_storage_bytes,
            used: usedAttachmentBytes,
            requested: requestedAttachmentBytes,
          },
        )
      }
    }

    type AcceptedSubmission = {
      readonly kind: "accepted"
      readonly submissionId: string
      readonly hasPendingDelivery: boolean
      readonly status: string
    }
    const uploaded: ParsedAttachment[] = []
    let acceptedCandidate: AcceptedSubmission | undefined
    let result: AcceptedSubmission | undefined
    let transactionFailed = false
    let transactionError: unknown
    const uploadIdempotencyHash =
      idempotencyKey === undefined
        ? null
        : createHash("sha256").update(`${form.id}\0${idempotencyKey}`).digest("hex")
    if (attachments.length > 0) {
      // Serialize only the small reservation transaction. Once committed, the row
      // itself makes capacity durable while object storage I/O runs concurrently.
      const waitDeadline = Date.now() + IDEMPOTENT_UPLOAD_WAIT_MS
      for (;;) {
        const admission = await db.transaction(async (tx) => {
          await lockPlanCapacity(tx, form.organizationId, "attachments")
          if (idempotencyKey !== undefined) {
            const existingReceipt = await existingSubmissionReceipt(tx, form, idempotencyKey)
            if (existingReceipt !== null) return { kind: "replay" as const, existingReceipt }
          }
          if (uploadIdempotencyHash !== null) {
            const leader = attachments[0]
            if (leader === undefined) throw new Error("Attachment reservation has no leader.")
            const claimed = await tx
              .insert(objectDeletions)
              .values({
                storageKey: leader.storageKey,
                organizationId: form.organizationId,
                sizeBytes: 0,
                uploadReservation: true,
                uploadIdempotencyHash,
                nextAttemptAt: new Date(Date.now() + UPLOAD_RESERVATION_DELAY_MS),
              })
              .onConflictDoNothing()
              .returning({ storageKey: objectDeletions.storageKey })
            if (claimed.length === 0) return { kind: "pending" as const }
            // The insert may have waited for a winner to delete its reservation. Under
            // READ COMMITTED this fresh statement sees that winner's committed Submission.
            if (idempotencyKey !== undefined) {
              const existingReceipt = await existingSubmissionReceipt(tx, form, idempotencyKey)
              if (existingReceipt !== null) {
                await tx
                  .delete(objectDeletions)
                  .where(eq(objectDeletions.storageKey, leader.storageKey))
                return { kind: "replay" as const, existingReceipt }
              }
            }
          }
          await assertLockedAttachmentStorageCapacity(
            tx,
            form.organizationId,
            requestedAttachmentBytes,
          )
          const reservations = uploadIdempotencyHash === null ? attachments : attachments.slice(1)
          if (uploadIdempotencyHash !== null) {
            const leader = attachments[0]
            if (leader === undefined) throw new Error("Attachment reservation has no leader.")
            await tx
              .update(objectDeletions)
              .set({ sizeBytes: leader.sizeBytes })
              .where(eq(objectDeletions.storageKey, leader.storageKey))
          }
          if (reservations.length > 0) {
            await tx.insert(objectDeletions).values(
              reservations.map((attachment) => ({
                storageKey: attachment.storageKey,
                organizationId: form.organizationId,
                sizeBytes: attachment.sizeBytes,
                uploadReservation: true,
                uploadIdempotencyHash: null,
                nextAttemptAt: new Date(Date.now() + UPLOAD_RESERVATION_DELAY_MS),
              })),
            )
          }
          return { kind: "reserved" as const }
        })
        if (admission.kind === "replay") {
          return respond(c, form, settings, redirectOverride, admission.existingReceipt, isForm)
        }
        if (admission.kind === "reserved") break
        if (Date.now() >= waitDeadline) {
          throw new PostbagError(
            "attachment_storage_unavailable",
            "An upload with this idempotency key is still in progress. Retry the same request.",
          )
        }
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
    }

    try {
      const outcome = await db.transaction(async (tx) => {
        try {
          if (attachments.length > 0) {
            const storage = deps.storage
            if (storage === null) throw new Error("Attachment storage became unavailable.")
            for (const attachment of attachments) {
              // Track before PutObject: a transport error can arrive after storage committed
              // the object. DeleteObject is idempotent, so cleanup must assume it may exist.
              uploaded.push(attachment)
              try {
                await storage.put({
                  key: attachment.storageKey,
                  body: attachment.body,
                  contentType: attachment.contentType,
                  filename: attachment.filename,
                  sha256: attachment.sha256,
                })
              } catch (error) {
                throw new PostbagError(
                  "attachment_storage_unavailable",
                  "Postbag could not store every attachment safely. No Submission was accepted.",
                  undefined,
                  { cause: error },
                )
              }
            }
          }

          // A savepoint keeps the parent transaction usable for durable cleanup if a
          // later Submission/outbox write fails while the attachment lock is held.
          return await tx.transaction(async (submissionTx) => {
            if (status === "received" && !isTest) {
              await lockPlanCapacity(submissionTx, form.organizationId, "submissions")
              const limit = (await organizationLimits(submissionTx, form.organizationId))
                .submissions_per_month
              if (Number.isFinite(limit)) {
                const used = await countMonthlySubmissions(submissionTx, form.organizationId)
                if (used >= limit) {
                  status = "quarantined"
                  quarantineReason = "over_quota"
                }
              }
            }

            const plans = planDeliveries({
              submission: { id: "pending", status, receivedAt },
              form: {
                status: form.status as "active" | "paused",
                schemaVersion: form.currentSchemaVersion,
              },
              directRoutes,
              streamMemberships,
            })
            const [inserted] = await submissionTx
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

            if (attachments.length > 0) {
              const renewedReservations = await submissionTx
                .update(objectDeletions)
                .set({ nextAttemptAt: new Date(Date.now() + UPLOAD_RESERVATION_DELAY_MS) })
                .where(
                  and(
                    inArray(
                      objectDeletions.storageKey,
                      attachments.map((attachment) => attachment.storageKey),
                    ),
                    eq(objectDeletions.uploadReservation, true),
                  ),
                )
                .returning({ storageKey: objectDeletions.storageKey })
              if (renewedReservations.length !== attachments.length) {
                throw new PostbagError(
                  "attachment_storage_unavailable",
                  "Postbag could not finalize every attachment safely. No Submission was accepted.",
                )
              }
              await submissionTx.insert(submissionAttachments).values(
                attachments.map((attachment) => ({
                  id: attachment.id,
                  organizationId: form.organizationId,
                  formId,
                  submissionId: newSubmissionId,
                  fieldName: attachment.fieldName,
                  filename: attachment.filename,
                  contentType: attachment.contentType,
                  sizeBytes: attachment.sizeBytes,
                  sha256: attachment.sha256,
                  storageKey: attachment.storageKey,
                  createdAt: receivedAt,
                })),
              )
              await submissionTx.delete(objectDeletions).where(
                inArray(
                  objectDeletions.storageKey,
                  attachments.map((attachment) => attachment.storageKey),
                ),
              )
            }

            if (driftFindings.length > 0) {
              await submissionTx.insert(driftEvents).values(
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
                await submissionTx.insert(deliveries).values({
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
                  const mapped = applyMapping(
                    data,
                    membership.mapping as unknown as Mapping,
                    schemaJson,
                  )
                  payload = mapped.payload
                }
              }
              // Digest-route deliveries (job D §3): the digest worker loop groups these by
              // (route_id, digest_period_key) once the period closes and sends one payload per
              // destination — it never claims them through the instant path. Parking
              // next_attempt_at far in the future keeps the instant worker's claim query
              // (`next_attempt_at <= now()`) from ever picking them up directly.
              await submissionTx.insert(deliveries).values({
                organizationId: form.organizationId,
                submissionId: newSubmissionId,
                routeId: plan.routeId,
                destinationId: plan.destinationId,
                status: "pending",
                attempts: 0,
                payload,
                schemaVersion: plan.schemaVersion,
                nextAttemptAt:
                  plan.digestPeriodKey === undefined ? new Date() : DIGEST_PARKED_UNTIL,
                digestPeriodKey: plan.digestPeriodKey ?? null,
                dedupeKey: `${newSubmissionId}:${plan.routeId}`,
              })
            }

            const accepted: AcceptedSubmission = {
              kind: "accepted" as const,
              submissionId: newSubmissionId,
              hasPendingDelivery: plans.some(
                (plan) => plan.status === "pending" && plan.digestPeriodKey === undefined,
              ),
              status,
            }
            acceptedCandidate = accepted
            return accepted
          })
        } catch (error) {
          if (uploaded.length > 0 && deps.storage !== null) {
            await cleanupUploadedAttachments(tx, deps.storage, form.organizationId, uploaded)
          }
          return { kind: "failed" as const, error }
        }
      })

      if (outcome.kind === "failed") {
        // The transaction committed its cleanup row (or confirmed object deletion).
        uploaded.length = 0
        throw outcome.error
      }
      result = outcome
    } catch (error) {
      transactionFailed = true
      transactionError = error
    }

    if (transactionFailed) {
      // COMMIT errors are ambiguous: PostgreSQL may have committed before the client
      // lost the connection. Only clean up after confirming the candidate row is absent.
      if (acceptedCandidate !== undefined) {
        const [committed] = await db
          .select({ id: submissions.id })
          .from(submissions)
          .where(
            and(
              eq(submissions.organizationId, form.organizationId),
              eq(submissions.id, acceptedCandidate.submissionId),
            ),
          )
          .limit(1)
        if (committed !== undefined) {
          result = acceptedCandidate
          transactionFailed = false
        } else if (uploaded.length > 0) {
          const storage = deps.storage
          if (storage !== null) {
            await db.transaction(async (tx) => {
              await cleanupUploadedAttachments(tx, storage, form.organizationId, uploaded)
            })
            uploaded.length = 0
          }
        }
      } else if (uploaded.length > 0) {
        // The savepoint failed before an accepted candidate existed. No Submission can
        // have committed, so cleanup is unambiguous even if the parent COMMIT failed.
        const storage = deps.storage
        if (storage !== null) {
          await db.transaction(async (tx) => {
            await cleanupUploadedAttachments(tx, storage, form.organizationId, uploaded)
          })
          uploaded.length = 0
        }
      }

      if (transactionFailed && idempotencyKey !== undefined) {
        const existingReceipt = await existingSubmissionReceipt(db, form, idempotencyKey)
        if (existingReceipt !== null) {
          return respond(c, form, settings, redirectOverride, existingReceipt, isForm)
        }
      }
      if (transactionFailed) throw transactionError
    }

    if (result === undefined) {
      throw new Error("Submission transaction completed without a result.")
    }

    if (result.hasPendingDelivery) {
      await notifyDeliveries(db)
    }

    logger.info(
      {
        org_id: form.organizationId,
        form_id: formId,
        submission_id: result.submissionId,
        request_id: requestId,
      },
      "submission.received",
    )

    const responseBody: Record<string, unknown> = {
      ok: true,
      submission_id: result.submissionId,
      status: result.status,
      ...(attachments.length === 0
        ? {}
        : { attachments: attachments.map((attachment) => ({ id: attachment.id })) }),
    }
    if (isTest) {
      const rows = await db
        .select({ id: deliveries.id })
        .from(deliveries)
        .where(eq(deliveries.submissionId, result.submissionId))
      responseBody["deliveries"] = rows.map((row) => row.id)
    }
    return respond(c, form, settings, redirectOverride, responseBody, isForm)
  })
}
