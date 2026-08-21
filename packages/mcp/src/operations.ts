import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import type { GeneratedOperation } from "./types.js"

// Read via `fs` (not a JSON module import) so the exact same code works whether this module
// runs from `src` (tsx/vitest) or from `dist` after `pnpm build`, without relying on Node's
// ESM import-attribute rules for `.json` — the build step copies the file alongside it.
function loadOperations(): readonly GeneratedOperation[] {
  const path = fileURLToPath(new URL("./generated/operations.json", import.meta.url))
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"))
  if (!Array.isArray(raw)) {
    throw new Error(`${path} did not contain an array — run \`pnpm generate\``)
  }
  return raw as readonly GeneratedOperation[]
}

export const OPERATIONS: readonly GeneratedOperation[] = loadOperations()
