import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { newId, PostbagError } from "@postbag/core"
import {
  anonymousSandboxes,
  anonymousSubmissions,
  createAnonymousSandbox,
  events,
  forms,
  getAnonymousSandboxByCapability,
  projects,
  submissions,
  user,
  type Database,
} from "@postbag/db"
import { and, eq, like } from "drizzle-orm"

import type { Env } from "../../env.js"
import {
  claimEmailHash,
  decryptSandboxToken,
  encryptSandboxToken,
  isCanonicalUuidV4,
  newSandboxToken,
  normalizeClaimEmail,
  sandboxIdFromToken,
  sandboxRequestBodyHash,
  sandboxSourceKey,
  sandboxTokenHash,
  keyedSandboxHash,
} from "../../lib/anonymousSandbox.js"
import { clientIp } from "../../lib/clientIp.js"
import { assertLockedPlanCapacity, lockPlanCapacity } from "../../lib/planUsage.js"
import { assertScope, type AppEnv, type RequestScope } from "../../lib/scope.js"
import { renderEmbed } from "../../lib/snippets.js"
import { ErrorEnvelopeSchema, IdSchema, JsonRecord, TimestampSchema } from "../../schemas.js"

const SANDBOX_LIFETIME_MS = 24 * 60 * 60_000

const CreateSandboxInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    origin: z
      .url()
      .optional()
      .describe("The site origin allowed to submit, canonicalized before storage."),
    claim_email: z
      .email()
      .optional()
      .describe(
        "Optional verified-email binding. Include only when the user explicitly supplied it.",
      ),
  })
  .strict()

const SandboxSubmissionSchema = z.object({
  id: IdSchema,
  data: JsonRecord,
  meta: JsonRecord,
  received_at: TimestampSchema,
})

const SandboxStatusSchema = z.object({
  id: IdSchema,
  name: z.string(),
  status: z.enum(["active", "claimed", "expired", "blocked"]),
  submit_url: z.string(),
  expires_at: TimestampSchema,
  accepted_count: z.number().int(),
  remaining: z.number().int(),
  submissions: z.array(SandboxSubmissionSchema),
})

const SandboxCreatedSchema = z.object({
  sandbox: SandboxStatusSchema.omit({ submissions: true }),
  sandbox_token: z.string().describe("Shown only in this response. Treat it as a secret."),
  authorization: z.object({
    scheme: z.literal("Sandbox"),
    example: z.string(),
  }),
  embed: z.object({
    html: z.string(),
    fetch: z.string(),
    react: z.string(),
    astro: z.string(),
    nextjs_action: z.string(),
  }),
  verify: z.object({ curl: z.string(), then: z.string() }),
  claim_url: z.string(),
  next: z.array(
    z.object({
      why: z.string(),
      method: z.string(),
      path: z.string(),
      headers: z.record(z.string(), z.string()).optional(),
      body: JsonRecord.optional(),
    }),
  ),
})

const SandboxClaimedSchema = z.object({
  claimed: z.literal(true),
  idempotent: z.boolean(),
  form: z.object({
    id: IdSchema,
    project_id: IdSchema,
    slug: z.string(),
    name: z.string(),
    submit_url: z.string(),
  }),
  copied_test_submissions: z.number().int(),
  next: z.array(
    z.object({
      why: z.string(),
      method: z.string(),
      path: z.string(),
      body: JsonRecord.optional(),
    }),
  ),
})

const createSandboxRoute = createRoute({
  method: "post",
  path: "/v1/public/sandboxes",
  operationId: "public_sandboxes_create",
  tags: ["discovery"],
  summary: "Create a bounded 24-hour sandbox Form without an account",
  description:
    "Requires a canonical UUIDv4 Idempotency-Key. Creates an inert sandbox Form that can accept " +
    "at most five test Submissions and cannot create Destinations, Routes, Deliveries, Events or outbound traffic.",
  security: [],
  request: {
    headers: z.object({
      "idempotency-key": z.string().describe("Canonical lowercase UUIDv4 generated with a CSPRNG."),
    }),
    body: { content: { "application/json": { schema: CreateSandboxInputSchema } } },
  },
  responses: {
    201: {
      description: "created or idempotently replayed",
      content: { "application/json": { schema: SandboxCreatedSchema } },
    },
    409: {
      description: "Idempotency conflict",
      content: { "application/json": { schema: ErrorEnvelopeSchema } },
    },
    422: {
      description: "Invalid input",
      content: { "application/json": { schema: ErrorEnvelopeSchema } },
    },
    429: {
      description: "Source allowance exhausted",
      content: { "application/json": { schema: ErrorEnvelopeSchema } },
    },
    503: {
      description: "Disabled or globally full",
      content: { "application/json": { schema: ErrorEnvelopeSchema } },
    },
  },
})

