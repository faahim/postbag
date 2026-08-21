import { Command } from "commander"

import { registerApiKeysCommands } from "./commands/apiKeys.js"
import { registerAuthCommands } from "./commands/auth.js"
import { registerDeliveriesCommands } from "./commands/deliveries.js"
import { registerDestinationsCommands } from "./commands/destinations.js"
import { registerEventsCommands } from "./commands/events.js"
import { registerFormsCommands } from "./commands/forms.js"
import { registerInitCommand } from "./commands/init.js"
import { registerMiscCommands } from "./commands/misc.js"
import { registerProjectsCommands } from "./commands/projects.js"
import { registerRoutesCommands } from "./commands/routes.js"
import { registerSchemaCommands } from "./commands/schema.js"
import { registerStreamsCommands } from "./commands/streams.js"
import { registerSubmissionsCommands } from "./commands/submissions.js"
import { registerWebhooksCommands } from "./commands/webhooks.js"
import { type CliDeps, defaultDeps } from "./lib/context.js"
import { description, version } from "./version.js"

const EXAMPLES = [
  "Examples:",
  "  $ postbag login",
  "  $ postbag init --yes",
  "  $ postbag forms list",
  "  $ postbag forms create --name 'Contact form' --tags site,contact",
  "  $ postbag submissions tail --form fm_abc123",
  "  $ POSTBAG_API_KEY=pb_live_... postbag --json forms list",
  "  $ postbag api GET /v1/me",
].join("\n")

/** Builds the full `postbag` command tree. `deps` makes it testable with a fake `fetch`/fs/env. */
export function buildProgram(deps: CliDeps = defaultDeps()): Command {
  const program = new Command()

  program
    .name("postbag")
    .description(`${description}\n\n${EXAMPLES}`)
    .version(version)
    .option("--api-key <key>", "API key (overrides POSTBAG_API_KEY / saved credentials)")
    .option("--api-url <url>", "API base URL (overrides POSTBAG_API_URL / postbag.json)")
    .option("--json", "force JSON output, even on a TTY (default when stdout is not a TTY)")
    .showHelpAfterError()
    .configureHelp({ showGlobalOptions: true })

  registerAuthCommands(program, deps)
  registerInitCommand(program, deps)
  registerFormsCommands(program, deps)
  registerSubmissionsCommands(program, deps)
  registerSchemaCommands(program, deps)
  registerStreamsCommands(program, deps)
  registerDestinationsCommands(program, deps)
  registerRoutesCommands(program, deps)
  registerDeliveriesCommands(program, deps)
  registerEventsCommands(program, deps)
  registerWebhooksCommands(program, deps)
  registerProjectsCommands(program, deps)
  registerApiKeysCommands(program, deps)
  registerMiscCommands(program, deps)

  return program
}
