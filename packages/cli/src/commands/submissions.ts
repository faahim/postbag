import type { Command } from "commander"

import type { operations } from "@postbag/sdk"

import { asBody } from "../lib/body.js"
import { type CliDeps, type Ctx, unwrap, withCommand } from "../lib/context.js"
import { mergeBody, parseIntFlag } from "../lib/parse.js"
import { printData } from "../lib/output.js"

type ListOpts = {
  readonly form?: string
  readonly stream?: string
  readonly status?: string
  readonly q?: string
  readonly limit?: string
  readonly cursor?: string
}

type TailOpts = {
  readonly form: string
  readonly interval?: string
}

export function registerSubmissionsCommands(program: Command, deps: CliDeps): void {
  const submissions = program.command("submissions").description("Search and inspect submissions")

  submissions
    .command("list")
    .description("Search submissions across the organization")
    .option("--form <formId>", "filter to one form")
    .option("--stream <streamId>", "filter to submissions routed through this stream")
    .option("--status <status>", "received | quarantined | spam")
    .option("--q <query>", "free-text search over submission data")
    .option("--limit <n>", "page size")
    .option("--cursor <cursor>", "pagination cursor")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<ListOpts>()
        const query = asBody<NonNullable<operations["submissions_list"]["parameters"]["query"]>>(
          mergeBody(undefined, {
            form: opts.form,
            stream: opts.stream,
            status: opts.status,
            q: opts.q,
            limit: parseIntFlag(opts.limit, "--limit"),
            cursor: opts.cursor,
          }),
        )
        const result = await ctx.client.GET("/v1/submissions", { params: { query } })
        const data = unwrap(result, ctx)
        printData(ctx.io, ctx.json ? data : data.data, ctx.json)
      })
    })

  submissions
    .command("get")
    .argument("<id>", "submission id")
    .description("Get a submission with its deliveries")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/submissions/{submissionId}", {
          params: { path: { submissionId: id } },
        })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  submissions
    .command("tail")
    .description("Poll a form's submissions and print only ones not seen yet (Ctrl-C to stop)")
    .requiredOption("--form <formId>", "form to tail")
    .option("--interval <seconds>", "poll interval in seconds", "3")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<TailOpts>()
        const intervalMs = (parseIntFlag(opts.interval, "--interval") ?? 3) * 1000
        const controller = new AbortController()
        const onSigint = (): void => {
          controller.abort()
        }
        process.once("SIGINT", onSigint)
        try {
          await tail(ctx, opts.form, intervalMs, { signal: controller.signal })
        } finally {
          process.removeListener("SIGINT", onSigint)
        }
      })
    })
}

/** Exported for tests: polls once per tick, printing only submission ids not seen before. */
export async function tail(
  ctx: Ctx,
  formId: string,
  intervalMs: number,
  opts: { readonly signal?: AbortSignal; readonly ticks?: number } = {},
): Promise<void> {
  const seen = new Set<string>()
  let tick = 0
  const maxTicks = opts.ticks
  // Runs until Ctrl-C (or `opts.signal`/`opts.ticks` in tests).
  for (;;) {
    if (opts.signal?.aborted) return
    const result = await ctx.client.GET("/v1/forms/{formId}/submissions", {
      params: { path: { formId }, query: { limit: 50 } },
    })
    const page = unwrap(result, ctx)
    for (const submission of [...page.data].reverse()) {
      if (seen.has(submission.id)) continue
      seen.add(submission.id)
      printData(ctx.io, submission, ctx.json)
    }
    tick += 1
    if (maxTicks !== undefined && tick >= maxTicks) return
    await sleep(intervalMs, opts.signal)
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener("abort", () => {
      clearTimeout(timer)
      resolve()
    })
  })
}
