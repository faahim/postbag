import type { Command } from "commander"

import type { operations } from "@postbag/sdk"

import { asBody, type JsonBody } from "../lib/body.js"
import { type CliDeps, unwrap, unwrapEmpty, withCommand } from "../lib/context.js"
import { mergeBody, parseIntFlag, parseJsonFlag } from "../lib/parse.js"
import { printData } from "../lib/output.js"

type ListOpts = {
  readonly form?: string
  readonly stream?: string
  readonly destination?: string
  readonly limit?: string
  readonly cursor?: string
}

type CreateOpts = {
  readonly from?: string
  readonly to?: string
  readonly mode?: string
  readonly cron?: string
  readonly timezone?: string
  readonly filter?: string
  readonly transform?: string
  readonly data?: string
}

export function registerRoutesCommands(program: Command, deps: CliDeps): void {
  const routes = program.command("routes").description("Ties one source (a form or a stream) to one destination")

  routes
    .command("list")
    .description("List routes")
    .option("--form <formId>", "filter to routes whose source is this form")
    .option("--stream <streamId>", "filter to routes whose source is this stream")
    .option("--destination <destinationId>", "filter to routes pointing at this destination")
    .option("--limit <n>", "page size")
    .option("--cursor <cursor>", "pagination cursor")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<ListOpts>()
        const query = asBody<NonNullable<operations["routes_list"]["parameters"]["query"]>>(
          mergeBody(undefined, {
            form: opts.form,
            stream: opts.stream,
            destination: opts.destination,
            limit: parseIntFlag(opts.limit, "--limit"),
            cursor: opts.cursor,
          }),
        )
        const result = await ctx.client.GET("/v1/routes", { params: { query } })
        const data = unwrap(result, ctx)
        printData(ctx.io, ctx.json ? data : data.data, ctx.json)
      })
    })

  routes
    .command("get")
    .argument("<id>", "route id")
    .description("Get a route")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/routes/{routeId}", { params: { path: { routeId: id } } })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  routes
    .command("create")
    .description("Create a route (source is exactly one of form:<id> / stream:<id>)")
    .requiredOption("--from <source>", "form:<id> or stream:<id>")
    .requiredOption("--to <destinationId>", "destination id")
    .option("--mode <mode>", "instant | digest (default instant)")
    .option("--cron <cron>", "cron expression, required when --mode digest")
    .option("--timezone <tz>", "IANA timezone, required when --mode digest")
    .option("--filter <expr>", "JSONata filter expression")
    .option("--transform <expr>", "JSONata transform expression")
    .option("--data <json>", "full request body as JSON, instead of the flags above")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<CreateOpts>()
        const source = parseSource(opts.from)
        const mode =
          opts.mode === undefined
            ? undefined
            : opts.mode === "digest"
              ? { type: "digest" as const, cron: opts.cron ?? "", timezone: opts.timezone ?? "UTC" }
              : { type: "instant" as const }
        const body = asBody<JsonBody<operations["routes_create"]>>(
          mergeBody(parseJsonFlag(opts.data), {
            ...source,
            destination_id: opts.to,
            mode,
            filter: opts.filter,
            transform: opts.transform,
          }),
        )
        const result = await ctx.client.POST("/v1/routes", { body })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  routes
    .command("delete")
    .argument("<id>", "route id")
    .description("Delete a route")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.DELETE("/v1/routes/{routeId}", { params: { path: { routeId: id } } })
        unwrapEmpty(result, ctx)
        printData(ctx.io, { ok: true, id }, ctx.json)
      })
    })
}

function parseSource(from: string | undefined): { form_id?: string; stream_id?: string } {
  if (from === undefined) return {}
  const [kind, id] = from.split(":", 2)
  if (kind === "form" && id !== undefined) return { form_id: id }
  if (kind === "stream" && id !== undefined) return { stream_id: id }
  throw new Error("--from must be 'form:<id>' or 'stream:<id>'.")
}
