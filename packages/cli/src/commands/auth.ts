import { hostname } from "node:os"

import type { Command } from "commander"

import { createClient } from "@postbag/sdk"

import { type CliDeps, type Ctx, CliExitError, unwrap, withCommand } from "../lib/context.js"
import { removeCurrentProfile, saveProfile } from "../lib/config.js"
import { printData, printError } from "../lib/output.js"
import { prompt } from "../lib/prompt.js"

type LoginGlobalOpts = {
  readonly apiKey?: string
  readonly apiUrl?: string
}

type LoginOpts = {
  readonly email?: string
  readonly code?: string
}

/** `pb_live_…` / `pb_test_…` — the same prefixes `defaultPrefix`/tests use elsewhere. */
function looksLikeApiKey(value: string): boolean {
  return value.startsWith("pb_live_") || value.startsWith("pb_test_")
}

function saveAndReportOrg(
  ctx: Ctx,
  deps: CliDeps,
  apiKey: string,
  organization: { readonly name: string; readonly slug: string },
): void {
  saveProfile({ env: deps.env, cwd: deps.cwd, homeDir: deps.homeDir }, "default", { api_url: ctx.apiUrl, api_key: apiKey })
  if (ctx.json) {
    printData(ctx.io, { ok: true, organization }, true)
  } else {
    ctx.io.log(`Logged in to ${organization.name} (${organization.slug}) at ${ctx.apiUrl}`)
  }
}

/** The pre-existing path: an API key (flag, env, or pasted at the prompt), verified against /v1/me. */
async function loginWithApiKey(ctx: Ctx, deps: CliDeps, apiKey: string): Promise<void> {
  if (apiKey.trim() === "") {
    printError(ctx.io, { code: "missing_api_key", message: "An API key is required." }, ctx.json)
    throw new CliExitError(1)
  }
  const client = createClient({ baseUrl: ctx.apiUrl, apiKey, fetch: deps.fetch })
  const result = await client.GET("/v1/me")
  const me = unwrap(result, ctx)
  saveAndReportOrg(ctx, deps, apiKey, me.organization)
}

/** Step 1 of the code flow: POST /v1/auth/request-code. Public — no key needed yet. */
async function requestCode(ctx: Ctx, email: string): Promise<void> {
  const result = await ctx.client.POST("/v1/auth/request-code", { body: { email } })
  unwrap(result, ctx)
  ctx.io.log(`Code sent to ${email} — check your inbox`)
}

/** Step 2: POST /v1/auth/verify-code. Mints and saves the key; prints the org name. */
async function verifyCodeAndSave(ctx: Ctx, deps: CliDeps, email: string, code: string): Promise<void> {
  const keyName = `postbag-cli · ${hostname()}`
  const result = await ctx.client.POST("/v1/auth/verify-code", { body: { email, code, key_name: keyName } })
  const data = unwrap(result, ctx)
  saveAndReportOrg(ctx, deps, data.api_key, data.organization)
}

export function registerAuthCommands(program: Command, deps: CliDeps): void {
  program
    .command("login")
    .description(
      "Save an API key for this machine — paste one, or get one by email code (no browser needed)",
    )
    .option("--email <addr>", "request (or, with --code, verify) a sign-in code for this email — non-interactive")
    .option("--code <digits>", "the 6-digit code from the email (requires --email)")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const globalOpts = command.optsWithGlobals<LoginGlobalOpts>()
        const opts = command.opts<LoginOpts>()

        // An explicit key (flag or env) always wins and behaves exactly as before —
        // scripts already relying on POSTBAG_API_KEY / --api-key see no change.
        const explicitKey = globalOpts.apiKey ?? deps.env["POSTBAG_API_KEY"]
        if (explicitKey !== undefined) {
          await loginWithApiKey(ctx, deps, explicitKey)
          return
        }

        // Two-invocation non-interactive flow, for an agent driving this without a TTY:
        //   postbag login --email a@b.c            → sends the code
        //   postbag login --email a@b.c --code 123456 → verifies and saves the key
        if (opts.email !== undefined) {
          if (opts.code !== undefined) {
            await verifyCodeAndSave(ctx, deps, opts.email, opts.code)
          } else {
            await requestCode(ctx, opts.email)
          }
          return
        }

        // Fully interactive: one merged prompt accepts either an email or a pasted key.
        const input = await prompt("Email (or paste an API key)", undefined, deps.promptIo)
        if (input.trim() === "") {
          printError(ctx.io, { code: "missing_input", message: "An email or API key is required." }, ctx.json)
          throw new CliExitError(1)
        }
        if (looksLikeApiKey(input.trim())) {
          await loginWithApiKey(ctx, deps, input.trim())
          return
        }
        const email = input.trim()
        await requestCode(ctx, email)
        const code = await prompt("Code", undefined, deps.promptIo)
        await verifyCodeAndSave(ctx, deps, email, code)
      })
    })

  program
    .command("logout")
    .description("Forget the saved API key")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, (ctx) => {
        const removed = removeCurrentProfile({ env: deps.env, cwd: deps.cwd, homeDir: deps.homeDir })
        if (ctx.json) {
          printData(ctx.io, { ok: true, removed }, true)
        } else {
          ctx.io.log(removed ? "Logged out." : "Not logged in.")
        }
      })
    })

  program
    .command("whoami")
    .description("Show the caller's organization, key scopes, plan limits and usage (GET /v1/me)")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/me")
        const me = unwrap(result, ctx)
        printData(ctx.io, me, ctx.json)
      })
    })
}
