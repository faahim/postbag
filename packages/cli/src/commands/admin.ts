import type { Command } from "commander"

import type { operations } from "@postbag/sdk"

import { asBody, type JsonBody } from "../lib/body.js"
import { type CliDeps, unwrap, withCommand } from "../lib/context.js"
import { mergeBody } from "../lib/parse.js"
import { printData } from "../lib/output.js"

type CreateOpts = {
  readonly plan?: string
  readonly note?: string
  readonly days?: string
  readonly uses?: string
}

/**
 * Job K — platform-admin plan-grants: mint/list/revoke complimentary-access codes. These
 * hit `/v1/admin/plan-grants*`, which answer 404 for any caller whose email (the CLI's
 * own signed-in session or API key owner) is not in the server's PLATFORM_ADMIN_EMAILS —
 * there is no separate "am I an admin" check here, the API itself is the gate.
 */
export function registerAdminCommands(program: Command, deps: CliDeps): void {
  const admin = program.command("admin").description("Platform-admin operations (gated by the server's PLATFORM_ADMIN_EMAILS)")
  const planGrants = admin.command("plan-grants").description("Mint, list and revoke complimentary-access grant codes")

  planGrants
    .command("create")
    .description("Mint a new grant code (shown once — store it immediately)")
    .requiredOption("--plan <plan>", "free, pro, team or selfhost")
    .option("--note <note>", 'shown to the redeeming org, e.g. "friend"')
    .option("--days <n>", "how many days after redemption the granted plan lasts")
    .option("--uses <n>", "how many different organizations may redeem this code (default: 1)")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<CreateOpts>()
        const body = asBody<JsonBody<operations["admin_plan_grants_create"]>>(
          mergeBody(undefined, {
            plan: opts.plan,
            note: opts.note,
            plan_duration_days: opts.days === undefined ? undefined : Number.parseInt(opts.days, 10),
            max_redemptions: opts.uses === undefined ? undefined : Number.parseInt(opts.uses, 10),
          }),
        )
        const result = await ctx.client.POST("/v1/admin/plan-grants", { body })
        const data = unwrap(result, ctx)
        if (!ctx.json) {
          ctx.io.log("Store this code now — it will not be shown again.")
        }
        printData(ctx.io, data, ctx.json)
      })
    })

  planGrants
    .command("list")
    .description("List plan grants (hashed codes never returned)")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/admin/plan-grants")
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  planGrants
    .command("revoke")
    .argument("<id>", "plan grant id")
    .description("Revoke a plan grant so it can no longer be redeemed")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.POST("/v1/admin/plan-grants/{id}/revoke", { params: { path: { id } } })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })
}
