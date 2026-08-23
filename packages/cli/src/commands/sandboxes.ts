import type { Command } from "commander"

import { type CliDeps, CliExitError, unwrap, withCommand } from "../lib/context.js"
import { printData, printError } from "../lib/output.js"

type CreateOpts = {
  readonly name: string
  readonly origin?: string
  readonly claimEmail?: string
  readonly idempotencyKey?: string
}

type TokenOpts = { readonly token?: string }

function tokenFrom(opts: TokenOpts, deps: CliDeps): string {
  const token = opts.token ?? deps.env["POSTBAG_SANDBOX_TOKEN"]
  if (token === undefined || token.length === 0) {
    throw new Error("Pass --token or set POSTBAG_SANDBOX_TOKEN.")
  }
  return token
}

function sandboxIdFromToken(token: string): string {
  const id = /^pbs_(fm_[23456789abcdefghjkmnpqrstuvwxyz]{12})\.[A-Za-z0-9_-]{43}$/u.exec(token)?.[1]
  if (id === undefined) throw new Error("The sandbox token is malformed.")
  return id
}

export function registerSandboxCommands(program: Command, deps: CliDeps): void {
  const sandboxes = program
    .command("sandbox")
    .description("Create, inspect and claim a temporary Form before signing up")

  sandboxes
    .command("create")
    .requiredOption("--name <name>", "temporary Form name")
    .option("--origin <url>", "site origin allowed to submit")
    .option("--claim-email <email>", "bind claim to this explicitly supplied login email")
    .option("--idempotency-key <uuid>", "canonical UUIDv4 (generated when omitted)")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const opts = command.opts<CreateOpts>()
        const result = await ctx.client.POST("/v1/public/sandboxes", {
          params: {
            header: { "idempotency-key": opts.idempotencyKey ?? globalThis.crypto.randomUUID() },
          },
          body: {
            name: opts.name,
            ...(opts.origin === undefined ? {} : { origin: opts.origin }),
            ...(opts.claimEmail === undefined ? {} : { claim_email: opts.claimEmail }),
          },
        })
        const data = unwrap(result, ctx)
        if (ctx.json) {
          printData(ctx.io, data, true)
          return
        }
        ctx.io.log(`Created temporary Form '${data.sandbox.name}' (${data.sandbox.id})`)
        ctx.io.log(`Submit URL: ${data.sandbox.submit_url}`)
        ctx.io.log(`Claim URL: ${data.claim_url}`)
        ctx.io.log(`Sandbox token: ${data.sandbox_token}`)
        ctx.io.log(
          "Keep the token private. It is not written to postbag.json or saved credentials.",
        )
      })
    })

  sandboxes
    .command("status")
    .option("--token <token>", "sandbox token (or POSTBAG_SANDBOX_TOKEN)")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        const token = tokenFrom(command.opts<TokenOpts>(), deps)
        const id = sandboxIdFromToken(token)
        const data = unwrap(
          await ctx.client.GET("/v1/public/sandboxes/{id}", {
            params: {
              path: { id },
              header: { authorization: `Sandbox ${token}` },
            },
          }),
          ctx,
        )
        printData(ctx.io, data, ctx.json)
      })
    })

  sandboxes
    .command("claim")
    .option("--token <token>", "sandbox token (or POSTBAG_SANDBOX_TOKEN)")
    .action(async (_opts: unknown, command: Command) => {
      await withCommand(command, deps, async (ctx) => {
        if (ctx.apiKey === undefined) {
          printError(
            ctx.io,
            {
              code: "missing_api_key",
              message: "Claiming also requires a manage-scoped API key.",
              hint: "Run postbag login first, then retry this command with the sandbox token.",
            },
            ctx.json,
          )
          throw new CliExitError(1)
        }
        const token = tokenFrom(command.opts<TokenOpts>(), deps)
        const id = sandboxIdFromToken(token)
        const data = unwrap(
          await ctx.client.POST("/v1/sandboxes/{id}/claim", {
            params: {
              path: { id },
              header: { "postbag-sandbox-token": token },
            },
          }),
          ctx,
        )
        printData(ctx.io, data, ctx.json)
      })
    })
}
