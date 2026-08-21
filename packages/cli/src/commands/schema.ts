import { readFileSync } from "node:fs"

import type { Command } from "commander"

import { type CliDeps, unwrap, withCommand } from "../lib/context.js"
import { printData } from "../lib/output.js"

type PublishOpts = {
  readonly file?: string
  readonly data?: string
  readonly changelog?: string
}

export function registerSchemaCommands(program: Command, deps: CliDeps): void {
  const schema = program.command("schema").description("Form schema versions (immutable — publish always creates N+1)")

  schema
    .command("get")
    .argument("<formId>", "form id")
    .description("Current schema version (or the last inferred draft, for observe-mode forms)")
    .action(async (formId: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/forms/{formId}/schema", { params: { path: { formId } } })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  schema
    .command("publish")
    .argument("<formId>", "form id")
    .description("Publish a new schema version from a JSON Schema file")
    .option("--file <path>", "path to a JSON file containing { json_schema, ui?, changelog? } or a bare JSON Schema")
    .option("--data <json>", "the request body as a JSON string, instead of --file")
    .option("--changelog <text>", "short note on what changed (overrides the file's, if any)")
    .action(async (formId: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<PublishOpts>()
        const body = readSchemaBody(opts)
        const result = await ctx.client.POST("/v1/forms/{formId}/schema", {
          params: { path: { formId } },
          body,
        })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  schema
    .command("infer")
    .argument("<formId>", "form id")
    .description("Infer a draft schema from recent submissions (observe-mode forms with no schema yet)")
    .action(async (formId: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.POST("/v1/forms/{formId}/schema/infer", { params: { path: { formId } } })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  schema
    .command("versions")
    .argument("<formId>", "form id")
    .description("List all schema versions")
    .action(async (formId: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/forms/{formId}/schema/versions", {
          params: { path: { formId } },
        })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })
}

type SchemaPublishBody = {
  readonly json_schema: Record<string, unknown>
  readonly ui?: Record<string, Record<string, unknown>>
  readonly changelog?: string
}

function readSchemaBody(opts: PublishOpts): SchemaPublishBody {
  if (opts.data === undefined && opts.file === undefined) {
    throw new Error("schema publish needs either --file <path> or --data '{json}'.")
  }
  const raw = opts.data ?? readFileSync(nonNull(opts.file), "utf8")
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Schema input must be a JSON object.")
  }
  const record = parsed as Record<string, unknown>
  // Accept either `{ json_schema, ui?, changelog? }` or a bare JSON Schema document.
  const jsonSchema =
    "json_schema" in record && typeof record["json_schema"] === "object" && record["json_schema"] !== null
      ? (record["json_schema"] as Record<string, unknown>)
      : record
  const ui = "ui" in record && typeof record["ui"] === "object" && record["ui"] !== null
    ? (record["ui"] as Record<string, Record<string, unknown>>)
    : undefined
  const changelog = opts.changelog ?? (typeof record["changelog"] === "string" ? record["changelog"] : undefined)

  return {
    json_schema: jsonSchema,
    ...(ui !== undefined ? { ui } : {}),
    ...(changelog !== undefined ? { changelog } : {}),
  }
}

function nonNull(value: string | undefined): string {
  if (value === undefined) throw new Error("--file is required.")
  return value
}
