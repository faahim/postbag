import { createAuth, type CreateAuthOptions } from "@postbag/auth"
import type { Database } from "@postbag/db"

import type { Env } from "./env.js"
import { provisionPersonalOrganization } from "./provisioning.js"

export type Auth = ReturnType<typeof createAuth>

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

export function buildAuth(db: Database, env: Env): Auth {
  return createAuth({
    db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
    // The built SPA is same-origin with the API in every real deployment (apps/server
    // serves apps/web/dist under /app). Only the Vite dev server runs on a different
    // origin (5173) while proxying /api, /v1 and /s back to this server — trust it so
    // Better Auth's origin check doesn't reject the proxied requests in development.
    trustedOrigins: env.NODE_ENV === "development" ? [env.APP_URL, "http://localhost:5173"] : [env.APP_URL],
    onUserCreated: (user) => provisionPersonalOrganization(db, user),
    socialProviders: socialProvidersFrom(env),
  })
}
