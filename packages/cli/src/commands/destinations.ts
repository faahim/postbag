import type { Command } from "commander"

import type { operations } from "@postbag/sdk"

import { asBody, type JsonBody } from "../lib/body.js"
import { type CliDeps, unwrap, unwrapEmpty, withCommand } from "../lib/context.js"
import { mergeBody, parseIntFlag, parseJsonFlag } from "../lib/parse.js"
import { printData } from "../lib/output.js"

type ListOpts = {
  readonly limit?: string
  readonly cursor?: string
}

type CreateOpts = {
  readonly type?: string
  readonly name?: string
  readonly config?: string
  readonly data?: string
}

type TestOpts = {
  readonly sample?: string
}

export function registerDestinationsCommands(program: Command, deps: CliDeps): void {
  const destinations = program.command("destinations").description("Where deliveries go: email, telegram, webhook, slack, discord")

  destinations
    .command("list")
    .description("List destinations (secrets redacted)")
    .option("--limit <n>", "page size")
    .option("--cursor <cursor>", "pagination cursor")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<ListOpts>()
        const query = asBody<NonNullable<operations["destinations_list"]["parameters"]["query"]>>(
          mergeBody(undefined, { limit: parseIntFlag(opts.limit, "--limit"), cursor: opts.cursor }),
        )
        const result = await ctx.client.GET("/v1/destinations", { params: { query } })
        const data = unwrap(result, ctx)
        printData(ctx.io, ctx.json ? data : data.data, ctx.json)
      })
    })

  destinations
    .command("get")
    .argument("<id>", "destination id")
    .description("Get a destination (secrets redacted)")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/destinations/{destinationId}", {
          params: { path: { destinationId: id } },
        })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  destinations
    .command("create")
    .description("Create a destination — type is one of email, telegram, webhook, slack, discord")
    .requiredOption("--type <type>", "email | telegram | webhook | slack | discord")
    .option("--name <name>", "a label to tell destinations apart")
    .option("--config <json>", "type-specific config, e.g. '{\"to\":[\"a@b.com\"]}' for email")
    .option("--data <json>", "full request body as JSON, instead of --type/--name/--config")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<CreateOpts>()
        const config = opts.config === undefined ? undefined : parseJsonFlag(opts.config)
        const body = asBody<JsonBody<operations["destinations_create"]>>(
          mergeBody(parseJsonFlag(opts.data), { type: opts.type, name: opts.name, config }),
        )
        const result = await ctx.client.POST("/v1/destinations", { body })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  destinations
    .command("test")
    .argument("<id>", "destination id")
    .description("Send a sample payload now and return the provider response")
    .option("--sample <json>", "override the default sample payload")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<TestOpts>()
        const sample = opts.sample === undefined ? undefined : parseJsonFlag(opts.sample)
        const body = asBody<JsonBody<operations["destinations_test"]>>(
          mergeBody(undefined, { sample }),
        )
        const result = await ctx.client.POST("/v1/destinations/{destinationId}/test", {
          params: { path: { destinationId: id } },
          body,
        })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  destinations
    .command("delete")
    .argument("<id>", "destination id")
    .description("Delete a destination (fails if any route still references it)")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.DELETE("/v1/destinations/{destinationId}", {
          params: { path: { destinationId: id } },
        })
        unwrapEmpty(result, ctx)
        printData(ctx.io, { ok: true, id }, ctx.json)
      })
    })
}
