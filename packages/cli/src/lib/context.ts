import type { Command } from "commander"

import { createClient, type PostbagClient } from "@postbag/sdk"

import { type ConfigEnv, resolveConfig } from "./config.js"
import { type ApiError, type Io, printError, shouldUseJson } from "./output.js"
import type { PromptIo } from "./prompt.js"

/** Everything the CLI reaches for that would otherwise be a bare `process.*`/global call — injected so commands are testable with a fake `fetch` and an isolated filesystem/env. */
export type CliDeps = {
  readonly fetch: typeof fetch
  readonly env: Readonly<Record<string, string | undefined>>
  readonly cwd: string
  readonly homeDir: string
  readonly stdoutIsTty: boolean
  readonly io: Io
  readonly promptIo: PromptIo
}

export function defaultDeps(): CliDeps {
  return {
    fetch: globalThis.fetch,
    env: process.env,
    cwd: process.cwd(),
    homeDir: process.env["HOME"] ?? "",
    stdoutIsTty: process.stdout.isTTY,
    io: { log: (line) => { console.log(line) }, error: (line) => { console.error(line) } },
    promptIo: { input: process.stdin, output: process.stdout },
  }
}

export type Ctx = {
  readonly client: PostbagClient
  readonly json: boolean
  readonly apiUrl: string
  readonly apiKey: string | undefined
  readonly io: Io
  readonly deps: CliDeps
}

type GlobalOpts = {
  readonly apiKey?: string
  readonly apiUrl?: string
  readonly json?: boolean
}

export function buildContext(command: Command, deps: CliDeps): Ctx {
  const globalOpts = command.optsWithGlobals<GlobalOpts>()
  const configEnv: ConfigEnv = { env: deps.env, cwd: deps.cwd, homeDir: deps.homeDir }
  const resolved = resolveConfig(
    {
      ...(globalOpts.apiKey !== undefined ? { apiKey: globalOpts.apiKey } : {}),
      ...(globalOpts.apiUrl !== undefined ? { apiUrl: globalOpts.apiUrl } : {}),
    },
    configEnv,
  )
  const json = shouldUseJson(globalOpts.json, deps.stdoutIsTty)
  const client = createClient({
    baseUrl: resolved.apiUrl,
    ...(resolved.apiKey !== undefined ? { apiKey: resolved.apiKey } : {}),
    fetch: deps.fetch,
  })
  return { client, json, apiUrl: resolved.apiUrl, apiKey: resolved.apiKey, io: deps.io, deps }
}

/** Thrown after an error has already been printed, to unwind to the top without printing twice. */
export class CliExitError extends Error {
  readonly exitCode: number
  constructor(exitCode = 1) {
    super(`cli exit ${String(exitCode)}`)
    this.exitCode = exitCode
  }
}

/** Runs a command body, resolving config/client from `command` and rendering any error uniformly. */
export async function withCommand(
  command: Command,
  deps: CliDeps,
  work: (ctx: Ctx) => Promise<void> | void,
): Promise<void> {
  const ctx = buildContext(command, deps)
  try {
    await work(ctx)
  } catch (err) {
    if (err instanceof CliExitError) {
      process.exitCode = err.exitCode
      return
    }
    const message = err instanceof Error ? err.message : String(err)
    printError(ctx.io, { code: "cli_error", message }, ctx.json)
    process.exitCode = 1
  }
}

type ErrorLike = { readonly error?: unknown }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/** Best-effort extraction of `{ error: { code, message, hint, docs, details } }` (the `ErrorEnvelope`). */
export function extractApiError(body: unknown): ApiError {
  const errObj = isRecord(body) && isRecord(body["error"]) ? body["error"] : undefined
  const code = errObj !== undefined && typeof errObj["code"] === "string" ? errObj["code"] : "unknown_error"
  const message =
    errObj !== undefined && typeof errObj["message"] === "string" ? errObj["message"] : "Request failed."
  const hint = errObj !== undefined && typeof errObj["hint"] === "string" ? errObj["hint"] : undefined
  const docs = errObj !== undefined && typeof errObj["docs"] === "string" ? errObj["docs"] : undefined
  const details = errObj !== undefined && isRecord(errObj["details"]) ? errObj["details"] : undefined
  return {
    code,
    message,
    ...(hint !== undefined ? { hint } : {}),
    ...(docs !== undefined ? { docs } : {}),
    ...(details !== undefined ? { details } : {}),
  }
}

/**
 * Unwraps an `openapi-fetch` result: prints and throws `CliExitError` on an API error,
 * otherwise returns `data`. Every SDK call in the CLI goes through this.
 */
export function unwrap<T>(result: { data?: T; error?: unknown }, ctx: Ctx): T {
  if (result.error !== undefined) {
    printError(ctx.io, extractApiError(result.error), ctx.json)
    throw new CliExitError(1)
  }
  if (result.data === undefined) {
    printError(ctx.io, { code: "empty_response", message: "The server returned no data." }, ctx.json)
    throw new CliExitError(1)
  }
  return result.data
}

/** For 204 No Content responses: throws the same way `unwrap` does, otherwise returns void. */
export function unwrapEmpty(result: ErrorLike, ctx: Ctx): void {
  if (result.error !== undefined) {
    printError(ctx.io, extractApiError(result.error), ctx.json)
    throw new CliExitError(1)
  }
}
