import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { APIError } from "better-auth/api"
import { asc, eq, and } from "drizzle-orm"
import { member, organization, user, type Database } from "@postbag/db"

import type { Auth } from "../../authSetup.js"
import { clientIp } from "../../lib/clientIp.js"
import { envelope } from "../../lib/errors.js"
import type { TokenBucketLimiter } from "../../lib/rateLimit.js"
import type { AppEnv } from "../../lib/scope.js"
import type { Env } from "../../env.js"
import { ErrorEnvelopeSchema, ScopeSchema } from "../../schemas.js"
import { mintApiKey } from "./apiKeys.js"

// Job H 1b: agent onboarding without a browser. An agent holding no credentials at all asks
// for a code by email, a human reads six digits out of their inbox, the agent gets a manage
// key back — no dashboard, no OAuth round trip. Public (security: []), registered before
// requireOrg like /v1/auth/providers and the submit path.

const RequestCodeInputSchema = z.object({
  email: z.email().describe("Lowercased and trimmed before use. Always 200s for a well-formed address."),
})

const RequestCodeResponseSchema = z.object({
  ok: z.literal(true),
  expires_in: z.number().int(),
  next: z.string(),
})

const VerifyCodeInputSchema = z.object({
  email: z.email(),
  code: z.string().describe("The 6-digit code from the email."),
  key_name: z.string().optional().describe('Defaults to "agent · <YYYY-MM-DD>".'),
  scopes: z.array(ScopeSchema).min(1).default(["manage"]),
})

const VerifyCodeResponseSchema = z.object({
  api_key: z.string().describe("Shown once — store it immediately."),
  key_id: z.string(),
  scopes: z.array(ScopeSchema),
  organization: z.object({ id: z.string(), slug: z.string(), name: z.string() }),
  user: z.object({ email: z.string(), created: z.boolean() }),
  next: z.array(z.string()),
})

const requestCodeRoute = createRoute({
  method: "post",
  path: "/v1/auth/request-code",
  operationId: "auth_request_code",
  tags: ["discovery"],
  summary: "Email a 6-digit sign-in code (step 1 of agent onboarding without a browser)",
  description:
    "Public, unauthenticated. Sends a 6-digit code good for 10 minutes to the given address. Always " +
    "200 for a well-formed email, whether or not an account exists — this endpoint never confirms or " +
    "denies an account's existence. Rate limited per email and per client IP. The human reads the " +
    "code out of their inbox and gives it to the agent, which calls POST /v1/auth/verify-code next.",
  security: [],
  request: { body: { content: { "application/json": { schema: RequestCodeInputSchema } } } },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: RequestCodeResponseSchema } } },
    429: { description: "Rate limited", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
    501: {
      description: "Email sending is not configured on this server",
      content: { "application/json": { schema: ErrorEnvelopeSchema } },
    },
  },
})

