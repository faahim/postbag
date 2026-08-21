import { describe, expect, it } from "vitest"

import { buildHarness } from "./testUtils.js"

describe("Agent Skill discovery (/.well-known/skills)", () => {
  it("GET /.well-known/skills/index.json lists the postbag skill", async () => {
    const harness = buildHarness()
    const response = await harness.app.request("/.well-known/skills/index.json")
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600")
    const body = (await response.json()) as { skills: { name: string; url: string }[] }
    expect(body.skills).toEqual([
      { name: "postbag", url: `${harness.env.APP_URL}/.well-known/skills/postbag/SKILL.md` },
    ])
    await harness.close()
  })

  it("GET /.well-known/skills/postbag/SKILL.md serves the skill as Markdown, cached, with the instance's own URL substituted in", async () => {
    const harness = buildHarness()
    const response = await harness.app.request("/.well-known/skills/postbag/SKILL.md")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/markdown")
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600")
    const text = await response.text()
    expect(text).toContain("name: postbag")
    expect(text).toContain(harness.env.APP_URL)
    // Self-host parity: the checked-in file hardcodes the hosted product's URL so it
    // installs correctly as-is via `npx skills add`; the served copy substitutes it for
    // this instance's real APP_URL (here, not postbag.dev), so none should remain.
    expect(text).not.toContain("postbag.dev")
    await harness.close()
  })
})
