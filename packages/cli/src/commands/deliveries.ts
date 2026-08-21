import type { Command } from "commander"

import type { operations } from "@postbag/sdk"

import { asBody } from "../lib/body.js"
import { type CliDeps, unwrap, withCommand } from "../lib/context.js"
import { mergeBody, parseIntFlag } from "../lib/parse.js"
import { printData } from "../lib/output.js"

type ListOpts = {
  readonly status?: string
  readonly route?: string
  readonly destination?: string
  readonly submission?: string
  readonly limit?: string
  readonly cursor?: string
}

export function registerDeliveriesCommands(program: Command, deps: CliDeps): void {
  const deliveries = program.command("deliveries").description("The outbox — every delivery attempt to a destination")

  deliveries
    .command("list")
    .description("List deliveries")
    .option("--status <status>", "pending | sending | sent | failed | dead | skipped")
    .option("--route <routeId>", "filter to one route")
    .option("--destination <destinationId>", "filter to one destination")
    .option("--submission <submissionId>", "filter to one submission")
    .option("--limit <n>", "page size")
    .option("--cursor <cursor>", "pagination cursor")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<ListOpts>()
        const query = asBody<NonNullable<operations["deliveries_list"]["parameters"]["query"]>>(
          mergeBody(undefined, {
            status: opts.status,
            route: opts.route,
            destination: opts.destination,
            submission: opts.submission,
            limit: parseIntFlag(opts.limit, "--limit"),
            cursor: opts.cursor,
          }),
        )
        const result = await ctx.client.GET("/v1/deliveries", { params: { query } })
        const data = unwrap(result, ctx)
        printData(ctx.io, ctx.json ? data : data.data, ctx.json)
      })
    })

  deliveries
    .command("get")
    .argument("<id>", "delivery id")
    .description("Get a delivery with its payload snapshot and last response")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/deliveries/{deliveryId}", {
          params: { path: { deliveryId: id } },
        })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  deliveries
    .command("retry")
    .argument("<id>", "delivery id")
    .description("Re-snapshot the payload and queue the delivery again")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.POST("/v1/deliveries/{deliveryId}/retry", {
          params: { path: { deliveryId: id } },
        })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })
}