const verifyCodeRoute = createRoute({
  method: "post",
  path: "/v1/auth/verify-code",
  operationId: "auth_verify_code",
  tags: ["discovery"],
  summary: "Verify a code and mint an API key (step 2 of agent onboarding without a browser)",
  description:
    "Public, unauthenticated. Verifies the code sent by POST /v1/auth/request-code and, on success, " +
    "mints an API key through the same path POST /v1/api-keys uses — default scope manage. A new " +
    "email provisions a personal organization first, exactly like every other sign-up path. An " +
    "existing user's key is minted against their personal organization (the one they own, oldest " +
    "first, if they belong to several). This does not set a session cookie — it mints a key, it does " +
    "not log a browser in.",
  security: [],
  request: { body: { content: { "application/json": { schema: VerifyCodeInputSchema } } } },
  responses: {
    201: { description: "created", content: { "application/json": { schema: VerifyCodeResponseSchema } } },
    401: {
      description: "Invalid or expired code",
      content: { "application/json": { schema: ErrorEnvelopeSchema } },
    },
  },
})

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** The personal organization provisioning created: the one the user owns, oldest first. */
async function resolveOwnedOrganization(
  db: Database,
  userId: string,
): Promise<{ readonly id: string; readonly slug: string; readonly name: string } | undefined> {
  const [row] = await db
    .select({ id: organization.id, slug: organization.slug, name: organization.name })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(and(eq(member.userId, userId), eq(member.role, "owner")))
    .orderBy(asc(member.createdAt))
    .limit(1)
  return row
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

function isEmailOtpApiError(error: unknown, ...codes: readonly string[]): boolean {
  if (!(error instanceof APIError)) return false
  const code = (error.body as { readonly code?: string } | null)?.code
  return code !== undefined && codes.includes(code)
}

export function registerAuthCodeRoutes(
  app: OpenAPIHono<AppEnv>,
  auth: Auth,
  db: Database,
  env: Env,
  rateLimiter: TokenBucketLimiter,
): void {
  app.openapi(requestCodeRoute, async (c) => {
    const { email: rawEmail } = c.req.valid("json")
    const email = normalizeEmail(rawEmail)

    // 3 per email per 10 minutes, 10 per client IP per 10 minutes — same TokenBucketLimiter
    // as the submit path, just a different bucket namespace (`consume`'s rate is per-minute;
    // 10 minutes of budget spent as `burst / 10` per minute).
    const emailOk = rateLimiter.consume(`otp-email:${email}`, 3 / 10, 3)
    const ipOk = rateLimiter.consume(`otp-ip:${clientIp(c)}`, 10 / 10, 10)
    if (!emailOk || !ipOk) {
      return c.json(
        envelope("rate_limited", "Too many code requests. Wait a few minutes and try again.", {
          hint: "3 requests per email and 10 per IP are allowed every 10 minutes.",
        }),
        429,
      )
    }

    if (env.RESEND_API_KEY === undefined) {
      return c.json(
        envelope("email_not_configured", "Email sending is not configured on this server.", {
          hint: `Set RESEND_API_KEY and MAIL_FROM on the server, or create a key in the dashboard at ${env.APP_URL}/app/settings/api-keys`,
        }),
        501,
      )
    }

    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } })

    return c.json(
      {
        ok: true as const,
        expires_in: 600,
        next: "POST /v1/auth/verify-code with { email, code, key_name }",
      },
      200,
    )
  })

  app.openapi(verifyCodeRoute, async (c) => {
    const body = c.req.valid("json")
    const email = normalizeEmail(body.email)
    const scopes = body.scopes
    const keyName = body.key_name ?? `agent · ${todayStamp()}`

    const [existingUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)

    let signInResult: { readonly user: { readonly id: string; readonly email: string } }
    try {
      const result = await auth.api.signInEmailOTP({ body: { email, otp: body.code } })
      signInResult = result as unknown as typeof signInResult
    } catch (error) {
      if (isEmailOtpApiError(error, "INVALID_OTP", "OTP_EXPIRED", "TOO_MANY_ATTEMPTS")) {
        return c.json(
          envelope("invalid_code", "That code is wrong or has expired.", {
            hint: "Codes allow 3 attempts and expire after 10 minutes — request a new one with POST /v1/auth/request-code.",
          }),
          401,
        )
      }
      throw error
    }

    const wasCreated = existingUser === undefined
    const org = await resolveOwnedOrganization(db, signInResult.user.id)
    if (org === undefined) {
      // provisionPersonalOrganization runs synchronously in databaseHooks.user.create.after
      // (job G), so this should be unreachable for a genuinely new user; a defensive 500
      // beats silently minting a key with no organization to scope it to.
      throw new Error(`No owned organization found for user ${signInResult.user.id} after sign-in.`)
    }

    const minted = await mintApiKey(auth, {
      organizationId: org.id,
      name: keyName,
      scopes,
      userId: signInResult.user.id,
    })

    return c.json(
      {
        api_key: minted.key,
        key_id: minted.id,
        scopes,
        organization: org,
        user: { email, created: wasCreated },
        next: [
          "Store api_key in ~/.config/postbag/credentials.json (mode 0600) or POSTBAG_API_KEY",
          "POST /v1/quickstart to create a routed form in one call",
          "GET /v1/me to see limits and what exists",
        ],
      },
      201,
    )
  })
}
