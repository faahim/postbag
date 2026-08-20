import { PostbagError } from "@postbag/core"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import type { ContentfulStatusCode } from "hono/utils/http-status"

import { envelope, fromPostbagError } from "./errors.js"
import type { Logger } from "../logger.js"

export function buildErrorHandler(logger: Logger) {
  return (error: Error, c: Context): Response => {
    if (error instanceof PostbagError) {
      return c.json(fromPostbagError(error), error.status as ContentfulStatusCode)
    }
    if (error instanceof HTTPException) {
      return error.getResponse()
    }
    logger.error({ err: error, path: c.req.path, method: c.req.method }, "unhandled_error")
    return c.json(
      envelope("internal_error", "Something went wrong.", {
        hint: "Retry; contact support if this persists.",
      }),
      500,
    )
  }
}
