import type { Command } from "commander"

import { type CliDeps, unwrap, withCommand } from "../lib/context.js"
import { printData, printError } from "../lib/output.js"

/** `postbag orgs list|switch <slug-or-id>` (job L). `list` is just `GET /v1/me`'s
 * `organizations` field — for an API key that's always the key's one organization (a key
 * is bound to one org for its whole life, see `apps/server/src/routes/v1/organizations.ts`);
 * for a session it's every org the signed-in user belongs to. `switch` calls `POST
 * /v1/me/active-organization`, which is session-only — an API key gets a clear 403 telling
 * it why, the same way it would calling the endpoint directly. */
export function registerOrgsCommands(program: Command, deps: CliDeps): void {
  const orgs = program.command("orgs").description("Organizations the caller belongs to (job L)")

  orgs
    .command("list")
    .description("List organizations the caller belongs to, with role and which one is active")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const result = await ctx.client.GET("/v1/me")
        const me = unwrap(result, ctx)
        printData(ctx.io, ctx.json ? me.organizations : me.organizations, ctx.json)
      })
    })

  orgs
    .command("switch")
    .argument("<slug-or-id>", "organization slug or id")
    .description("Switch the active organization for a signed-in session (not an API key)")
    .action(async (slugOrId: string, _opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const meResult = await ctx.client.GET("/v1/me")
        const me = unwrap(meResult, ctx)
        const target = me.organizations.find((org) => org.id === slugOrId || org.slug === slugOrId)
        if (target === undefined) {
          printError(
            ctx.io,
            {
              code: "not_found",
              message: `No organization matching '${slugOrId}' among the caller's organizations.`,
              hint: "Run `postbag orgs list` to see slugs and ids.",
            },
            ctx.json,
          )
          process.exitCode = 1
          return
        }
        const result = await ctx.client.POST("/v1/me/active-organization", { body: { organization_id: target.id } })
        const data = unwrap(result, ctx)
        printData(ctx.io, data, ctx.json)
      })
    })
}
