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
  readonly name?: string
  readonly slug?: string
  readonly data?: string
}

type SourceAddOpts = {
  readonly form?: string
  readonly mapping?: string
  readonly data?: string
}

export function registerStreamsCommands(program: Command, deps: CliDeps): void {
  const streams = program.command("streams").description("Manage Streams — one canonical Schema fed by many Forms")

  streams
    .command("list")
    .description("List streams")
    .option("--limit <n>", "page size")
    .option("--cursor <cursor>", "pagination cursor")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<ListOpts>()
        const query = asBody<NonNullable<operations["streams_list"]["parameters"]["query"]>>(
          mergeBody(undefined, { limit: parseIntFlag(opts.limit, "--limit"), cursor: opts.cursor }),
        )
        const result = await ctx.client.GET("/v1/streams", { params: { query } })
        const data = unwrap(result, ctx)
        printData(ctx.io, ctx.json ? data : data.data, ctx.json)
      })
    })

  streams
    .command("get")
    .argument("<id>", "stream id")
    .description("Get a stream with schema, sources, mapping status and routes")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/streams/{streamId}", { params: { path: { streamId: id } } })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  streams
    .command("create")
    .description("Create a stream (optionally with its first schema version and sources)")
    .option("--name <name>", "stream name")
    .option("--slug <slug>", "stream slug")
    .option("--data <json>", "full request body as JSON — the only way to pass schema/sources from flags")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<CreateOpts>()
        const body = asBody<JsonBody<operations["streams_create"]>>(
          mergeBody(parseJsonFlag(opts.data), { name: opts.name, slug: opts.slug }),
        )
        const result = await ctx.client.POST("/v1/streams", { body })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  streams
    .command("delete")
    .argument("<id>", "stream id")
    .description("Delete a stream")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.DELETE("/v1/streams/{streamId}", { params: { path: { streamId: id } } })
        unwrapEmpty(result, ctx)
        printData(ctx.io, { ok: true, id }, ctx.json)
      })
    })

  const sources = streams.command("sources").description("Forms feeding a stream, with their field mapping")

  sources
    .command("list")
    .argument("<streamId>", "stream id")
    .description("List sources and their mapping status")
    .action(async (streamId: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/streams/{streamId}/sources", {
          params: { path: { streamId } },
        })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  sources
    .command("add")
    .argument("<streamId>", "stream id")
    .description(
      "Attach a form to a stream with a field mapping (a stream with no schema yet takes its version 1 from this form)",
    )
    .requiredOption("--form <formId>", "the form feeding this stream")
    .option(
      "--mapping <json>",
      'mapping object keyed by stream schema field, e.g. \'{"email":{"from":"work_email"}}\' (omit on an empty stream for an identity mapping)',
    )
    .option("--data <json>", "full request body as JSON, instead of --form/--mapping")
    .action(async (streamId: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<SourceAddOpts>()
        const mapping = opts.mapping === undefined ? undefined : parseJsonFlag(opts.mapping)
        const body = asBody<JsonBody<operations["streams_sources_add"]>>(
          mergeBody(parseJsonFlag(opts.data), { form_id: opts.form, mapping }),
        )
        const result = await ctx.client.POST("/v1/streams/{streamId}/sources", {
          params: { path: { streamId } },
          body,
        })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  sources
    .command("remove")
    .argument("<streamId>", "stream id")
    .argument("<sourceId>", "source id")
    .description("Detach a source from a stream")
    .action(async (streamId: string, sourceId: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.DELETE("/v1/streams/{streamId}/sources/{sourceId}", {
          params: { path: { streamId, sourceId } },
        })
        unwrapEmpty(result, ctx)
        printData(ctx.io, { ok: true, id: sourceId }, ctx.json)
      })
    })
}
