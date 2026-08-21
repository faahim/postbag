import { createAuth } from "@postbag/auth"
import type { Database } from "@postbag/db"

import type { Env } from "./env.js"
import { provisionPersonalOrganization } from "./provisioning.js"

export type Auth = ReturnType<typeof createAuth>

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
  })
}
