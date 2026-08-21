import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { serveStatic } from "@hono/node-server/serve-static"
import type { Hono } from "hono"

import type { AppEnv } from "../lib/scope.js"

const PLACEHOLDER_HTML =
  "<!doctype html><html><head><meta charset=\"utf-8\"><title>Postbag</title></head>" +
  '<body style="font-family: system-ui, sans-serif; display: grid; place-items: center; height: 100vh; margin: 0;">' +
  "<p>The Postbag dashboard has not been built into this image yet.</p></body></html>"

export function registerAppStatic(app: Hono<AppEnv>): void {
  // Built output lives in dist/public. When running from source (tsx), import.meta.url is
  // under src/, so also look at ../../dist/public so `pnpm dev` serves a previously built SPA.
  const builtDir = fileURLToPath(new URL("../public", import.meta.url))
  const sourceDir = fileURLToPath(new URL("../../dist/public", import.meta.url))
  const publicDir = [builtDir, sourceDir].find((dir) => existsSync(`${dir}/index.html`)) ?? builtDir
  const hasPublicDir = existsSync(publicDir) && existsSync(`${publicDir}/index.html`)

  app.get("/", (c) => c.redirect("/app", 302))

  if (!hasPublicDir) {
    app.get("/app", (c) => c.html(PLACEHOLDER_HTML))
    app.get("/app/*", (c) => c.html(PLACEHOLDER_HTML))
    return
  }

  const indexHtml = readFileSync(`${publicDir}/index.html`, "utf8")
  app.use(
    "/app/*",
    serveStatic({
      root: publicDir,
      rewriteRequestPath: (path) => path.replace(/^\/app/u, ""),
    }),
  )
  // History-fallback: anything not served as a static file above is an SPA route.
  app.get("/app", (c) => c.html(indexHtml))
  app.get("/app/*", (c) => c.html(indexHtml))
}
