#!/usr/bin/env node
import { main } from "./main.js"

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`cli_error: ${message}`)
  process.exitCode = 1
})
