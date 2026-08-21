import type { Context } from "hono"

/**
 * Forwards every `Set-Cookie` from an `auth.api.*` call made with `returnHeaders: true`
 * onto our own response. Session reads use Better Auth's 5-minute cookie cache
 * (`packages/auth/src/auth.ts`'s `session.cookieCache`) — without this, switching or
 * accepting into a new active organization would silently keep serving the *old* cached
 * `activeOrganizationId` to the browser for up to 5 minutes even though the database (and
 * a fresh, uncached session read) already reflects the change.
 */
export function forwardAuthCookies(c: Context, headers: Headers | undefined): void {
  if (headers === undefined) return
  const cookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : []
  for (const cookie of cookies) {
    c.header("set-cookie", cookie, { append: true })
  }
}
