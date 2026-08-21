import { CommanderError } from "commander"

import { type CliDeps, defaultDeps } from "./lib/context.js"
import { buildProgram } from "./program.js"

/**
 * Parses `argv` (default: `process.argv`) and runs the matched command. Never calls
 * `process.exit` itself — sets `process.exitCode` so it composes cleanly under tests
 * and under `node dist/bin.js`, where the shebang script is the only thing that exits.
 */
export async function main(argv: readonly string[] = process.argv, deps: CliDeps = defaultDeps()): Promise<void> {
  const program = buildProgram(deps)
  program.exitOverride()

  try {
    await program.parseAsync(argv)
  } catch (err) {
    if (err instanceof CommanderError) {
      process.exitCode = err.exitCode
      return
    }
    throw err
  }
}
