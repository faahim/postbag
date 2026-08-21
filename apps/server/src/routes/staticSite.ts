import { existsSync, readFileSync, statSync } from "node:fs"
import { extname, join, normalize } from "node:path"
import { fileURLToPath } from "node:url"

import type { Hono } from "hono"

import type { AppEnv } from "../lib/scope.js"
import { renderLlmsTxt } from "../lib/llms.js"

/**
 * Serves the marketing/docs site (apps/site, Astro static output) at `/`.
 *
 * The site is built into apps/server/dist/site so the one image carries it (same idea as the
 * dashboard SPA under /app). If the directory is missing — e.g. a self-host build that skipped
 * the site — nothing here registers and `/` keeps redirecting to the dashboard.
 *
 * Agent-native touches: `Accept: text/markdown` on `/` returns llms.txt, and on any page that
 * has a Markdown twin (`index.md` next to `index.html`) returns the Markdown.
 */

const RESERVED_PREFIXES = ["/v1/", "/s/", "/api/", "/app"]
const RESERVED_EXACT = new Set(["/v1", "/s", "/health", "/llms.txt", "/openapi.json"])

const MIME: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
}

function resolveSiteDir(): string | null {
  const candidates = [
    fileURLToPath(new URL("../site", import.meta.url)), // dist/routes → dist/site
    fileURLToPath(new URL("../../dist/site", import.meta.url)), // src/routes → dist/site (tsx dev)
  ]
  return candidates.find((dir) => existsSync(join(dir, "index.html"))) ?? null
}

function isReserved(path: string): boolean {
  return RESERVED_EXACT.has(path) || RESERVED_PREFIXES.some((p) => path.startsWith(p))
}

function prefersMarkdown(accept: string | undefined): boolean {
  if (accept === undefined) return false
  const md = accept.indexOf("text/markdown")
  if (md === -1) return false
  const html = accept.indexOf("text/html")
  return html === -1 || md < html
}

function safeJoin(root: string, urlPath: string): string | null {
  const decoded = (() => {
    try {
      return decodeURIComponent(urlPath)
    } catch {
      return null
    }
  })()
  if (decoded === null || decoded.includes("\0")) return null
  const full = normalize(join(root, decoded))
  return full.startsWith(root) ? full : null
}

/**
 * Cache policy for the static site. Browsers keep pages briefly; the CDN (Cloudflare, which
 * honours `s-maxage` and `stale-while-revalidate` when a cache rule makes HTML eligible) keeps
 * them for ten minutes and serves stale for a day while it refetches, so a deploy is visible
 * worldwide within minutes without any purge step. Hashed `/_astro/*` assets are immutable.
 * Markdown twins and llms.txt get the same policy; the Cloudflare cache rule keys requests
 * with `Accept: text/markdown` out of the cache so the negotiation stays correct.
 */
const PAGE_CACHE = "public, max-age=300, s-maxage=600, stale-while-revalidate=86400"

function cacheControl(path: string): string {
  if (path.startsWith("/_astro/")) return "public, max-age=31536000, immutable"
  if (/\.(?:png|jpe?g|webp|avif|svg|ico|woff2?)$/u.test(path)) return "public, max-age=86400, s-maxage=604800"
  return PAGE_CACHE
}

export function registerSiteStatic(app: Hono<AppEnv>, appUrl: string): boolean {
  const siteDir = resolveSiteDir()
  if (siteDir === null) return false

  const notFoundHtml = existsSync(join(siteDir, "404.html")) ? readFileSync(join(siteDir, "404.html"), "utf8") : null

  app.get("*", async (c, next) => {
    const path = c.req.path
    if (isReserved(path)) return next()

    // Agents asking the root for Markdown get the onboarding page (docs/AGENT-NATIVE.md §1).
    if (path === "/" && prefersMarkdown(c.req.header("accept"))) {
      c.header("content-type", "text/markdown; charset=utf-8")
      c.header("cache-control", PAGE_CACHE)
      c.header("vary", "accept")
      return c.body(renderLlmsTxt(appUrl))
    }

    const target = safeJoin(siteDir, path)
    if (target === null) return next()

    // Directory-style URLs: `/docs/x/` → index.html; `/docs/x` → 301 to the slash form.
    let file = target
    if (path.endsWith("/")) {
      file = join(target, "index.html")
    } else if (extname(path) === "" && existsSync(join(target, "index.html"))) {
      return c.redirect(`${path}/`, 301)
    }

    if (file.endsWith("index.html") && prefersMarkdown(c.req.header("accept"))) {
      const twin = file.replace(/index\.html$/u, "index.md")
      if (existsSync(twin)) {
        c.header("content-type", "text/markdown; charset=utf-8")
        c.header("cache-control", PAGE_CACHE)
        c.header("vary", "accept")
        c.header("x-robots-tag", "noindex")
        return c.body(readFileSync(twin))
      }
    }

    if (!existsSync(file) || !statSync(file).isFile()) {
      if (notFoundHtml !== null && (extname(path) === "" || extname(path) === ".html")) {
        c.header("content-type", "text/html; charset=utf-8")
        c.header("cache-control", "no-store")
        return c.body(notFoundHtml, 404)
      }
      return next()
    }

    const ext = extname(file)
    c.header("content-type", MIME[ext] ?? "application/octet-stream")
    c.header("cache-control", cacheControl(path))
    if (file.endsWith("index.html")) c.header("vary", "accept")
    if (ext === ".md" || path === "/llms-full.txt") c.header("x-robots-tag", "noindex")
    return c.body(readFileSync(file))
  })

  return true
}
