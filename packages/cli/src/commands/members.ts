import type { Command } from "commander"

import type { operations } from "@postbag/sdk"

import { asBody, type JsonBody } from "../lib/body.js"
import { type CliDeps, unwrap, unwrapEmpty, withCommand } from "../lib/context.js"
import { printData } from "../lib/output.js"

/** `postbag members list|remove <id>|role <id> <role>` (job L §2/§4) — thin wrappers over
 * `/v1/members`, same role enforcement as the dashboard and MCP (owner/admin/member; a
 * `manage`-scoped key is admin-equivalent, never sufficient for the owner-only `role`
 * command — see `apps/server/src/lib/orgs.ts`). */
export function registerMembersCommands(program: Command, deps: CliDeps): void {
  const members = program.command("members").description("Members of the active organization")

  members
    .command("list")
    .description("List members")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/members")
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  members
    .command("remove")
    .argument("<id>", "member id (from `postbag members list`)")
    .description("Remove a member, or leave yourself (owner/admin for others; anyone may remove themselves)")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.DELETE("/v1/members/{memberId}", { params: { path: { memberId: id } } })
        unwrapEmpty(result, ctx)
        printData(ctx.io, { ok: true, id }, ctx.json)
      })
    })

  members
    .command("role")
    .argument("<id>", "member id (from `postbag members list`)")
    .argument("<role>", "owner | admin | member")
    .description("Change a member's role — owner only (a signed-in session, not an API key)")
    .action(async (id: string, role: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const body = asBody<JsonBody<operations["members_update_role"]>>({ role })
        const result = await ctx.client.PATCH("/v1/members/{memberId}", { params: { path: { memberId: id } }, body })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })
}
