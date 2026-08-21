import type { Command } from "commander"

import type { operations } from "@postbag/sdk"

import { asBody, type JsonBody } from "../lib/body.js"
import { type CliDeps, unwrap, withCommand } from "../lib/context.js"
import { printData } from "../lib/output.js"

/** Job K — `postbag plan` shows the active organization's tier and why it has it
 * (plan/plan_source/plan_expires_at/plan_note), reading the same /v1/me every dashboard
 * screen reads; `postbag plan redeem <code>` calls POST /v1/plan/redeem. */
export function registerPlanCommands(program: Command, deps: CliDeps): void {
  const plan = program.command("plan").description("Show the active organization's plan (tier, source, expiry)")

  plan.action(async (_opts: unknown, command: Command) => {
    await withCommand(command, deps, async (ctx) => {
      const result = await ctx.client.GET("/v1/me")
      const me = unwrap(result, ctx)
      printData(
        ctx.io,
        {
          plan: me.organization.plan,
          plan_source: me.organization.plan_source,
          plan_expires_at: me.organization.plan_expires_at,
          plan_note: me.organization.plan_note,
          limits: me.limits,
        },
        ctx.json,
      )
    })
  })

  plan
    .command("redeem")
    .argument("<code>", "a code minted by 'postbag admin plan-grants create'")
    .description("Redeem a complimentary-access grant code for the active organization")
    .action(async (code: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const body = asBody<JsonBody<operations["plan_redeem"]>>({ code })
        const result = await ctx.client.POST("/v1/plan/redeem", { body })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })
}
