import type { Context } from "hono"

import type { AppEnv } from "./scope.js"

// Extracted from routes/submit.ts (job H) so the auth-code rate limiter (job H 1b) uses the
// exact same client-IP resolution as the submit path, instead of a second implementation
// that could disagree under the same Cloudflare → Traefik → container topology. Production
// runs behind Cloudflare (proxied) → Traefik → container. Prefer the header Cloudflare sets
// from the real client connection, then the first hop of X-Forwarded-For (the proxy chain
// nearest the client), then the raw socket address the Node server sees, in that order.
function socketRemoteAddress(c: Context<AppEnv>): string | undefined {
  const env = c.env as { readonly incoming?: { readonly socket?: { readonly remoteAddress?: string } } } | undefined
  const address = env?.incoming?.socket?.remoteAddress
  return address === undefined || address.length === 0 ? undefined : address
}

export function clientIp(c: Context<AppEnv>): string {
  const cfConnectingIp = c.req.header("cf-connecting-ip")?.trim()
  if (cfConnectingIp !== undefined && cfConnectingIp.length > 0) return cfConnectingIp

  const forwarded = c.req.header("x-forwarded-for")
  if (forwarded !== undefined) {
    const firstHop = forwarded.split(",")[0]?.trim()
    if (firstHop !== undefined && firstHop.length > 0) return firstHop
  }

  return socketRemoteAddress(c) ?? "unknown"
}
