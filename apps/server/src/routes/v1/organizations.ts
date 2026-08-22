import { createRoute, type OpenAPIHono, type z } from "@hono/zod-openapi"
import { APIError } from "better-auth/api"
import { eq } from "drizzle-orm"
import { organization, organizationSettings, projects, type Database } from "@postbag/db"
import { newId, PostbagError } from "@postbag/core"

import type { Auth } from "../../authSetup.js"
import type { Env } from "../../env.js"
import { forwardAuthCookies } from "../../lib/authCookies.js"
import { assertSessionActor, type AppEnv } from "../../lib/scope.js"
import {
  CreateOrganizationInputSchema,
  errorResponses,
  OrganizationSummarySchema,
  SetActiveOrganizationInputSchema,
  SetActiveOrganizationResponseSchema,
} from "../../schemas.js"

// Job L §1/§3 — active-organization switching and creating a new organization from the
// dashboard's org switcher. Both are session-only: an API key is bound to one
// organization for its whole life (schema/auth.ts's `apikey` table has no notion of
// "switching"), so neither concept applies to a key.

const setActiveOrganizationRoute = createRoute({
  method: "post",
  path: "/v1/me/active-organization",
  operationId: "me_set_active_organization",
  tags: ["discovery"],
  summary: "Switch the signed-in session's active organization",
  description:
    "Session only — an API key already resolves to exactly one organization and cannot switch. " +
    "The caller must already be a member of the target organization (403 forbidden otherwise). " +
    "Every subsequent /v1 call on this session scopes to the new organization.",
  request: { body: { content: { "application/json": { schema: SetActiveOrganizationInputSchema } } } },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: SetActiveOrganizationResponseSchema } } },
    ...errorResponses,
  },
})

const createOrganizationRoute = createRoute({
  method: "post",
  path: "/v1/organizations",
  operationId: "organizations_create",
  tags: ["discovery"],
  summary: "Create a new organization and switch to it (session only)",
  description:
    "Session only. Creates the organization (the caller becomes its owner), the same default " +
    "settings + 'Default' project every signup gets, then makes it this session's active organization.",
  request: { body: { content: { "application/json": { schema: CreateOrganizationInputSchema } } } },
  responses: {
    201: { description: "created", content: { "application/json": { schema: OrganizationSummarySchema } } },
    ...errorResponses,
  },
})

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "")
  return base.length === 0 ? "workspace" : base.slice(0, 40)
}

type SetActiveOrganizationWithHeaders = (input: {
  readonly headers: Headers
  readonly body: { readonly organizationId: string }
  readonly returnHeaders: true
}) => Promise<{ readonly headers: Headers; readonly response: unknown }>

/** `auth.api.setActiveOrganization`, called with `returnHeaders: true` so its `Set-Cookie`
 * (the session cookie cache refresh) forwards onto our own response — see
 * `lib/authCookies.ts`. Shared by every route in this file and by `invitations.ts`'s accept
 * handler, all of which need the caller's active organization to change immediately, not
 * after Better Auth's 5-minute cookie cache expires on its own. */
export async function setActiveOrganizationWithCookies(
  c: Parameters<typeof forwardAuthCookies>[0],
  auth: Auth,
  headers: Headers,
  organizationId: string,
): Promise<void> {
  const call = auth.api.setActiveOrganization as unknown as SetActiveOrganizationWithHeaders
  const result = await call({ headers, body: { organizationId }, returnHeaders: true })
  forwardAuthCookies(c, result.headers)
}

export function registerOrganizationRoutes(app: OpenAPIHono<AppEnv>, auth: Auth, db: Database, env: Env): void {
  app.openapi(setActiveOrganizationRoute, async (c) => {
    const scope = c.var.scope
    assertSessionActor(scope, "Switch the active organization from a signed-in session, not an API key.")
    const { organization_id: organizationId } = c.req.valid("json")

    try {
      await setActiveOrganizationWithCookies(c, auth, c.req.raw.headers, organizationId)
    } catch (error) {
      if (error instanceof APIError && error.status === "FORBIDDEN") {
        throw new PostbagError("forbidden", "You are not a member of that organization.")
      }
      throw error
    }

    const [org] = await db.select().from(organization).where(eq(organization.id, organizationId)).limit(1)
    if (org === undefined) throw new PostbagError("not_found", "No organization with that id.")

    const body: z.infer<typeof SetActiveOrganizationResponseSchema> = {
      organization: { id: org.id, slug: org.slug, name: org.name },
    }
    return c.json(body, 200)
  })

  app.openapi(createOrganizationRoute, async (c) => {
    const scope = c.var.scope
    assertSessionActor(scope, "Create an organization from a signed-in session, not an API key.")
    const body = c.req.valid("json")

    const created = await auth.api.createOrganization({
      headers: c.req.raw.headers,
      body: { name: body.name, slug: body.slug ?? `${slugify(body.name)}-${newId("org").slice(-6)}` },
    })
    const org = created as unknown as { readonly id: string; readonly slug: string; readonly name: string }

    // Same shape provisionPersonalOrganization gives every signup: default settings + a
    // "Default" project (Principle 2 — the concept must not exist for the user yet).
    await db.transaction(async (tx) => {
      const selfHosted = env.POLAR_ACCESS_TOKEN === undefined
      await tx.insert(organizationSettings).values({
        organizationId: org.id,
        plan: selfHosted ? "selfhost" : "free",
        planSource: selfHosted ? "selfhost" : "free",
        timezone: "UTC",
        limits: {},
      })
      await tx.insert(projects).values({ id: newId("prj"), organizationId: org.id, slug: "default", name: "Default", tags: [] })
    })

    await setActiveOrganizationWithCookies(c, auth, c.req.raw.headers, org.id)

    const responseBody: z.infer<typeof OrganizationSummarySchema> = {
      id: org.id,
      slug: org.slug,
      name: org.name,
      role: "owner",
      is_active: true,
    }
    return c.json(responseBody, 201)
  })
}
