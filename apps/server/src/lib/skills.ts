import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const HOSTED_URL = "https://postbag.dev"

// Job H 3: bundles skills/postbag/SKILL.md the same way llms.ts bundles llms.md — read at
// runtime relative to this compiled file's own location, with every `https://postbag.dev`
// substituted for this instance's real URL (self-host parity: a self-hosted operator's
// served copy points at their own server, same as /llms.txt; on the hosted product this is
// a no-op). The checked-in file hardcodes the hosted URL rather than a `{{APP_URL}}`-style
// token so it is directly correct when installed as-is via `npx skills add
// faahim/postbag --skill postbag` (which pulls the raw file from the repo, unsubstituted).
//
// NOTE: unlike llms.md (which lives under apps/server/src/ and is copied into dist/ by
// apps/server's build script), the canonical source of truth here is the top-level
// skills/postbag/SKILL.md — required so `npx skills add` finds it at the conventional repo
// path. Docker's production build (Dockerfile, `pnpm --filter @postbag/server deploy --prod`)
// The canonical file lives at the repo root (so `npx skills add faahim/postbag` finds it);
// `pnpm --filter @postbag/server build` copies it to dist/skills/postbag/SKILL.md so the
// pruned production image has it too. Resolution tries the bundled copy first (dist), then
// the monorepo path (src under vitest / `pnpm dev`).
export function renderPostbagSkill(appUrl: string): string {
  const candidates = ["../skills/postbag/SKILL.md", "../../../../skills/postbag/SKILL.md"].map((rel) =>
    fileURLToPath(new URL(rel, import.meta.url)),
  )
  const path = candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
  if (path === undefined) throw new Error("skills/postbag/SKILL.md not found")
  const template = readFileSync(path, "utf8")
  return template.replaceAll(HOSTED_URL, appUrl)
}

export function skillsIndex(appUrl: string): { readonly skills: readonly { readonly name: string; readonly url: string }[] } {
  return { skills: [{ name: "postbag", url: `${appUrl}/.well-known/skills/postbag/SKILL.md` }] }
}
