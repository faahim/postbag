import type { Command } from "commander"

import type { operations } from "@postbag/sdk"

import { asBody, type JsonBody } from "../lib/body.js"
import { type CliDeps, unwrap, unwrapEmpty, withCommand } from "../lib/context.js"
import { mergeBody, parseJsonFlag, splitList } from "../lib/parse.js"
import { printData } from "../lib/output.js"

type CreateOpts = {
  readonly url?: string
  readonly events?: string
  readonly secret?: string
  readonly data?: string
}

export function registerWebhooksCommands(program: Command, deps: CliDeps): void {
  const webhooks = program.command("webhooks").description("System webhooks — subscribe a URL to organization events")

  webhooks
    .command("list")
    .description("List system webhooks")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/webhooks")
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  webhooks
    .command("create")
    .description("Subscribe a URL to one or more event types")
    .requiredOption("--url <url>", "URL to receive the webhook")
    .requiredOption("--events <a,b>", "comma-separated event types, e.g. submission.received,delivery.failed")
    .option("--secret <secret>", "signing secret (generated if omitted)")
    .option("--data <json>", "full request body as JSON, instead of the flags above")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<CreateOpts>()
        const body = asBody<JsonBody<operations["webhooks_create"]>>(
          mergeBody(parseJsonFlag(opts.data), {
            url: opts.url,
            events: splitList(opts.events),
            secret: opts.secret,
          }),
        )
        const result = await ctx.client.POST("/v1/webhooks", { body })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  webhooks
    .command("delete")
    .argument("<id>", "webhook id")
    .description("Delete a system webhook")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.DELETE("/v1/webhooks/{webhookId}", { params: { path: { webhookId: id } } })
        unwrapEmpty(result, ctx)
        printData(ctx.io, { ok: true, id }, ctx.json)
      })
    })
}
