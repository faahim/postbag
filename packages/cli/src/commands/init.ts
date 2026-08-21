import { basename } from "node:path"

import type { Command } from "commander"

import type { operations } from "@postbag/sdk"

import type { JsonBody } from "../lib/body.js"
import { type CliDeps, unwrap, withCommand } from "../lib/context.js"
import { readPostbagJson, writePostbagJson } from "../lib/config.js"
import { printData } from "../lib/output.js"
import { prompt } from "../lib/prompt.js"

type InitOpts = {
  readonly name?: string
  readonly email?: string
  readonly telegram?: string
  readonly telegramBotToken?: string
  readonly project?: string
  readonly yes?: boolean
  readonly force?: boolean
}

export function registerInitCommand(program: Command, deps: CliDeps): void {
  program
    .command("init")
    .description("One call to a working, routed form — writes postbag.json into this repo")
    .option("--name <name>", "form name (default: the current directory's name)")
    .option("--email <to>", "notification email (default, with --yes: the account email from /v1/me)")
    .option("--telegram <chatId>", "Telegram chat id to notify")
    .option(
      "--telegram-bot-token <token>",
      "bot token for --telegram (default: POSTBAG_TELEGRAM_BOT_TOKEN env var)",
    )
    .option("--project <slug>", "project slug (default: 'default')")
    .option("--yes", "skip prompts, using defaults for anything not passed as a flag")
    .option("--force", "re-run quickstart even if postbag.json already has a form_id")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<InitOpts>()
        const existing = readPostbagJson(deps.cwd)
        if (existing?.form_id !== undefined && opts.force !== true) {
          if (ctx.json) {
            printData(ctx.io, existing, true)
          } else {
            ctx.io.log(`Already initialized: form_id=${existing.form_id} submit_url=${existing.submit_url ?? ""}`)
            ctx.io.log("Pass --force to run quickstart again.")
          }
          return
        }

        const cwdName = basename(deps.cwd)
        let name = opts.name
        let email = opts.email
        if (opts.yes !== true) {
          name = await prompt("Form name", name ?? cwdName, deps.promptIo)
          if (email === undefined) {
            email = await prompt("Notification email (blank to skip)", "", deps.promptIo)
            if (email === "") email = undefined
          }
        } else {
          name = name ?? cwdName
          // Spec (job-F-cli-mcp.md §Phase 2): "--yes ... email = the account email from
          // /v1/me". As shipped, GET /v1/me's response has no email field (see its schema
          // in api/openapi.yaml) — there is nothing to default to. We leave `email`
          // unset in that case: quickstart still succeeds, it just won't create an email
          // destination unless --email or --telegram was passed.
        }

        const body: JsonBody<operations["quickstart"]> = {
          name,
          ...(opts.project !== undefined ? { project: opts.project } : {}),
          ...(email !== undefined ? { notify_email: email } : {}),
          ...(opts.telegram !== undefined
            ? {
                telegram: {
                  bot_token: opts.telegramBotToken ?? deps.env["POSTBAG_TELEGRAM_BOT_TOKEN"] ?? "",
                  chat_id: opts.telegram,
                },
              }
            : {}),
        }

        const result = await ctx.client.POST("/v1/quickstart", { body })
        const data = unwrap(result, ctx)

        const written = writePostbagJson(deps.cwd, {
          form_id: data.form.id,
          submit_url: data.form.submit_url,
          project: opts.project ?? "default",
          api_url: ctx.apiUrl,
        })

        if (ctx.json) {
          printData(ctx.io, { ...data, postbag_json: written }, true)
          return
        }

        ctx.io.log(`Created form '${data.form.name}' (${data.form.id})`)
        ctx.io.log(`Submit URL: ${data.form.submit_url}`)
        ctx.io.log("")
        ctx.io.log("Embed snippet:")
        ctx.io.log(data.embed.html)
        if (data.next.length > 0) {
          ctx.io.log("")
          ctx.io.log("Next steps:")
          for (const step of data.next) {
            const why = step.why ?? ""
            const call = [step.method, step.path].filter((part) => part !== undefined).join(" ")
            ctx.io.log(`  - ${why}${call === "" ? "" : ` (${call})`}`)
          }
        }
      })
    })
}
