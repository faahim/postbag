import type { Command } from "commander"

import { createClient } from "@postbag/sdk"

import { type CliDeps, CliExitError, unwrap, withCommand } from "../lib/context.js"
import { removeCurrentProfile, saveProfile } from "../lib/config.js"
import { printData, printError } from "../lib/output.js"
import { promptHidden } from "../lib/prompt.js"

type LoginGlobalOpts = {
  readonly apiKey?: string
  readonly apiUrl?: string
}

export function registerAuthCommands(program: Command, deps: CliDeps): void {
  program
    .command("login")
    .description("Save an API key for this machine (verifies it against /v1/me first)")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const globalOpts = command.optsWithGlobals<LoginGlobalOpts>()
        const candidateKey = globalOpts.apiKey ?? deps.env["POSTBAG_API_KEY"] ?? (await promptHidden("API key", deps.promptIo))
        if (candidateKey.trim() === "") {
          printError(ctx.io, { code: "missing_api_key", message: "An API key is required." }, ctx.json)
          throw new CliExitError(1)
        }

        const client = createClient({ baseUrl: ctx.apiUrl, apiKey: candidateKey, fetch: deps.fetch })
        const result = await client.GET("/v1/me")
        const me = unwrap(result, ctx)

        saveProfile(
          { env: deps.env, cwd: deps.cwd, homeDir: deps.homeDir },
          "default",
          { api_url: ctx.apiUrl, api_key: candidateKey },
        )

        if (ctx.json) {
          printData(ctx.io, { ok: true, organization: me.organization }, true)
        } else {
          ctx.io.log(`Logged in to ${me.organization.name} (${me.organization.slug}) at ${ctx.apiUrl}`)
        }
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
