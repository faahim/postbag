import { createAuth, type CreateAuthOptions } from "@postbag/auth"
import type { Database } from "@postbag/db"

import type { Env } from "./env.js"
import { createOtpEmailSender, withFailureTracking } from "./lib/otpEmail.js"
import { provisionPersonalOrganization } from "./provisioning.js"

export type Auth = ReturnType<typeof createAuth>

export function isHostedInstance(env: Pick<Env, "APP_URL">): boolean {
  const hostname = new URL(env.APP_URL).hostname.toLowerCase()
  return hostname === "postbag.dev" || hostname === "api.postbag.dev"
}

/** Google enabled iff both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set, same for
 * GitHub (env.ts rejects a half-configured pair at boot) — self-host parity: an operator
 * who sets neither gets an instance with no social providers, nothing else changes. */
function socialProvidersFrom(env: Env): CreateAuthOptions["socialProviders"] {
  const google =
    env.GOOGLE_CLIENT_ID !== undefined && env.GOOGLE_CLIENT_SECRET !== undefined
      ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
      : undefined
  const github =
    env.GITHUB_CLIENT_ID !== undefined && env.GITHUB_CLIENT_SECRET !== undefined
      ? { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
      : undefined
  if (google === undefined && github === undefined) return undefined
  return {
    ...(google !== undefined ? { google } : {}),
    ...(github !== undefined ? { github } : {}),
  }
}

export type BuildAuthOverrides = {
  /** Job H 1a test seam: production wires the real Resend-backed sender (from
   * `RESEND_API_KEY`/`MAIL_FROM`); tests inject a capturing stub instead so no network call
   * happens and the OTP can be read back. Leave unset to get the production behaviour
   * (including "undefined when RESEND_API_KEY is unset", which is what makes `POST
   * /v1/auth/request-code` return `501 email_not_configured`). */
  readonly sendEmailOTP?: CreateAuthOptions["sendEmailOTP"]
}

export function buildAuth(db: Database, env: Env, overrides: BuildAuthOverrides = {}): Auth {
  return createAuth({
    db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
    // The built SPA is same-origin with the API in every real deployment (apps/server
    // serves apps/web/dist under /app). Only the Vite dev server runs on a different
    // origin (5173) while proxying /api, /v1 and /s back to this server — trust it so
    // Better Auth's origin check doesn't reject the proxied requests in development.
    trustedOrigins:
      env.NODE_ENV === "development" ? [env.APP_URL, "http://localhost:5173"] : [env.APP_URL],
    onUserCreated: (user) =>
      provisionPersonalOrganization(db, user, env.POLAR_ACCESS_TOKEN === undefined),
    socialProviders: socialProvidersFrom(env),
    disableEmailPasswordSignUp: isHostedInstance(env),
    sendEmailOTP: trackOtpSender(
      overrides.sendEmailOTP ??
        createOtpEmailSender(
          env.RESEND_API_KEY === undefined
            ? undefined
            : { resendApiKey: env.RESEND_API_KEY, mailFrom: env.MAIL_FROM },
        ),
    ),
  })
}

function trackOtpSender(
  sender: CreateAuthOptions["sendEmailOTP"],
): CreateAuthOptions["sendEmailOTP"] {
  return sender === undefined ? undefined : withFailureTracking(sender)
}
