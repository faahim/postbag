import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { PostbagError } from "@postbag/core"
import { and, eq } from "drizzle-orm"
import { apikey, type Database } from "@postbag/db"

import type { Auth } from "../../authSetup.js"
import { requireRole } from "../../lib/orgs.js"
import { assertScope, assertSessionActor } from "../../lib/scope.js"
import type { AppEnv } from "../../lib/scope.js"
import { errorResponses, ScopeSchema } from "../../schemas.js"

export type MintedApiKey = {
  readonly id: string
  readonly name: string | null
  readonly prefix: string | null
  readonly key: string
  readonly createdAt: Date
}

export type MintApiKeyInput = {
  readonly organizationId: string
  readonly name?: string | undefined
  readonly scopes: readonly ("manage" | "read" | "submit")[]
  /** Session request headers, when minting from a signed-in dashboard session (POST
   * /v1/api-keys). Omit when minting on behalf of an explicit `userId` instead (job H's
   * POST /v1/auth/verify-code, which has no session) — better-auth's `createApiKey`
   * accepts either. */
  readonly headers?: Headers | undefined
  readonly userId?: string | undefined
}

/**
 * The exact key-minting call `POST /v1/api-keys` uses, extracted (job H 1b) so `POST
 * /v1/auth/verify-code` mints through the identical path instead of a second
 * implementation that could drift from it.
 */
export async function mintApiKey(auth: Auth, input: MintApiKeyInput): Promise<MintedApiKey> {
  const created = await auth.api.createApiKey({
    ...(input.headers === undefined ? {} : { headers: input.headers }),
    body: {
      configId: "postbag",
      name: input.name,
      organizationId: input.organizationId,
      ...(input.userId === undefined ? {} : { userId: input.userId }),
      metadata: {
        scopes: input.scopes,
        ...(input.userId === undefined ? {} : { created_by_user_id: input.userId }),
      },
    },
  })
  return created as unknown as MintedApiKey
}

export const ApiKeyNameSchema = z
  .string()
  .min(1)
  .max(32)
  .describe("A label to tell keys apart, e.g. 'CI deploy key'. Maximum 32 characters.")

const ApiKeyCreateInputSchema = z.object({
  name: ApiKeyNameSchema.optional(),
  scopes: z
    .array(ScopeSchema)
    .min(1)
    .default(["manage"])
    .describe(
      "manage ⊇ read ⊇ submit — a manage key satisfies every read- or submit-scoped call too.",
    ),
})

const ApiKeyCreatedSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  prefix: z.string().nullable(),
  scopes: z.array(ScopeSchema),
  key: z.string(),
  created_at: z.string(),
})

const ApiKeySummarySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  prefix: z.string().nullable(),
  scopes: z.array(ScopeSchema),
  enabled: z.boolean(),
  created_at: z.string(),
})

const createApiKeyRoute = createRoute({
  method: "post",
  path: "/v1/api-keys",
  operationId: "api_keys_create",
  tags: ["discovery"],
  summary: "Create an API key for the active organization (session only, owner/admin)",
  description:
    "Requires a signed-in dashboard session, not another API key — an agent cannot mint its own first " +
    "key this way. Owner or admin (job L). The full key is only ever returned once, in this response; " +
    "store it immediately.",
  request: { body: { content: { "application/json": { schema: ApiKeyCreateInputSchema } } } },
  responses: {
    201: {
      description: "created",
      content: { "application/json": { schema: ApiKeyCreatedSchema } },
    },
    ...errorResponses,
  },
})

const listApiKeysRoute = createRoute({
  method: "get",
  path: "/v1/api-keys",
  operationId: "api_keys_list",
  tags: ["discovery"],
  summary: "List API keys for the active organization",
  description: "Prefixes only — full key values are never returned again after creation.",
  responses: {
    200: {
      description: "ok",
      content: { "application/json": { schema: z.array(ApiKeySummarySchema) } },
    },
  },
})

const deleteApiKeyRoute = createRoute({
  method: "delete",
  path: "/v1/api-keys/{id}",
  operationId: "api_keys_revoke",
  tags: ["discovery"],
  summary: "Delete an API key",
  description: "Revokes the key immediately; any client still using it starts getting 401s.",
  request: {
    params: z.object({ id: z.string().describe("The API key id (not the key value itself).") }),
  },
  responses: { 204: { description: "deleted" }, ...errorResponses },
})

export function registerApiKeyRoutes(app: OpenAPIHono<AppEnv>, auth: Auth, db: Database): void {
  app.openapi(createApiKeyRoute, async (c) => {
    const scope = c.var.scope
    assertSessionActor(scope, "Create API keys from a signed-in session, not another API key.")
    await requireRole(db, scope, ["owner", "admin"])
    const body = c.req.valid("json")

    const createdRecord = await mintApiKey(auth, {
      organizationId: scope.organizationId,
      name: body.name,
      scopes: body.scopes,
      headers: c.req.raw.headers,
    })

    return c.json(
      {
        id: createdRecord.id,
        name: createdRecord.name,
        prefix: createdRecord.prefix,
        scopes: body.scopes,
        key: createdRecord.key,
        created_at: createdRecord.createdAt.toISOString(),
      },
      201,
    )
  })

  app.openapi(listApiKeysRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    await requireRole(db, scope, ["owner", "admin"])
    const rows = await db
      .select()
      .from(apikey)
      .where(and(eq(apikey.referenceId, scope.organizationId), eq(apikey.configId, "postbag")))
    return c.json(
      rows.map((row) => {
        const metadata =
          row.metadata === null ? {} : (JSON.parse(row.metadata) as { scopes?: unknown })
        const scopes = Array.isArray(metadata.scopes)
          ? metadata.scopes.filter(
              (value): value is "manage" | "read" | "submit" =>
                value === "manage" || value === "read" || value === "submit",
            )
          : []
        return {
          id: row.id,
          name: row.name,
          prefix: row.prefix,
          scopes,
          enabled: row.enabled,
          created_at: row.createdAt.toISOString(),
        }
      }),
    )
  })

  app.openapi(deleteApiKeyRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    await requireRole(db, scope, ["owner", "admin"])
    const { id } = c.req.valid("param")
    const [row] = await db
      .select({ id: apikey.id })
      .from(apikey)
      .where(and(eq(apikey.id, id), eq(apikey.referenceId, scope.organizationId)))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No API key with that id.")
    // Delete directly: better-auth's deleteApiKey endpoint gates on a browser session,
    // which does not exist for a bearer-key caller; ownership is already org-scoped above.
    await db
      .delete(apikey)
      .where(and(eq(apikey.id, id), eq(apikey.referenceId, scope.organizationId)))
    return c.body(null, 204)
  })
}
