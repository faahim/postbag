import type { MiddlewareHandler } from "hono"

import type { AppEnv } from "../lib/scope.js"

export function requestId(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const id = c.req.header("x-request-id") ?? globalThis.crypto.randomUUID()
    c.set("requestId", id)
    c.header("X-Request-Id", id)
    await next()
  }
}
