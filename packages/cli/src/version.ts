import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

type PackageJson = {
  readonly version: string
  readonly description: string
}

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json")
const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as PackageJson

export const version = pkg.version
export const description = pkg.description
