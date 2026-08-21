import type { Command } from "commander"

import { type CliDeps, CliExitError, extractApiError, withCommand } from "../lib/context.js"
import { parseJsonFlag } from "../lib/parse.js"
import { printData, printError } from "../lib/output.js"
import { rawRequest } from "../lib/rawRequest.js"

const HTTP_METHODS = new Set(["GET", "POST", "PATCH", "PUT", "DELETE"])

type ApiOpts = {
  readonly data?: string
}

export function registerMiscCommands(program: Command, deps: CliDeps): void {
  program
    .command("explain")
    .description("Print the agent onboarding page (GET /llms.txt) — what Postbag is, and the calls that matter")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await rawRequest(ctx, "GET", "/llms.txt")
        if (!result.ok) {
          printError(ctx.io, { code: `http_${String(result.status)}`, message: result.text || "Request failed." }, ctx.json)
          throw new CliExitError(1)
        }
        if (ctx.json) {
          printData(ctx.io, { text: result.text }, true)
        } else {
          ctx.io.log(result.text)
        }
      })
    })

  program
    .command("openapi")
    .description("Print the full API contract (GET /openapi.json)")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await rawRequest(ctx, "GET", "/openapi.json")
        if (!result.ok) {
          printError(ctx.io, extractApiError(result.json), ctx.json)
          throw new CliExitError(1)
        }
        printData(ctx.io, result.json ?? result.text, true)
      })
    })

  program
    .command("api")
    .description("Escape hatch: call any Postbag API path directly, with the same auth/output rules")
    .argument("<method>", "HTTP method: GET, POST, PATCH, PUT or DELETE")
    .argument("<path>", "API path, e.g. /v1/forms")
    .option("--data <json>", "request body as a JSON string")
    .action(async (method: string, path: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<ApiOpts>()
        const upperMethod = method.toUpperCase()
        if (!HTTP_METHODS.has(upperMethod)) {
          throw new Error(`Unsupported method '${method}'. Use GET, POST, PATCH, PUT or DELETE.`)
        }
        const body = parseJsonFlag(opts.data)
        const result = await rawRequest(ctx, upperMethod, path, body)
        if (!result.ok) {
          printError(ctx.io, extractApiError(result.json ?? { error: { code: `http_${String(result.status)}`, message: result.text } }), ctx.json)
          throw new CliExitError(1)
        }
        printData(ctx.io, result.json ?? result.text, ctx.json)
      })
    })
}
