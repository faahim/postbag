import { apiKey } from "@better-auth/api-key"
import { newId } from "@postbag/core"
import type { Database } from "@postbag/db"
import * as schema from "@postbag/db/schema"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { organization } from "better-auth/plugins"

export type CreateAuthOptions = {
  readonly db: Database
  readonly secret: string
  readonly baseURL: string
  readonly trustedOrigins: readonly string[]
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
