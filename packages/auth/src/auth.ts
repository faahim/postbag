import { apiKey } from "@better-auth/api-key"
import { newId } from "@postbag/core"
import type { Database } from "@postbag/db"
import * as schema from "@postbag/db/schema"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { organization } from "better-auth/plugins"

export type CreatedAuthUser = {
  readonly id: string
  readonly name: string
  readonly email: string
}

export type SocialProviderConfig = {
  readonly clientId: string
  readonly clientSecret: string
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
    emailAndPassword: { enabled: true },
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
