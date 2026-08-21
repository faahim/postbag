// Remove Astro content-layer build artefacts that are not part of the public site.
import { rmSync, existsSync } from "node:fs"
import { join } from "node:path"
const out = new URL("../../server/dist/site/", import.meta.url).pathname
for (const f of ["collections", "content-assets.mjs", "content-modules.mjs", "data-store.json", "settings.json"]) {
  const p = join(out, f)
  if (existsSync(p)) rmSync(p, { recursive: true, force: true })
}
console.log("[site] postbuild clean ok")
