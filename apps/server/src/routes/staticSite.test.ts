import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { Hono } from "hono"
import { afterEach, describe, expect, it } from "vitest"

import type { AppEnv } from "../lib/scope.js"
import { registerSiteStatic } from "./staticSite.js"

const roots: string[] = []

function buildSite(): Hono<AppEnv> {
  const root = mkdtempSync(join(tmpdir(), "postbag-static-site-"))
  roots.push(root)
  const docs = join(root, "docs", "quickstart")
  mkdirSync(docs, { recursive: true })
  writeFileSync(join(root, "index.html"), "<h1>Postbag</h1>")
  writeFileSync(join(root, "404.html"), "<h1>Not found</h1>")
  writeFileSync(join(docs, "index.html"), "<h1>Quickstart</h1>")
  writeFileSync(join(docs, "index.md"), "# Quickstart\n")

  const app = new Hono<AppEnv>()
  registerSiteStatic(app, "https://postbag.dev", root)
  return app
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("site static Markdown twins", () => {
  it("serves the file-like index.md link used by documentation pages", async () => {
    const response = await buildSite().request("/docs/quickstart/index.md")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/markdown")
    expect(response.headers.get("x-robots-tag")).toBe("noindex")
    expect(await response.text()).toBe("# Quickstart\n")
  })

  it("serves the same Markdown for content negotiation on the canonical page URL", async () => {
    const response = await buildSite().request("/docs/quickstart/", {
      headers: { accept: "text/markdown, text/html;q=0.9" },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/markdown")
    expect(response.headers.get("vary")).toBe("accept")
    expect(await response.text()).toBe("# Quickstart\n")
  })
})
