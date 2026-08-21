import type { Command } from "commander"

import type { operations } from "@postbag/sdk"

import { asBody, type JsonBody } from "../lib/body.js"
import { type CliDeps, unwrap, unwrapEmpty, withCommand } from "../lib/context.js"
import { mergeBody, splitList } from "../lib/parse.js"
import { printData } from "../lib/output.js"

type CreateOpts = {
  readonly name?: string
  readonly scopes?: string
}

export function registerApiKeysCommands(program: Command, deps: CliDeps): void {
  const apiKeys = program.command("api-keys").description("API keys for the active organization")

  apiKeys
    .command("list")
    .description("List API keys (prefixes only — full values are never returned again)")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/api-keys")
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  apiKeys
    .command("create")
    .description("Create an API key (requires a signed-in dashboard session, not another API key)")
    .option("--name <name>", "a label to tell keys apart, e.g. 'CI deploy key'")
    .option("--scopes <a,b>", "comma-separated: manage, read, submit (default: manage)")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<CreateOpts>()
        const body = asBody<JsonBody<operations["api_keys_create"]>>(
          mergeBody(undefined, { name: opts.name, scopes: splitList(opts.scopes) }),
        )
        const result = await ctx.client.POST("/v1/api-keys", { body })
        const data = unwrap(result, ctx)
        if (!ctx.json) {
          ctx.io.log("Store this key now — it will not be shown again.")
        }
        printData(ctx.io, data, ctx.json)
      })
    })

  apiKeys
    .command("revoke")
    .argument("<id>", "API key id")
    .description("Revoke an API key immediately")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.DELETE("/v1/api-keys/{id}", { params: { path: { id } } })
        unwrapEmpty(result, ctx)
        printData(ctx.io, { ok: true, id }, ctx.json)
      })
    })
}
