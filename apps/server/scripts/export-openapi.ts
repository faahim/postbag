// Regenerates `api/openapi.yaml` from the Zod route definitions in `src/routes/v1/*.ts`
// (CLAUDE.md: "api/openapi.yaml [is] the truth (later: generated from Zod route
// definitions)"). Run with `pnpm openapi:export` (root or `apps/server`). Builds the app
// against a stub, unreachable DATABASE_URL — no real database is touched or required.
import { writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { generateOpenapiYaml } from "../src/lib/generateOpenapiDoc.js"

async function main(): Promise<void> {
  const yaml = await generateOpenapiYaml()
  const outPath = fileURLToPath(new URL("../../../api/openapi.yaml", import.meta.url))
  await writeFile(outPath, yaml, "utf8")
  console.log(`Wrote ${outPath}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
