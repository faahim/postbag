#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

import { resolveConfig } from "./config.js"
import { createServer } from "./server.js"

async function main(): Promise<void> {
  const resolved = resolveConfig(process.argv.slice(2), process.env)
  const server = createServer(resolved)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
