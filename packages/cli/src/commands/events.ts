import type { Command } from "commander"

import type { operations } from "@postbag/sdk"

import { asBody } from "../lib/body.js"
import { type CliDeps, unwrap, withCommand } from "../lib/context.js"
import { mergeBody, parseIntFlag } from "../lib/parse.js"
import { printData } from "../lib/output.js"

type ListOpts = {
  readonly type?: string
  readonly since?: string
  readonly limit?: string
  readonly cursor?: string
}

export function registerEventsCommands(program: Command, deps: CliDeps): void {
  const events = program
    .command("events")
    .description("Organization event log — form.created, submission.received, and more")

  events
    .command("list")
    .description("List events")
    .option("--type <type>", "filter to one event type, e.g. 'submission.received'")
    .option("--since <iso>", "only events after this ISO timestamp")
    .option("--limit <n>", "page size")
    .option("--cursor <cursor>", "pagination cursor")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<ListOpts>()
        const query = asBody<NonNullable<operations["events_list"]["parameters"]["query"]>>(
          mergeBody(undefined, {
            type: opts.type,
            since: opts.since,
            limit: parseIntFlag(opts.limit, "--limit"),
            cursor: opts.cursor,
          }),
        )
        const result = await ctx.client.GET("/v1/events", { params: { query } })
        const data = unwrap(result, ctx)
        printData(ctx.io, ctx.json ? data : data.data, ctx.json)
      })
    })
}
