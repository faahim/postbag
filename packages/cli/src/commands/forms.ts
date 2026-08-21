import type { Command } from "commander"

import type { operations } from "@postbag/sdk"

import { asBody, type JsonBody } from "../lib/body.js"
import { type CliDeps, unwrap, unwrapEmpty, withCommand } from "../lib/context.js"
import { mergeBody, parseIntFlag, parseJsonFlag, splitList } from "../lib/parse.js"
import { printData } from "../lib/output.js"

type ListOpts = {
  readonly project?: string
  readonly tag?: string
  readonly stream?: string
  readonly limit?: string
  readonly cursor?: string
}

type CreateOpts = {
  readonly name?: string
  readonly slug?: string
  readonly project?: string
  readonly tags?: string
  readonly status?: "active" | "paused"
  readonly schemaMode?: "observe" | "enforce" | "managed"
  readonly fromTemplate?: string
  readonly ifExists?: "error" | "return"
  readonly data?: string
}

type UpdateOpts = CreateOpts

function createBody(opts: CreateOpts): JsonBody<operations["forms_create"]> {
  const merged = mergeBody(parseJsonFlag(opts.data), {
    name: opts.name,
    slug: opts.slug,
    project: opts.project,
    tags: splitList(opts.tags),
    status: opts.status,
    schema_mode: opts.schemaMode,
    from_template: opts.fromTemplate,
    if_exists: opts.ifExists,
  })
  return asBody(merged)
}

export function registerFormsCommands(program: Command, deps: CliDeps): void {
  const forms = program.command("forms").description("Manage forms — endpoints that receive submissions")

  forms
    .command("list")
    .description("List forms")
    .option("--project <slug>", "filter to one project")
    .option("--tag <tag>", "filter to forms carrying this tag")
    .option("--stream <streamId>", "filter to forms attached to this stream")
    .option("--limit <n>", "page size")
    .option("--cursor <cursor>", "pagination cursor")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<ListOpts>()
        const query = asBody<NonNullable<operations["forms_list"]["parameters"]["query"]>>(
          mergeBody(undefined, {
            project: opts.project,
            tag: opts.tag,
            stream: opts.stream,
            limit: parseIntFlag(opts.limit, "--limit"),
            cursor: opts.cursor,
          }),
        )
        const result = await ctx.client.GET("/v1/forms", { params: { query } })
        const data = unwrap(result, ctx)
        printData(ctx.io, ctx.json ? data : data.data, ctx.json)
      })
    })

  forms
    .command("get")
    .argument("<id>", "form id")
    .description("Get a form")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/forms/{formId}", { params: { path: { formId: id } } })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  forms
    .command("create")
    .description("Create a form")
    .option("--name <name>", "form name")
    .option("--slug <slug>", "form slug")
    .option("--project <slug>", "project slug (default: 'default')")
    .option("--tags <a,b>", "comma-separated tags")
    .option("--status <status>", "active | paused")
    .option("--schema-mode <mode>", "observe | enforce | managed")
    .option("--from-template <streamId>", "attach to a stream, copying its schema")
    .option("--if-exists <mode>", "error | return — 'return' makes this call safe to re-run")
    .option("--data <json>", "full request body as JSON (merged under any flags above)")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<CreateOpts>()
        const result = await ctx.client.POST("/v1/forms", { body: createBody(opts) })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  forms
    .command("update")
    .argument("<id>", "form id")
    .description("Update a form")
    .option("--name <name>", "form name")
    .option("--slug <slug>", "form slug")
    .option("--project <slug>", "project slug")
    .option("--tags <a,b>", "comma-separated tags")
    .option("--status <status>", "active | paused")
    .option("--schema-mode <mode>", "observe | enforce | managed")
    .option("--data <json>", "full request body as JSON (merged under any flags above)")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<UpdateOpts>()
        const result = await ctx.client.PATCH("/v1/forms/{formId}", {
          params: { path: { formId: id } },
          body: createBody(opts),
        })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  forms
    .command("delete")
    .argument("<id>", "form id")
    .description("Delete a form")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.DELETE("/v1/forms/{formId}", { params: { path: { formId: id } } })
        unwrapEmpty(result, ctx)
        printData(ctx.io, { ok: true, id }, ctx.json)
      })
    })

  forms
    .command("embed")
    .argument("<id>", "form id")
    .description("Ready-to-paste HTML/fetch/React/Astro/Next.js embed snippets for this form")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/forms/{formId}/embed", { params: { path: { formId: id } } })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })
}
