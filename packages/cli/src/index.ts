/**
 * Programmatic entry point (`import { buildProgram } from "postbag"`), used by the CLI's
 * own test suite and available to anyone embedding the command tree rather than shelling
 * out to `postbag`. The everyday entry point is the `postbag` binary (`src/bin.ts`).
 */
export { buildProgram } from "./program.js"
export { main } from "./main.js"
export { type CliDeps, defaultDeps } from "./lib/context.js"
export { version } from "./version.js"
