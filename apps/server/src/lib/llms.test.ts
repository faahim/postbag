import { describe, expect, it } from "vitest"

import { renderLlmsTxt } from "./llms.js"

describe("renderLlmsTxt", () => {
  it("points agents at the skill, agent pages, guides, CLI and MCP", () => {
    const body = renderLlmsTxt("https://example.test")
    expect(body).toContain("npx skills add faahim/postbag --skill postbag")
    expect(body).toContain("https://example.test/.well-known/skills/postbag/SKILL.md")
    expect(body).toContain("POSTBAG_API_URL=https://example.test")
    expect(body).toContain("https://example.test/for-ai-agents/")
    expect(body).toContain("https://example.test/docs/agents/")
    expect(body).toContain("https://example.test/guides/")
    expect(body).toContain("https://example.test/guides/html/")
    expect(body).toContain("https://example.test/openapi.json")
    expect(body).toContain("npx -y @postbag/mcp")
    expect(body).toContain("Start without credentials")
    expect(body.indexOf("Preferred start for coding agents")).toBeLessThan(
      body.indexOf("Start without credentials"),
    )
  })
})
