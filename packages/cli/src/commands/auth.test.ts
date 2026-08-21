import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { readCredentials } from "../lib/config.js"
import { createHarness } from "../lib/testHarness.js"
import { main } from "../main.js"

describe("postbag login — code flow", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "postbag-cli-login-"))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("--email alone sends a code and does not save any credentials", async () => {
    const harness = createHarness({
      cwd: dir,
      homeDir: join(dir, "home"),
      env: {},
      handleFetch: (req) => {
        expect(req.url).toBe("https://postbag.dev/v1/auth/request-code")
        expect(req.method).toBe("POST")
        expect(req.headers["authorization"]).toBeUndefined()
        const body = JSON.parse(req.body ?? "{}") as { email: string }
        expect(body.email).toBe("agent@example.com")
        return {
          status: 200,
          body: { ok: true, expires_in: 600, next: "POST /v1/auth/verify-code with { email, code, key_name }" },
        }
      },
    })

    await main(["node", "postbag", "login", "--email", "agent@example.com"], harness.deps)

    expect(harness.requests).toHaveLength(1)
    expect(harness.logs.join("\n")).toContain("Code sent to agent@example.com — check your inbox")
    expect(readCredentials({ env: {}, cwd: dir, homeDir: join(dir, "home") })).toBeUndefined()
  })

  it("--email + --code verifies, saves the key at mode 0600, and prints the org name", async () => {
    const homeDir = join(dir, "home")
    const harness = createHarness({
      cwd: dir,
      homeDir,
      env: {},
      stdoutIsTty: true,
      handleFetch: (req) => {
        expect(req.url).toBe("https://postbag.dev/v1/auth/verify-code")
        const body = JSON.parse(req.body ?? "{}") as { email: string; code: string; key_name: string }
        expect(body.email).toBe("agent@example.com")
        expect(body.code).toBe("123456")
        expect(body.key_name).toContain("postbag-cli ·")
        return {
          status: 201,
          body: {
            api_key: "pb_live_testkey",
            key_id: "key_abc",
            scopes: ["manage"],
            organization: { id: "org_abc", slug: "acme", name: "Acme" },
            user: { email: "agent@example.com", created: true },
            next: [],
          },
        }
      },
    })

    await main(["node", "postbag", "login", "--email", "agent@example.com", "--code", "123456"], harness.deps)

    expect(harness.requests).toHaveLength(1)
    expect(harness.logs.join("\n")).toContain("Logged in to Acme (acme)")

    const credentialsPath = join(homeDir, ".config", "postbag", "credentials.json")
    const saved = JSON.parse(readFileSync(credentialsPath, "utf8")) as {
      profiles: Record<string, { api_key?: string }>
      current: string
    }
    expect(saved.profiles[saved.current]?.api_key).toBe("pb_live_testkey")

    const mode = statSync(credentialsPath).mode & 0o777
    expect(mode).toBe(0o600)
  })

  it("a pasted API key (--api-key) still uses the existing /v1/me verification path, unchanged", async () => {
    const harness = createHarness({
      cwd: dir,
      homeDir: join(dir, "home"),
      env: {},
      stdoutIsTty: true,
      handleFetch: (req) => {
        expect(req.url).toBe("https://postbag.dev/v1/me")
        expect(req.headers["authorization"]).toBe("Bearer pb_live_pasted")
        return {
          status: 200,
          body: {
            organization: { id: "org_x", slug: "x", name: "X Org" },
            key: { scopes: ["manage"] },
            counts: {},
            limits: {},
            next: [],
          },
        }
      },
    })

    await main(["node", "postbag", "--api-key", "pb_live_pasted", "login"], harness.deps)

    expect(harness.requests).toHaveLength(1)
    expect(harness.logs.join("\n")).toContain("Logged in to X Org (x)")
  })
})
