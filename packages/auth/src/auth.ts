import { apiKey } from "@better-auth/api-key"
import { newId } from "@postbag/core"
import type { Database } from "@postbag/db"
import * as schema from "@postbag/db/schema"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { emailOTP, organization } from "better-auth/plugins"

export type CreatedAuthUser = {
  readonly id: string
  readonly name: string
  readonly email: string
}

export type SocialProviderConfig = {
  readonly clientId: string
  readonly clientSecret: string
}

export type SendEmailOTPInput = {
  readonly email: string
  readonly otp: string
  readonly type: "sign-in" | "email-verification" | "forget-password" | "change-email"
}

/**
 * Thrown by the wrapped `sendVerificationOTP` function (see `buildSendVerificationOTP`)
 * when no `sendEmailOTP` caller was configured. Job H 1a: the emailOTP plugin is always
 * registered (self-host parity — an operator who hasn't set RESEND_API_KEY yet still gets
 * a working instance, just not this one flow), but sending must fail loudly.
 *
 * Note for callers: better-auth's own `/email-otp/send-verification-otp` endpoint invokes
 * `sendVerificationOTP` through `ctx.context.runInBackgroundOrAwait`, which *awaits* the
 * promise but swallows any rejection (logs it, does not rethrow) unless a custom
 * `advanced.backgroundTasks.handler` is configured — which we don't. That means this error
 * never reaches an HTTP caller of `auth.api.sendVerificationOTP` directly. The server route
 * (`apps/server/src/routes/v1/authCodes.ts`) therefore checks its own email configuration
 * *before* calling into Better Auth at all; this class exists so the wiring itself is
 * still correct and unit-testable in isolation (see `buildSendVerificationOTP`).
 */
export class EmailOtpNotConfiguredError extends Error {
  constructor() {
    super(
      "Email sending is not configured on this server: no sendEmailOTP was supplied to createAuth().",
    )
    this.name = "EmailOtpNotConfiguredError"
  }
}

/**
 * The function handed to the `emailOTP` plugin's `sendVerificationOTP` option. Pulled out
 * as its own export so it can be unit-tested without going through Better Auth's endpoint
 * machinery (which swallows rejections — see `EmailOtpNotConfiguredError`).
 */
export function buildSendVerificationOTP(
  options: Pick<CreateAuthOptions, "sendEmailOTP">,
): (input: SendEmailOTPInput) => Promise<void> {
  return async (input) => {
    if (options.sendEmailOTP === undefined) throw new EmailOtpNotConfiguredError()
    await options.sendEmailOTP(input)
  }
}

export type CreateAuthOptions = {
  readonly db: Database
  readonly secret: string
  readonly baseURL: string
  readonly trustedOrigins: readonly string[]
  /**
   * Called after Better Auth persists a new user row (database hook). The server app
   * uses this to provision the user's personal organization, membership, settings and
   * default project — kept out of this package so it stays a thin auth config.
   */
  readonly onUserCreated?: (user: CreatedAuthUser) => Promise<void>
  /**
   * Google/GitHub OAuth. Self-host parity (Principle 7): both are optional and every
   * provider omitted here is simply absent from Better Auth's `socialProviders` — the
   * server decides which are enabled from env (a provider is on iff both its client id and
   * secret are set; see apps/server/src/env.ts and authSetup.ts).
   */
  readonly socialProviders?:
    | {
        readonly google?: SocialProviderConfig
        readonly github?: SocialProviderConfig
      }
    | undefined
  /**
   * Job H 1a: sends a 6-digit sign-in code by email (Better Auth's `emailOTP` plugin).
   * Optional for the same self-host-parity reason `socialProviders` is: the plugin is
   * always registered so `POST /email-otp/send-verification-otp` and `POST
   * /sign-in/email-otp` always exist, but when this is absent, sending throws
   * `EmailOtpNotConfiguredError` — see that class for why the server checks its own
   * config before calling in, rather than relying on that error reaching it.
   */
  readonly sendEmailOTP?: ((input: SendEmailOTPInput) => Promise<void>) | undefined
  /** Hosted Postbag disables new password registration server-side while preserving
   * password sign-in for existing accounts. Self-hosted instances keep it by default. */
  readonly disableEmailPasswordSignUp?: boolean | undefined
}

function authRecordId(model: string): string {
  switch (model.toLowerCase()) {
    case "user":
    case "users":
      return newId("usr")
    case "organization":
    case "organizations":
      return newId("org")
    case "apikey":
    case "apikeys":
      return newId("key")
    default:
      return globalThis.crypto.randomUUID()
  }
}

export function createAuth(options: CreateAuthOptions) {
  return betterAuth({
    appName: "Postbag",
    database: drizzleAdapter(options.db, { provider: "pg", schema }),
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: [...options.trustedOrigins],
    emailAndPassword: {
      enabled: true,
      disableSignUp: options.disableEmailPasswordSignUp ?? false,
    },
    socialProviders: options.socialProviders,
    account: {
      accountLinking: {
        // Better Auth defaults (kept deliberately): a social sign-in auto-links to an
        // existing same-email user only when the provider asserts the email is verified
        // (Google and GitHub-primary both do) AND the local account's email is verified.
        // Do NOT add `trustedProviders` or `requireLocalEmailVerified: false` to make
        // never-verified password accounts link: an attacker who pre-registers the
        // victim's email with a password would then receive the victim's Google/GitHub
        // session. Password sign-ups get verification emails so they become linkable
        // (PROGRESS.md 2f); until then the UI tells them to sign in with the password and
        // connect the provider from Settings (an authenticated `linkSocial`, which is safe).
        enabled: true,
      },
    },
    session: {
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    advanced: {
      cookiePrefix: "postbag",
      useSecureCookies: options.baseURL.startsWith("https://"),
      database: {
        generateId: ({ model }) => authRecordId(model),
      },
    },
    databaseHooks:
      options.onUserCreated === undefined
        ? undefined
        : {
            user: {
              create: {
                after: async (user) => {
                  await options.onUserCreated?.({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                  })
                },
              },
            },
          },
    plugins: [
      organization(),
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 3,
        storeOTP: "hashed",
        disableSignUp: false,
        sendVerificationOTP: buildSendVerificationOTP(options),
      }),
      apiKey([
        {
          configId: "postbag",
          references: "organization",
          defaultPrefix: "pb_live_",
          enableMetadata: true,
          rateLimit: { enabled: false },
          enableSessionForAPIKeys: false,
        },
      ]),
    ],
  })
}
