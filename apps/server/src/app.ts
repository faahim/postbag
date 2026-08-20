import { OpenAPIHono } from "@hono/zod-openapi"
import type { Database } from "@postbag/db"

import type { Auth } from "./authSetup.js"
import type { AnyDestinationAdapter } from "./destinations/types.js"
import type { Env } from "./env.js"
import { envelope } from "./lib/errors.js"
import { renderLlmsTxt } from "./lib/llms.js"
import type { Logger } from "./logger.js"
import { buildErrorHandler } from "./lib/onError.js"
import { TokenBucketLimiter } from "./lib/rateLimit.js"
import type { AppEnv } from "./lib/scope.js"
import { idempotency } from "./middleware/idempotency.js"
import { requestId } from "./middleware/requestId.js"
import { requireOrg } from "./middleware/requireOrg.js"
import { registerHealthRoute } from "./routes/health.js"
import { registerAppStatic } from "./routes/staticApp.js"
import { registerSubmitRoutes } from "./routes/submit.js"
import { registerApiKeyRoutes } from "./routes/v1/apiKeys.js"
import { registerDeliveryRoutes } from "./routes/v1/deliveries.js"
import { registerDestinationRoutes } from "./routes/v1/destinations.js"
import { registerEventRoutes } from "./routes/v1/events.js"
import { registerFormRoutes } from "./routes/v1/forms.js"
import { registerMeRoutes } from "./routes/v1/me.js"
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
  app.use("*", requestId())

  // Public submit path — no auth, no /v1 middleware.
  registerSubmitRoutes(app, { db, env, logger, rateLimiter })

  // Better Auth handles /api/auth/* itself.
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))

  // Everything under /v1 requires an org scope, and honours Idempotency-Key.
  app.use("/v1/*", requireOrg(auth, db))
  app.use("/v1/*", idempotency(db))

  registerMeRoutes(app, db)
  registerApiKeyRoutes(app, auth, db)
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
    return c.body(renderLlmsTxt(env.APP_URL))
  })

  app.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Postbag API", version: VERSION, description: "A form backend that routes." },
    servers: [{ url: env.APP_URL }],
  })

  registerAppStatic(app)

  return app
}
