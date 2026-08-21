import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createHarness } from "../lib/testHarness.js"
import { main } from "../main.js"

describe("postbag init", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "postbag-cli-init-"))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("runs quickstart and writes postbag.json (--yes, JSON mode)", async () => {
    const harness = createHarness({
      cwd: dir,
      homeDir: join(dir, "home"),
      env: { POSTBAG_API_KEY: "pb_live_test" },
      handleFetch: (req) => {
        expect(req.url).toBe("https://postbag.dev/v1/quickstart")
        expect(req.headers["authorization"]).toBe("Bearer pb_live_test")
        const body = JSON.parse(req.body ?? "{}") as { name: string }
        expect(body.name).toBe("my-project")
        return {
          status: 201,
          body: {
            form: { id: "fm_1", name: body.name, submit_url: "https://postbag.dev/s/fm_1" },
            destinations: [],
            routes: [],
            embed: { html: "<form></form>", fetch: "", react: "", astro: "", nextjs_action: "" },
            verify: { curl: "curl ...", then: "GET /v1/forms/fm_1/submissions" },
            next: [],
          },
        }
      },
    })
    // Force a predictable cwd basename for the default form name.
    const projectDir = join(dir, "my-project")
    mkdirSync(projectDir)
    await main(["node", "postbag", "--json", "init", "--yes"], { ...harness.deps, cwd: projectDir })

    const written = JSON.parse(readFileSync(join(projectDir, "postbag.json"), "utf8")) as {
      form_id: string
      submit_url: string
    }
    expect(written.form_id).toBe("fm_1")
    expect(written.submit_url).toBe("https://postbag.dev/s/fm_1")

    const printed = JSON.parse(harness.logs[0] ?? "{}") as { form: { id: string } }
    expect(printed.form.id).toBe("fm_1")
  })

  it("is idempotent: a second run without --force reprints the existing form and does not call the API", async () => {
    const harness = createHarness({
      cwd: dir,
      homeDir: join(dir, "home"),
      env: { POSTBAG_API_KEY: "pb_live_test" },
      handleFetch: () => ({
        status: 201,
        body: {
          form: { id: "fm_1", name: "x", submit_url: "https://postbag.dev/s/fm_1" },
          destinations: [],
          routes: [],
          embed: { html: "", fetch: "", react: "", astro: "", nextjs_action: "" },
          verify: { curl: "", then: "" },
          next: [],
        },
      }),
    })

    await main(["node", "postbag", "--json", "init", "--yes"], harness.deps)
    expect(harness.requests).toHaveLength(1)

    await main(["node", "postbag", "--json", "init", "--yes"], harness.deps)
    expect(harness.requests).toHaveLength(1) // no second call

    const secondPrint = JSON.parse(harness.logs[1] ?? "{}") as { form_id: string }
    expect(secondPrint.form_id).toBe("fm_1")
  })

  it("--force re-runs quickstart even when postbag.json already has a form_id", async () => {
    let calls = 0
    const harness = createHarness({
      cwd: dir,
      homeDir: join(dir, "home"),
      env: { POSTBAG_API_KEY: "pb_live_test" },
      handleFetch: () => {
        calls += 1
        return {
          status: 201,
          body: {
            form: { id: `fm_${String(calls)}`, name: "x", submit_url: `https://postbag.dev/s/fm_${String(calls)}` },
            destinations: [],
            routes: [],
            embed: { html: "", fetch: "", react: "", astro: "", nextjs_action: "" },
            verify: { curl: "", then: "" },
            next: [],
          },
        }
      },
    })

    await main(["node", "postbag", "--json", "init", "--yes"], harness.deps)
    await main(["node", "postbag", "--json", "init", "--yes", "--force"], harness.deps)

    expect(calls).toBe(2)
    const written = JSON.parse(readFileSync(join(dir, "postbag.json"), "utf8")) as { form_id: string }
    expect(written.form_id).toBe("fm_2")
  })
})
