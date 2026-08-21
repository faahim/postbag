import { OpenAPIHono } from "@hono/zod-openapi"
import type { Database } from "@postbag/db"

import type { Auth } from "./authSetup.js"
import type { AnyDestinationAdapter } from "./destinations/types.js"
import type { Env } from "./env.js"
import { envelope } from "./lib/errors.js"
import { renderLlmsTxt } from "./lib/llms.js"
import { renderPostbagSkill, skillsIndex } from "./lib/skills.js"
import type { Logger } from "./logger.js"
import { buildErrorHandler } from "./lib/onError.js"
import { TokenBucketLimiter } from "./lib/rateLimit.js"
import type { AppEnv } from "./lib/scope.js"
import { idempotency } from "./middleware/idempotency.js"
import { legacyHostRedirect } from "./middleware/legacyHostRedirect.js"
import { requestId } from "./middleware/requestId.js"
import { requireOrg } from "./middleware/requireOrg.js"
import { registerHealthRoute } from "./routes/health.js"
import { registerAppStatic } from "./routes/staticApp.js"
import { registerSiteStatic } from "./routes/staticSite.js"
import { registerSubmitRoutes } from "./routes/submit.js"
import { registerApiKeyRoutes } from "./routes/v1/apiKeys.js"
import { registerAuthCodeRoutes } from "./routes/v1/authCodes.js"
import { registerAuthProviderRoutes } from "./routes/v1/authProviders.js"
import { registerDeliveryRoutes } from "./routes/v1/deliveries.js"
import { registerDestinationRoutes } from "./routes/v1/destinations.js"
import { registerEventRoutes } from "./routes/v1/events.js"
import { registerFormRoutes } from "./routes/v1/forms.js"
import { registerMeRoutes } from "./routes/v1/me.js"
import { registerPlanGrantRoutes } from "./routes/v1/planGrants.js"
import { registerPlanRoutes } from "./routes/v1/plan.js"
import { registerProjectRoutes } from "./routes/v1/projects.js"
import { registerQuickstartRoutes } from "./routes/v1/quickstart.js"
import { registerRouteResourceRoutes } from "./routes/v1/routesResource.js"
import { registerStreamRoutes } from "./routes/v1/streams.js"
import { registerSubmissionRoutes } from "./routes/v1/submissions.js"

export const VERSION = "0.1.0"

export type AppDeps = {
  readonly db: Database
  readonly env: Env
  readonly logger: Logger
  readonly auth: Auth
  readonly destinations: ReadonlyMap<string, AnyDestinationAdapter>
}

export function createApp(deps: AppDeps): OpenAPIHono<AppEnv> {
  const { db, env, logger, auth } = deps
  const rateLimiter = new TokenBucketLimiter()

  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          envelope("validation_failed", "The request did not match the expected shape.", {
            details: { issues: result.error.issues },
          }),
          422,
        )
      }
      return undefined
    },
  })

  app.onError(buildErrorHandler(logger))
  app.use("*", legacyHostRedirect(env.LEGACY_HOSTS, env.APP_URL))
  app.use("*", requestId())

  // Public submit path — no auth, no /v1 middleware.
  registerSubmitRoutes(app, { db, env, logger, rateLimiter })

  // Public discovery endpoint — no auth, registered before requireOrg like the submit path
  // above, even though its path is under /v1/*: the SPA calls this before sign-in to decide
  // which social buttons to render, so it must work with zero credentials.
  registerAuthProviderRoutes(app, env)

  // Public agent-onboarding endpoints (job H): request-code / verify-code. Same public,
  // pre-requireOrg registration as the two above — an agent holding no credentials at all
  // must be able to reach these.
  registerAuthCodeRoutes(app, auth, db, env, rateLimiter)

  // Better Auth handles /api/auth/* itself.
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))

  // Everything under /v1 requires an org scope, and honours Idempotency-Key.
  app.use("/v1/*", requireOrg(auth, db))
  app.use("/v1/*", idempotency(db))

  registerMeRoutes(app, db)
  registerApiKeyRoutes(app, auth, db)
  registerPlanRoutes(app, db)
  registerPlanGrantRoutes(app, db, env)
  registerQuickstartRoutes(app, db, env.APP_URL)
  registerProjectRoutes(app, db)
  registerFormRoutes(app, db, env.APP_URL)
  registerSubmissionRoutes(app, db)
  registerStreamRoutes(app, db)
  registerDestinationRoutes(app, db, deps.destinations)
  registerRouteResourceRoutes(app, db)
  registerDeliveryRoutes(app, db)
  registerEventRoutes(app, db)

  registerHealthRoute(app, db, VERSION)

  app.get("/llms.txt", (c) => {
    c.header("content-type", "text/markdown; charset=utf-8")
    c.header("cache-control", "public, max-age=300, s-maxage=600, stale-while-revalidate=86400")
    return c.body(renderLlmsTxt(env.APP_URL))
  })

  // Agent Skills discovery (job H 3): the index an agent's `skills` tooling reads to find
  // what's installable, and the skill file itself, served with a 1-hour cache like a static
  // asset — its content only changes on deploy.
  app.get("/.well-known/skills/index.json", (c) => {
    c.header("cache-control", "public, max-age=3600")
    return c.json(skillsIndex(env.APP_URL))
  })
  app.get("/.well-known/skills/postbag/SKILL.md", (c) => {
    c.header("content-type", "text/markdown; charset=utf-8")
    c.header("cache-control", "public, max-age=3600")
    return c.body(renderPostbagSkill(env.APP_URL))
  })

  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "pb_live_… API key",
    description:
      "An API key minted via POST /v1/api-keys (or the dashboard), sent as `Authorization: Bearer pb_live_…`. " +
      "Scopes are manage ⊇ read ⊇ submit — a manage key satisfies every read- or submit-scoped call too.",
  })

  app.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "Postbag API",
      version: VERSION,
      description:
        "A form backend that routes. Websites POST submissions to /s/{formId} (public, unauthenticated); " +
        "everything under /v1 manages forms, streams, destinations, routes and deliveries and requires a " +
        "bearer API key. Start at GET /v1/me, then see /llms.txt for the full agent onboarding guide.",
    },
    // Self-host parity (Principle 7): the live /openapi.json reports this instance's own
    // APP_URL, not a hardcoded postbag.dev — a self-hosted operator's contract points at
    // their own server. `scripts/export-openapi.ts` overrides `servers` for the committed,
    // generated `api/openapi.yaml` (the hosted product's contract) after fetching this.
    servers: [{ url: env.APP_URL }],
    security: [{ bearerAuth: [] }],
  })

  // Marketing/docs site at `/` when built in; otherwise `/` redirects to the dashboard.
  const hasSite = registerSiteStatic(app, env.APP_URL)
  registerAppStatic(app, { redirectRoot: !hasSite })

  return app
}
