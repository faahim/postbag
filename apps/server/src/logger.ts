import pino from "pino"

import type { Env } from "./env.js"

export type Logger = pino.Logger

export function createLogger(env: Pick<Env, "NODE_ENV">): Logger {
  return pino({
    level: env.NODE_ENV === "test" ? "silent" : "info",
    base: { service: "postbag" },
    timestamp: pino.stdTimeFunctions.isoTime,
  })
}
