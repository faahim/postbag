import type { MiddlewareHandler } from "hono"

import type { AppEnv } from "../lib/scope.js"

const ALWAYS_LIVE_PREFIXES = ["/s/", "/v1/", "/health"]

/**
 * PROGRESS.md "Next up" #1 / job F 1e: production keeps an old custom domain
 * (`postbag.withfaahim.com`) alive as an extra Coolify domain so submit URLs already
 * embedded on live sites never break, while everything else on that host — the
 * marketing pages, the dashboard, `/` — should point people at the canonical `APP_URL`.
 * `LEGACY_HOSTS` (comma-separated, empty by default) lists those old hostnames. Self-host
 * operators who never rename their domain simply never set it, and this middleware is a
 * no-op for them.
 */
export function legacyHostRedirect(legacyHosts: readonly string[], appUrl: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (legacyHosts.length === 0) {
      await next()
      return
    }

    const path = new URL(c.req.url).pathname
    if (ALWAYS_LIVE_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      await next()
      return
    }

    const rawHost = c.req.header("x-forwarded-host") ?? c.req.header("host") ?? ""
    const host = rawHost.split(":")[0]?.toLowerCase() ?? ""
    if (!legacyHosts.includes(host)) {
      await next()
      return
    }

    const search = new URL(c.req.url).search
    const target = `${appUrl}${path}${search}`
    return c.redirect(target, 301)
  }
}
