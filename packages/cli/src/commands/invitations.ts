import type { Command } from "commander"

import type { operations } from "@postbag/sdk"

import { asBody, type JsonBody } from "../lib/body.js"
import { type CliDeps, unwrap, unwrapEmpty, withCommand } from "../lib/context.js"
import { printData, printError } from "../lib/output.js"

type CreateOpts = {
  readonly email?: string
  readonly role?: string
}

/** `postbag invitations list|create --email … --role …|revoke <id>` (job L §2/§4). Accepting
 * stays browser-only (job L spec) — it's a session flow (which human is this, does their
 * email match) with no CLI equivalent. */
export function registerInvitationsCommands(program: Command, deps: CliDeps): void {
  const invitations = program.command("invitations").description("Pending invitations for the active organization")

  invitations
    .command("list")
    .description("List pending invitations")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/invitations")
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  invitations
    .command("create")
    .description("Invite someone by email — owner/admin (a manage-scoped API key is admin-equivalent)")
    .option("--email <email>", "the address to invite")
    .option("--role <role>", "admin | member")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<CreateOpts>()
        if (opts.email === undefined || opts.role === undefined) {
          printError(ctx.io, { code: "missing_flag", message: "--email and --role are both required." }, ctx.json)
          process.exitCode = 1
          return
        }
        const body = asBody<JsonBody<operations["invitations_create"]>>({ email: opts.email, role: opts.role })
        const result = await ctx.client.POST("/v1/invitations", { body })
        printData(ctx.io, unwrap(result, ctx), ctx.json)
      })
    })

  invitations
    .command("revoke")
    .argument("<id>", "invitation id (from `postbag invitations list`)")
    .description("Revoke a pending invitation — owner/admin")
    .action(async (id: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.DELETE("/v1/invitations/{id}", { params: { path: { id } } })
        unwrapEmpty(result, ctx)
        printData(ctx.io, { ok: true, id }, ctx.json)
      })
    })
}