const getSandboxRoute = createRoute({
  method: "get",
  path: "/v1/public/sandboxes/{id}",
  operationId: "public_sandboxes_get",
  tags: ["discovery"],
  summary: "Read a sandbox and its bounded Submissions using the sandbox capability",
  security: [{ sandboxAuth: [] }],
  request: {
    params: z.object({ id: IdSchema }),
    headers: z.object({ authorization: z.string().describe("Sandbox <sandbox_token>") }),
  },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: SandboxStatusSchema } } },
    401: {
      description: "Invalid sandbox capability",
      content: { "application/json": { schema: ErrorEnvelopeSchema } },
    },
    410: {
      description: "Expired or consumed",
      content: { "application/json": { schema: ErrorEnvelopeSchema } },
    },
  },
})

const claimSandboxRoute = createRoute({
  method: "post",
  path: "/v1/sandboxes/{id}/claim",
  operationId: "sandboxes_claim",
  tags: ["forms"],
  summary: "Claim a sandbox Form into the active organization",
  description:
    "Requires both an authenticated manage-scoped actor and the sandbox capability in " +
    "Postbag-Sandbox-Token. The Form id and submit URL remain unchanged.",
  request: {
    params: z.object({ id: IdSchema }),
    headers: z.object({
      "postbag-sandbox-token": z.string().describe("The sandbox token returned at creation."),
    }),
  },
  responses: {
    200: {
      description: "claimed or idempotently returned",
      content: { "application/json": { schema: SandboxClaimedSchema } },
    },
    401: {
      description: "Invalid sandbox capability",
      content: { "application/json": { schema: ErrorEnvelopeSchema } },
    },
    402: {
      description: "Target organization Form limit reached",
      content: { "application/json": { schema: ErrorEnvelopeSchema } },
    },
    403: {
      description: "Claim email mismatch",
      content: { "application/json": { schema: ErrorEnvelopeSchema } },
    },
    410: {
      description: "Expired or consumed",
      content: { "application/json": { schema: ErrorEnvelopeSchema } },
    },
  },
})

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "")
  return base.length === 0 ? "form" : base.slice(0, 50)
}

function sandboxTokenFromAuthorization(value: string): string | null {
  const match = /^Sandbox\s+(.+)$/u.exec(value.trim())
  return match?.[1] ?? null
}

function assertedTokenForId(token: string, sandboxId: string): string {
  if (sandboxIdFromToken(token) !== sandboxId) {
    throw new PostbagError("sandbox_unauthorized", "The sandbox token is invalid.")
  }
  return token
}

function statusBody(
  appUrl: string,
  sandbox: typeof anonymousSandboxes.$inferSelect,
  rows: readonly (typeof anonymousSubmissions.$inferSelect)[],
) {
  return {
    id: sandbox.id,
    name: sandbox.name,
    status: sandbox.status as "active" | "claimed" | "expired" | "blocked",
    submit_url: `${appUrl}/s/${sandbox.id}`,
    expires_at: sandbox.expiresAt.toISOString(),
    accepted_count: sandbox.acceptedCount,
    remaining: Math.max(0, 5 - sandbox.acceptedCount),
    submissions: rows.map((row) => ({
      id: row.id,
      data: row.data,
      meta: row.meta,
      received_at: row.receivedAt.toISOString(),
    })),
  }
}

function actorUserId(scope: RequestScope): string | null {
  if (scope.actor.type === "session") return scope.actor.userId
  return scope.actor.userId ?? null
}

