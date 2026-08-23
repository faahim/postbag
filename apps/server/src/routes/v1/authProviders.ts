import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"

import type { Env } from "../../env.js"
import { isHostedInstance } from "../../authSetup.js"
import type { AppEnv } from "../../lib/scope.js"

const SocialProviderSchema = z.enum(["google", "github"])

const AuthProvidersSchema = z.object({
  email_password: z.object({ sign_in: z.boolean(), sign_up: z.boolean() }),
  email_code: z.object({ sign_in: z.boolean(), sign_up: z.boolean() }),
  social: z.array(SocialProviderSchema),
  sign_in_url: z.string(),
})

const authProvidersRoute = createRoute({
  method: "get",
  path: "/v1/auth/providers",
  operationId: "auth_providers",
  tags: ["discovery"],
  summary: "Which sign-in methods this instance has configured",
  description:
    "Public, unauthenticated. Email/password reports sign-in and sign-up separately because hosted " +
    "Postbag keeps password sign-in for existing users while disabling new password registration. `social` " +
    "lists only the OAuth providers this instance has both a client id and secret for (self-host " +
    "parity: a self-hosted instance with neither configured returns an empty list). The dashboard " +
    "calls this once, cached, to decide which social sign-in buttons to render.",
  security: [],
  responses: {
    200: { description: "ok", content: { "application/json": { schema: AuthProvidersSchema } } },
  },
})

/** Registered before `requireOrg`, like the submit path — this must stay reachable with
 * no credentials at all, including on a fresh install with no org yet. */
export function registerAuthProviderRoutes(app: OpenAPIHono<AppEnv>, env: Env): void {
  app.openapi(authProvidersRoute, (c) => {
    const social: z.infer<typeof SocialProviderSchema>[] = []
    if (env.GOOGLE_CLIENT_ID !== undefined && env.GOOGLE_CLIENT_SECRET !== undefined)
      social.push("google")
    if (env.GITHUB_CLIENT_ID !== undefined && env.GITHUB_CLIENT_SECRET !== undefined)
      social.push("github")

    c.header("Cache-Control", "public, max-age=60")
    return c.json({
      email_password: { sign_in: true, sign_up: !isHostedInstance(env) },
      email_code: {
        sign_in: env.RESEND_API_KEY !== undefined,
        sign_up: env.RESEND_API_KEY !== undefined,
      },
      social,
      sign_in_url: `${env.APP_URL}/app/sign-in`,
    })
  })
}
