import type { Database } from "@postbag/db"
import type { MiddlewareHandler } from "hono"

import { lookupIdempotencyKey, storeIdempotencyKey } from "../lib/idempotency.js"
import type { Variables } from "../lib/scope.js"

export function idempotency(db: Database): MiddlewareHandler<{ Variables: Variables }> {
  return async (c, next) => {
    if (c.req.method !== "POST") {
      await next()
      return
    }
    const key = c.req.header("idempotency-key")
    if (key === undefined || key.length === 0) {
      await next()
      return
    }
    const scope = c.var.scope
    const stored = await lookupIdempotencyKey(db, scope.organizationId, key)
    if (stored !== null) {
      c.res = Response.json(stored.body, { status: stored.statusCode })
      return
    }
    await next()
    if (c.res.status >= 200 && c.res.status < 300) {
      const body: unknown = await c.res.clone().json().catch(() => null)
      if (body !== null) {
        await storeIdempotencyKey(
          db,
          scope.organizationId,
          key,
          c.req.method,
          c.req.path,
          c.res.status,
          body,
        )
      }
    }
  }
}
