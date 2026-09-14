import { execFileSync } from "node:child_process"

import { describe, expect, it } from "vitest"

import { EXAMPLE } from "../config"

import {
  CURL_TEST,
  DESTINATION_GUIDES,
  FRAMEWORK_GUIDES,
  GUIDES,
  SANDBOX_CREATE,
  SANDBOX_STATUS,
  SUBMIT_URL,
} from "./guides"

function executableCode(guide: ReturnType<typeof FRAMEWORK_GUIDES>[number]): string {
  return guide.steps
    .flatMap((step) => [step.code, step.extra])
    .map((code) => (code === undefined || code.lang === "json" ? "" : code.code))
    .join("\n")
}

const SHELL_FIXTURES = [
  "npx() {",
  '  if [[ "$*" == *"sandbox create"* ]]; then',
  `    printf '%s\\n' '{"sandbox":{"id":"fm_fixture","submit_url":"https://postbag.dev/s/fm_fixture"},"sandbox_token":"pbs_fixture","claim_url":"https://postbag.dev/app/claim#token=pbs_fixture"}'`,
  "  else",
  '    [[ "$POSTBAG_SANDBOX_TOKEN" == "pbs_fixture" ]] || return 1',
  "    printf '%s\\n' 'Sandbox fixture found'",
  "  fi",
  "}",
  "curl() {",
  "  local body='' next_is_body=0 url=''",
  '  for arg in "$@"; do',
  '    if (( next_is_body )); then body="$arg"; next_is_body=0',
  "    elif [[ \"$arg\" == '-d' ]]; then next_is_body=1",
  '    elif [[ "$arg" == http* ]]; then url="$arg"',
  "    fi",
  "  done",
  '  case "$url" in',
  "    https://postbag.dev/s/fm_fixture) printf '%s\\n' '{\"id\":\"sb_fixture\"}' ;;",
  "    https://postbag.dev/v1/destinations) printf '%s\\n' '{\"id\":\"ds_fixture\"}' ;;",
  "    https://postbag.dev/v1/destinations/ds_fixture/test) printf '%s\\n' '{\"ok\":true}' ;;",
  "    https://postbag.dev/v1/routes)",
  `      jq -e '.form_id == "fm_fixture" and .destination_id == "ds_fixture"' <<<"$body" >/dev/null || return 1`,
  "      printf '%s\\n' '{\"id\":\"rt_fixture\"}'",
  "      ;;",
  "    *) return 1 ;;",
  "  esac",
  "}",
].join("\n")

function runShell(code: string): string {
  return execFileSync("bash", ["-c", `set -euo pipefail\n${SHELL_FIXTURES}\n${code}`], {
    encoding: "utf8",
  })
}

describe("public cloneable examples", () => {
  it("points only the HTML, Astro and Next.js guides at the real public repos", () => {
    const expected: Record<string, string> = {
      html: "https://github.com/faahim/postbag-html-contact-form",
      astro: "https://github.com/faahim/postbag-astro-contact-form",
      nextjs: "https://github.com/faahim/postbag-next-contact-form",
    }

    for (const guide of GUIDES) {
      const href = expected[guide.slug]
      if (href === undefined) {
        expect(guide.cloneExample).toBeUndefined()
        continue
      }
      expect(guide.cloneExample?.href).toBe(href)
      expect(guide.cloneExample?.label.toLowerCase()).toContain("clone this working example")
    }
  })
})

describe("guide command sequences", () => {
  it("reuses each framework sandbox response instead of example ids", () => {
    expect(FRAMEWORK_GUIDES()).toHaveLength(10)

    for (const guide of FRAMEWORK_GUIDES()) {
      const code = executableCode(guide)

      expect(guide.steps[0]?.code).toBe(SANDBOX_CREATE)
      expect(guide.needs.join(" ")).toContain("jq")
      expect(code).toContain(SUBMIT_URL)
      expect(code).toContain('"$submit_url"')
      expect(code).toContain('"$sandbox_token"')
      expect(code).toContain('"$form_id"')
      expect(code).toContain('"$destination_id"')
      expect(code).not.toContain(EXAMPLE.form)
      expect(code).not.toContain(EXAMPLE.destination)
    }
  })

  it("reuses each Destination create response for its test and Route", () => {
    expect(DESTINATION_GUIDES()).toHaveLength(4)

    for (const guide of DESTINATION_GUIDES()) {
      const code = executableCode(guide)

      expect(guide.needs.join(" ")).toContain("jq")
      expect(code).toContain("destination_json=")
      expect(code).toContain("jq -er '.id'")
      expect(code).toContain('/v1/destinations/"$destination_id"/test')
      expect(code).toContain('--arg form_id "$form_id"')
      expect(code).toContain('--arg destination_id "$destination_id"')
      expect(code).not.toContain(EXAMPLE.form)
      expect(code).not.toContain(EXAMPLE.destination)
    }
  })

  it("runs the generated shell sequences against contract-shaped fixture responses", () => {
    for (const guide of FRAMEWORK_GUIDES()) {
      const delivery = guide.steps.find((step) => step.h === "Turn on email")?.code
      expect(delivery).toBeDefined()

      const output = runShell(
        [SANDBOX_CREATE.code, CURL_TEST.code, SANDBOX_STATUS.code, delivery?.code ?? ""].join("\n"),
      )
      expect(output).toContain("Form ID: fm_fixture")
      expect(output).toContain("Sandbox fixture found")
      expect(output).toContain('"id":"rt_fixture"')
    }

    for (const guide of DESTINATION_GUIDES()) {
      const shell = guide.steps
        .map((step) => step.code?.code ?? "")
        .filter((code) =>
          ["destination_json=", '/v1/destinations/"$destination_id"/test', "route_body="].some(
            (marker) => code.includes(marker),
          ),
        )
        .join("\n")

      expect(runShell(shell.replaceAll("fm_YOUR_FORM_ID", "fm_fixture"))).toContain(
        '"id":"rt_fixture"',
      )
    }
  })
})
