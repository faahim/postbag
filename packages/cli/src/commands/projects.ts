import type { Command } from "commander"

import type { operations } from "@postbag/sdk"

import { asBody, type JsonBody } from "../lib/body.js"
import { type CliDeps, unwrap, withCommand } from "../lib/context.js"
import { mergeBody, parseIntFlag, parseJsonFlag, splitList } from "../lib/parse.js"
import { printData } from "../lib/output.js"

type ListOpts = {
  readonly limit?: string
  readonly cursor?: string
}

type CreateOpts = {
  readonly name?: string
  readonly slug?: string
  readonly tags?: string
  readonly ifExists?: "error" | "return"
  readonly data?: string
}

export function registerProjectsCommands(program: Command, deps: CliDeps): void {
  const projects = program.command("projects").description("Projects group forms — one per site or app")

  projects
    .command("list")
    .description("List projects")
    .option("--limit <n>", "page size")
    .option("--cursor <cursor>", "pagination cursor")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<ListOpts>()
        const query = asBody<NonNullable<operations["projects_list"]["parameters"]["query"]>>(
          mergeBody(undefined, { limit: parseIntFlag(opts.limit, "--limit"), cursor: opts.cursor }),
        )
        const result = await ctx.client.GET("/v1/projects", { params: { query } })
        const data = unwrap(result, ctx)
        printData(ctx.io, ctx.json ? data : data.data, ctx.json)
      })
    })

  projects
    .command("create")
    .description("Create a project")
    .option("--name <name>", "project name")
    .option("--slug <slug>", "project slug")
    .option("--tags <a,b>", "comma-separated tags")
    .option("--if-exists <mode>", "error | return — 'return' makes this call safe to re-run")
    .option("--data <json>", "full request body as JSON (merged under any flags above)")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<CreateOpts>()
        const body = asBody<JsonBody<operations["projects_create"]>>(
          mergeBody(parseJsonFlag(opts.data), {
            name: opts.name,
            slug: opts.slug,
            tags: splitList(opts.tags),
            if_exists: opts.ifExists,
          }),
        )
        const result = await ctx.client.POST("/v1/projects", { body })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })
}
