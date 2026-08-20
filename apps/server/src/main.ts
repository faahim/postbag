import { serve, type ServerType } from "@hono/node-server"
import { createDb, migrate } from "@postbag/db"

import { createApp } from "./app.js"
import { buildAuth } from "./authSetup.js"
import { createDestinationRegistry } from "./destinations/registry.js"
import { loadEnv } from "./env.js"
import { createLogger } from "./logger.js"
import { startWorker, type WorkerHandle } from "./worker/index.js"

async function main(): Promise<void> {
  const env = loadEnv()
  const logger = createLogger(env)

  if (env.MIGRATE_ON_BOOT) {
    logger.info("running database migrations")
    await migrate(env.DATABASE_URL)
  }

  const client = createDb(env.DATABASE_URL)
  const auth = buildAuth(client.db, env)
  const destinations = createDestinationRegistry(env)

  let server: ServerType | undefined
  let worker: WorkerHandle | undefined

  if (env.POSTBAG_ROLE === "api" || env.POSTBAG_ROLE === "all") {
    const app = createApp({ db: client.db, env, logger, auth, destinations })
    server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
      logger.info({ port: info.port, role: env.POSTBAG_ROLE }, "postbag api listening")
    })
  }

  if (env.POSTBAG_ROLE === "worker" || env.POSTBAG_ROLE === "all") {
    worker = startWorker(client.db, env, logger, destinations)
    logger.info({ role: env.POSTBAG_ROLE }, "postbag worker started")
  }

  let shuttingDown = false
  const shutdown = (signal: string): void => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, "shutting down")
    void (async () => {
      if (server !== undefined) {
        const activeServer = server
        await new Promise<void>((resolve) => {
          activeServer.close(() => {
            resolve()
          })
        })
      }
      if (worker !== undefined) await worker.stop()
      await client.close()
      logger.info("shutdown complete")
      process.exit(0)
    })()
  }

  process.on("SIGTERM", () => {
    shutdown("SIGTERM")
  })
  process.on("SIGINT", () => {
    shutdown("SIGINT")
  })
}

main().catch((error: unknown) => {
  console.error("postbag failed to start", error)
  process.exit(1)
})
