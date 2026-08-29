import { newId } from "@postbag/core"
import { eq } from "drizzle-orm"
import {
  createDb,
  member,
  organization,
  organizationSettings,
  projects,
  user,
  type Database,
  type DatabaseClient,
} from "@postbag/db"
import type { OpenAPIHono } from "@hono/zod-openapi"

import { createApp, type AppDeps } from "./app.js"
import { buildAuth, type Auth, type BuildAuthOverrides } from "./authSetup.js"
import { createDestinationRegistry } from "./destinations/registry.js"
import type { Env } from "./env.js"
import { createLogger, type Logger } from "./logger.js"
import type { AppEnv } from "./lib/scope.js"
import type { AnyDestinationAdapter } from "./destinations/types.js"
import type { BillingProvider } from "./lib/billingProvider.js"
import type { ObjectStorage } from "./lib/objectStorage.js"

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
    ANONYMOUS_QUICKSTART_ENABLED: false,
    ANONYMOUS_SANDBOX_GLOBAL_LIMIT: 1000,
    POLAR_SERVER: "sandbox",
    POLAR_ACCESS_TOKEN: "polar_test",
    STORAGE_REGION: "auto",
    STORAGE_FORCE_PATH_STYLE: false,
    LEGACY_HOSTS: [],
    PLATFORM_ADMIN_EMAILS: [],
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

export function buildHarness(
  envOverrides: Partial<Env> = {},
  authOverrides: BuildAuthOverrides = {},
  billing?: BillingProvider | null,
  storage?: ObjectStorage | null,
): TestHarness {
  const env = testEnv(envOverrides)
  const client = createDb(env.DATABASE_URL)
  const logger = createLogger(env)
  const auth = buildAuth(client.db, env, authOverrides)
  const destinations = createDestinationRegistry(env)
  const deps: AppDeps = {
    db: client.db,
    env,
    logger,
    auth,
    destinations,
    ...(billing === undefined ? {} : { billing }),
    ...(storage === undefined ? {} : { storage }),
  }
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
  await db
    .insert(organizationSettings)
    .values({ organizationId, plan: "free", timezone: "UTC", limits: {} })
  const projectId = newId("prj")
  await db
    .insert(projects)
    .values({ id: projectId, organizationId, slug: "default", name: "Default", tags: [] })
  const userId = newId("usr")
  await db
    .insert(user)
    .values({ id: userId, name, email: `${userId}@example.test`, emailVerified: true })
  await db
    .insert(member)
    .values({ id: globalThis.crypto.randomUUID(), organizationId, userId, role: "owner" })
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

export type SeededUser = {
  readonly userId: string
  readonly email: string
  readonly cookie: string
}

/** Signs a brand-new user up through the real HTTP flow (so `provisionPersonalOrganization`
 * runs exactly as it does in production) and returns a session cookie for it. Used by job L's
 * role-matrix tests to get a real signed-in actor of a given role in a *shared* test org —
 * callers then add a `member` row for that org/role directly (see `addMember`) and, if the
 * test needs `scope.organizationId` to resolve to that org, call `setActiveOrganization`. */
export async function signUpTestUser(
  app: OpenAPIHono<AppEnv>,
  name = "Test User",
): Promise<SeededUser> {
  const email = `${newId("usr")}@example.test`
  const res = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery staple", name }),
  })
  if (res.status >= 400)
    throw new Error(`Test sign-up failed with status ${String(res.status)}: ${await res.text()}`)
  const setCookie = res.headers.get("set-cookie")
  const cookie = setCookie?.split(";")[0]
  if (cookie === undefined) throw new Error("Test sign-up did not return a session cookie.")
  const body = (await res.json()) as { readonly user?: { readonly id?: string } }
  const userId = body.user?.id
  if (userId === undefined) throw new Error("Test sign-up response had no user id.")
  return { userId, email, cookie }
}

/** Adds a Membership row directly (bypassing the invitation flow — this is test scaffolding,
 * not something a real user path does) and returns the new member id. */
export async function addMember(
  db: Database,
  organizationId: string,
  userId: string,
  role: "owner" | "admin" | "member",
): Promise<string> {
  const id = globalThis.crypto.randomUUID()
  await db.insert(member).values({ id, organizationId, userId, role })
  return id
}

/** Makes `organizationId` the active organization for a signed-in test session (the user
 * must already have a `member` row there — see `addMember`) so `requireOrg` resolves
 * `scope.organizationId` to it on every subsequent request with this cookie. */
export async function setActiveOrganizationForTest(
  auth: Auth,
  cookie: string,
  organizationId: string,
): Promise<void> {
  await auth.api.setActiveOrganization({
    headers: new Headers({ cookie }),
    body: { organizationId },
  })
}
