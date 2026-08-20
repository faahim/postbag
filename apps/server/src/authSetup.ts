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
    trustedOrigins: [env.APP_URL],
    onUserCreated: (user) => provisionPersonalOrganization(db, user),
  })
}
