import { newId } from "@postbag/core"
import { eq } from "drizzle-orm"
import { createDb, member, organization, organizationSettings, projects, user, type Database, type DatabaseClient } from "@postbag/db"
import type { OpenAPIHono } from "@hono/zod-openapi"

import { createApp, type AppDeps } from "./app.js"
import { buildAuth, type Auth } from "./authSetup.js"
import { createDestinationRegistry } from "./destinations/registry.js"
import type { Env } from "./env.js"
import { createLogger, type Logger } from "./logger.js"
import type { AppEnv } from "./lib/scope.js"
import type { AnyDestinationAdapter } from "./destinations/types.js"

export const TEST_DATABASE_URL = process.env["DATABASE_URL"]

export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    DATABASE_URL: TEST_DATABASE_URL ?? "postgres://postbag:postbag@localhost:5433/postbag",
    NODE_ENV: "test",
    PORT: 3000,
    APP_URL: "http://localhost:3000",
    BETTER_AUTH_SECRET: "devsecretdevsecretdevsecret1234",
    POSTBAG_ROLE: "all",
    TZ: "UTC",
    MAIL_FROM: "Postbag <postbag@updates.withfaahim.com>",
    MIGRATE_ON_BOOT: false,
    RLS_ENFORCED: false,
    LEGACY_HOSTS: [],
    ...overrides,
  }
}

export type TestHarness = {
  readonly app: OpenAPIHono<AppEnv>
  readonly db: Database
  readonly client: DatabaseClient
  readonly auth: Auth
  readonly env: Env
  readonly logger: Logger
  readonly destinations: ReadonlyMap<string, AnyDestinationAdapter>
  close(): Promise<void>
}

export function buildHarness(envOverrides: Partial<Env> = {}): TestHarness {
  const env = testEnv(envOverrides)
  const client = createDb(env.DATABASE_URL)
  const logger = createLogger(env)
  const auth = buildAuth(client.db, env)
  const destinations = createDestinationRegistry(env)
  const deps: AppDeps = { db: client.db, env, logger, auth, destinations }
  const app = createApp(deps)
  return {
    app,
    db: client.db,
    client,
    auth,
    env,
    logger,
    destinations,
    close: () => client.close(),
  }
}

export type SeededOrg = {
  readonly organizationId: string
  readonly projectId: string
  readonly userId: string
}

/** Also creates an owning user + membership: better-auth's api-key plugin (configured with
 * `references: "organization"`) checks the caller is a member of the org, which requires a
 * real user even when minting a key with an explicit `userId` (no session/headers needed). */
export async function seedOrganization(db: Database, name = "Test Org"): Promise<SeededOrg> {
  const organizationId = newId("org")
  await db.insert(organization).values({ id: organizationId, name, slug: organizationId })
  await db.insert(organizationSettings).values({ organizationId, plan: "free", timezone: "UTC", limits: {} })
  const projectId = newId("prj")
  await db.insert(projects).values({ id: projectId, organizationId, slug: "default", name: "Default", tags: [] })
  const userId = newId("usr")
  await db.insert(user).values({ id: userId, name, email: `${userId}@example.test`, emailVerified: true })
  await db.insert(member).values({ id: globalThis.crypto.randomUUID(), organizationId, userId, role: "owner" })
  return { organizationId, projectId, userId }
}

export async function createTestApiKey(
  auth: Auth,
  organizationId: string,
  userId: string,
  scopes: readonly ("manage" | "read" | "submit")[] = ["manage", "read", "submit"],
): Promise<string> {
  const created = await auth.api.createApiKey({
    body: { configId: "postbag", name: "test key", organizationId, userId, metadata: { scopes } },
  })
  const record = created as unknown as { readonly key: string }
  return record.key
}

export async function cleanupOrganization(db: Database, organizationId: string): Promise<void> {
  await db.delete(organization).where(eq(organization.id, organizationId))
}