function nextAfterClaim(formId: string) {
  return [
    {
      why: "Add a Destination",
      method: "POST",
      path: "/v1/destinations",
      body: { type: "email", config: { to: ["you@example.com"] } },
    },
    {
      why: "Connect the Destination to this Form",
      method: "POST",
      path: "/v1/routes",
      body: { form_id: formId, destination_id: "ds_replace_me" },
    },
  ]
}

export function registerPublicAnonymousSandboxRoutes(
  app: OpenAPIHono<AppEnv>,
  db: Database,
  env: Env,
): void {
  app.openapi(createSandboxRoute, async (c) => {
    if (!env.ANONYMOUS_QUICKSTART_ENABLED) {
      throw new PostbagError(
        "anonymous_quickstart_disabled",
        "Anonymous quickstart is disabled on this Postbag instance.",
      )
    }
    const idempotencyKey = c.req.valid("header")["idempotency-key"]
    if (!isCanonicalUuidV4(idempotencyKey)) {
      throw new PostbagError(
        "validation_failed",
        "Idempotency-Key must be a canonical lowercase UUIDv4.",
        { header: "Idempotency-Key" },
      )
    }
    const input = c.req.valid("json")
    const normalized = {
      name: input.name.trim(),
      ...(input.origin === undefined ? {} : { origin: new URL(input.origin).origin }),
      ...(input.claim_email === undefined
        ? {}
        : { claim_email: normalizeClaimEmail(input.claim_email) }),
    }
    const sandboxId = newId("fm")
    const token = newSandboxToken(sandboxId)
    const expiresAt = new Date(Date.now() + SANDBOX_LIFETIME_MS)
    const result = await createAnonymousSandbox(
      db,
      {
        id: sandboxId,
        name: normalized.name,
        slug: slugify(normalized.name),
        allowedOrigin: normalized.origin ?? null,
        claimEmailHash:
          normalized.claim_email === undefined
            ? null
            : claimEmailHash(env.BETTER_AUTH_SECRET, normalized.claim_email),
        tokenHash: sandboxTokenHash(env.BETTER_AUTH_SECRET, token),
        tokenReplayEncrypted: encryptSandboxToken(env.BETTER_AUTH_SECRET, token),
        expiresAt,
        creationIdempotencyKeyHash: keyedSandboxHash(
          env.BETTER_AUTH_SECRET,
          "creation-idempotency",
          idempotencyKey,
        ),
        requestBodyHash: sandboxRequestBodyHash(env.BETTER_AUTH_SECRET, normalized),
        abuseSourceKey: sandboxSourceKey(env.BETTER_AUTH_SECRET, clientIp(c)),
      },
      env.ANONYMOUS_SANDBOX_GLOBAL_LIMIT,
    )
    const sandbox = result.sandbox
    if (sandbox.status !== "active" || sandbox.expiresAt <= new Date()) {
      throw new PostbagError(
        sandbox.status === "claimed" ? "sandbox_claimed" : "sandbox_expired",
        sandbox.status === "claimed"
          ? "This sandbox was already claimed."
          : "This sandbox has expired.",
      )
    }
    if (sandbox.tokenReplayEncrypted === null) {
      throw new PostbagError("sandbox_claimed", "This sandbox token has already been consumed.")
    }
    const replayToken = result.replayed
      ? decryptSandboxToken(env.BETTER_AUTH_SECRET, sandbox.tokenReplayEncrypted)
      : token
    const submitUrl = `${env.APP_URL}/s/${sandbox.id}`
    const claimUrl = `${env.APP_URL}/app/claim#token=${encodeURIComponent(replayToken)}`
    const embed = renderEmbed(submitUrl, undefined)
    c.header("Cache-Control", "no-store")
    return c.json(
      {
        sandbox: {
          id: sandbox.id,
          name: sandbox.name,
          status: "active" as const,
          submit_url: submitUrl,
          expires_at: sandbox.expiresAt.toISOString(),
          accepted_count: sandbox.acceptedCount,
          remaining: Math.max(0, 5 - sandbox.acceptedCount),
        },
        sandbox_token: replayToken,
        authorization: {
          scheme: "Sandbox" as const,
          example: `Authorization: Sandbox ${replayToken}`,
        },
        embed,
        verify: {
          curl: `curl -X POST ${submitUrl} -H 'Content-Type: application/json' -d '{"email":"you@example.com","message":"Hello"}'`,
          then: `GET /v1/public/sandboxes/${sandbox.id} with Authorization: Sandbox <sandbox_token>`,
        },
        claim_url: claimUrl,
        next: [
          {
            why: "Submit a test payload",
            method: "POST",
            path: `/s/${sandbox.id}`,
            body: { email: "you@example.com", message: "Hello" },
          },
          {
            why: "Verify durable receipt",
            method: "GET",
            path: `/v1/public/sandboxes/${sandbox.id}`,
            headers: { Authorization: "Sandbox <sandbox_token>" },
          },
          {
            why: "Claim after email-code sign-in",
            method: "POST",
            path: `/v1/sandboxes/${sandbox.id}/claim`,
            headers: {
              Authorization: "Bearer <manage_api_key>",
              "Postbag-Sandbox-Token": "<sandbox_token>",
            },
          },
        ],
      },
      201,
    )
  })

  app.openapi(getSandboxRoute, async (c) => {
    const { id } = c.req.valid("param")
    const token = sandboxTokenFromAuthorization(c.req.valid("header").authorization)
    if (token === null)
      throw new PostbagError("sandbox_unauthorized", "The sandbox token is invalid.")
    assertedTokenForId(token, id)
    const result = await getAnonymousSandboxByCapability(
      db,
      id,
      sandboxTokenHash(env.BETTER_AUTH_SECRET, token),
    )
    if (result === null)
      throw new PostbagError("sandbox_unauthorized", "The sandbox token is invalid.")
    if (result.sandbox.status === "claimed") {
      throw new PostbagError("sandbox_claimed", "This sandbox has already been claimed.")
    }
    if (result.sandbox.expiresAt <= new Date() || result.sandbox.status === "expired") {
      throw new PostbagError("sandbox_expired", "This sandbox has expired.")
    }
    if (result.sandbox.status !== "active") {
      throw new PostbagError("sandbox_unauthorized", "This sandbox is not available.")
    }
    c.header("Cache-Control", "no-store")
    return c.json(statusBody(env.APP_URL, result.sandbox, result.submissions), 200)
  })
}

