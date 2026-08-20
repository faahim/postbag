import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

export function renderLlmsTxt(appUrl: string): string {
  const path = fileURLToPath(new URL("../llms.md", import.meta.url))
  const template = readFileSync(path, "utf8")
  return template.replaceAll("{{APP_URL}}", appUrl)
}