export function registerAuthenticatedAnonymousSandboxRoutes(
  app: OpenAPIHono<AppEnv>,
  db: Database,
  env: Env,
): void {
  app.openapi(claimSandboxRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { id } = c.req.valid("param")
    const token = assertedTokenForId(c.req.valid("header")["postbag-sandbox-token"], id)
    const tokenHash = sandboxTokenHash(env.BETTER_AUTH_SECRET, token)
    const claimantUserId = actorUserId(scope)

    const result = await db.transaction(async (tx) => {
      const [sandbox] = await tx
        .select()
        .from(anonymousSandboxes)
        .where(and(eq(anonymousSandboxes.id, id), eq(anonymousSandboxes.tokenHash, tokenHash)))
        .for("update")
        .limit(1)
      if (sandbox === undefined) {
        throw new PostbagError("sandbox_unauthorized", "The sandbox token is invalid.")
      }

      if (sandbox.status === "claimed") {
        const sameClaimant =
          sandbox.claimedOrganizationId === scope.organizationId &&
          sandbox.claimedUserId === claimantUserId
        if (!sameClaimant) {
          throw new PostbagError("sandbox_claimed", "This sandbox was already claimed.")
        }
        const [claimedForm] = await tx.select().from(forms).where(eq(forms.id, id)).limit(1)
        if (claimedForm === undefined) throw new Error("Claimed sandbox is missing its Form.")
        const [copied] = await tx
          .select({ value: anonymousSandboxes.acceptedCount })
          .from(anonymousSandboxes)
          .where(eq(anonymousSandboxes.id, id))
          .limit(1)
        return { form: claimedForm, copiedCount: copied?.value ?? 0, idempotent: true }
      }
      if (sandbox.expiresAt <= new Date() || sandbox.status === "expired") {
        throw new PostbagError("sandbox_expired", "This sandbox has expired.")
      }
      if (sandbox.status !== "active") {
        throw new PostbagError("sandbox_unauthorized", "This sandbox cannot be claimed.")
      }

      if (sandbox.claimEmailHash !== null) {
        if (claimantUserId === null) {
          throw new PostbagError(
            "sandbox_claim_email_mismatch",
            "This API key does not identify a verified user for the email-bound claim.",
          )
        }
        const [claimant] = await tx
          .select({ email: user.email, emailVerified: user.emailVerified })
          .from(user)
          .where(eq(user.id, claimantUserId))
          .limit(1)
        const matches =
          claimant?.emailVerified === true &&
          claimEmailHash(env.BETTER_AUTH_SECRET, claimant.email) === sandbox.claimEmailHash
        if (!matches) {
          throw new PostbagError(
            "sandbox_claim_email_mismatch",
            "The verified claimant email does not match this sandbox.",
          )
        }
      }

      await lockPlanCapacity(tx, scope.organizationId, "forms")
      await assertLockedPlanCapacity(tx, scope.organizationId, "forms")

      let [project] = await tx
        .select()
        .from(projects)
        .where(and(eq(projects.organizationId, scope.organizationId), eq(projects.slug, "default")))
        .limit(1)
      if (project === undefined) {
        ;[project] = await tx
          .insert(projects)
          .values({
            id: newId("prj"),
            organizationId: scope.organizationId,
            slug: "default",
            name: "Default",
            tags: [],
          })
          .onConflictDoNothing()
          .returning()
        if (project === undefined) {
          ;[project] = await tx
            .select()
            .from(projects)
            .where(
              and(eq(projects.organizationId, scope.organizationId), eq(projects.slug, "default")),
            )
            .limit(1)
        }
      }
      if (project === undefined) throw new Error("Failed to resolve Default Project.")

      const slugRows = await tx
        .select({ slug: forms.slug })
        .from(forms)
        .where(
          and(
            eq(forms.organizationId, scope.organizationId),
            eq(forms.projectId, project.id),
            like(forms.slug, `${sandbox.slug}%`),
          ),
        )
      const slugs = new Set(slugRows.map((row) => row.slug))
      let slug = sandbox.slug
      for (let suffix = 2; slugs.has(slug); suffix += 1) slug = `${sandbox.slug}-${String(suffix)}`

      const [createdForm] = await tx
        .insert(forms)
        .values({
          id: sandbox.id,
          organizationId: scope.organizationId,
          projectId: project.id,
          slug,
          name: sandbox.name,
          settings:
            sandbox.allowedOrigin === null ? {} : { allowed_origins: [sandbox.allowedOrigin] },
        })
        .returning()
      if (createdForm === undefined) throw new Error("Failed to create claimed Form.")

      const anonymousRows = await tx
        .select()
        .from(anonymousSubmissions)
        .where(eq(anonymousSubmissions.sandboxId, sandbox.id))
      if (anonymousRows.length > 0) {
        await tx.insert(submissions).values(
          anonymousRows.map((row) => ({
            id: row.id,
            organizationId: scope.organizationId,
            formId: createdForm.id,
            data: row.data,
            status: "received",
            meta: { ...row.meta, anonymous_sandbox: true },
            test: true,
            receivedAt: row.receivedAt,
          })),
        )
      }
      await tx.insert(events).values({
        id: newId("ev"),
        organizationId: scope.organizationId,
        type: "form.created",
        subject: { form_id: createdForm.id },
        data: { slug: createdForm.slug, claimed_from_sandbox: true },
      })
      await tx
        .update(anonymousSandboxes)
        .set({
          status: "claimed",
          claimedOrganizationId: scope.organizationId,
          claimedUserId: claimantUserId,
          claimedAt: new Date(),
          tokenReplayEncrypted: null,
        })
        .where(eq(anonymousSandboxes.id, sandbox.id))

      return { form: createdForm, copiedCount: anonymousRows.length, idempotent: false }
    })

    c.header("Cache-Control", "no-store")
    return c.json(
      {
        claimed: true as const,
        idempotent: result.idempotent,
        form: {
          id: result.form.id,
          project_id: result.form.projectId,
          slug: result.form.slug,
          name: result.form.name,
          submit_url: `${env.APP_URL}/s/${result.form.id}`,
        },
        copied_test_submissions: result.copiedCount,
        next: nextAfterClaim(result.form.id),
      },
      200,
    )
  })
}
