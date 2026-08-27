# Code-quality review — Postbag brand overhaul

- **Review target:** `1b8a741..c462406` on `codex/brand-overhaul`.
- **codeQualityStatus:** WATCH
- **recommendation:** APPROVE
- **blockers:** None (no CRITICAL or HIGH findings).

## Scope and verification

I independently inspected the committed diff, build outputs, asset paths, the
OpenAPI/server/SDK/MCP wording chain, and the available evidence artifacts. I
treated evidence as untrusted until I checked the corresponding source and
reran the following commands from this worktree:

- `git diff --check 1b8a741..HEAD` — pass.
- `pnpm lint` — pass.
- `pnpm typecheck` — pass; 0 errors and only Astro's existing inline-script hint.
- `pnpm test` — pass; 38 files / 164 tests passed, 23 files / 144 tests skipped by
  workspace configuration.
- `pnpm --filter @postbag/site build` — pass; 83 static routes.
- `pnpm --filter @postbag/web build` — pass.
- `pnpm --filter @postbag/site brand:social` — pass.

The SPA production output rewrites its `/app/`-scoped manifest and icon paths
correctly. The site social generator produces the five committed Open Graph PNGs.
The Stream wording is synchronized across the server route, OpenAPI, generated SDK,
and generated MCP operations.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

1. **The product still presents the retired `Bag` name in several visible controls.**
   The main navigation now calls this resource “Streams”, but the inbox filter says
   “All bags” at [apps/web/src/routes/_app/inbox/index.tsx:57](/Users/faahim/Developer/postbag-brand-overhaul/apps/web/src/routes/_app/inbox/index.tsx:57)
   and [apps/web/src/routes/_app/inbox/index.tsx:60](/Users/faahim/Developer/postbag-brand-overhaul/apps/web/src/routes/_app/inbox/index.tsx:60).
   Related visible copy remains at [apps/web/src/components/add-route-dialog.tsx:142](/Users/faahim/Developer/postbag-brand-overhaul/apps/web/src/components/add-route-dialog.tsx:142),
   [apps/web/src/components/ui/command.tsx:23](/Users/faahim/Developer/postbag-brand-overhaul/apps/web/src/components/ui/command.tsx:23),
   and [apps/web/src/lib/queries/webhooks.ts:17](/Users/faahim/Developer/postbag-brand-overhaul/apps/web/src/lib/queries/webhooks.ts:17).
   This does not break routing behavior, but it violates the settled `Stream` vocabulary and leaves an obvious cross-surface rebrand inconsistency.

2. **The two design source-of-truth documents disagree about the retired mark.**
   [docs/DESIGN.md:36](/Users/faahim/Developer/postbag-brand-overhaul/docs/DESIGN.md:36)
   permits the old postmark for real Submission/Delivery states, while
   [docs/BRAND.md:208](/Users/faahim/Developer/postbag-brand-overhaul/docs/BRAND.md:208)
   explicitly retires the old red circular postmark/check family. A future contributor
   following DESIGN could legitimately reintroduce the exact treatment this range
   removed. Align the guidance before the next UI change.

### LOW

1. **A few reveal delays bypass the shared token scale.**
   For example, [apps/site/src/pages/compare/[slug].astro:77](/Users/faahim/Developer/postbag-brand-overhaul/apps/site/src/pages/compare/[slug].astro:77)
   sets `110ms` directly. This is a small maintenance inconsistency, not a rendering
   failure; prefer a token expression when touching the page.

## Checked-safe areas

- No broken public-page, favicon, manifest, Open Graph, or `/app/` asset path was
  found in the production builds.
- No generated-client drift was found after the Stream terminology update.
- The new RoutingMark/SuccessMark consumer migration does not leave an import of the
  deleted Postmark/SuccessCheck components in committed sources.
- Reduced-motion guards cover both CSS animation and the SMIL stream illustration;
  the illustration subscribes to system preference changes.
- The full test suite contains no new deletion-only, tautological, or
  implementation-mirroring tests. The deterministic social-asset generator is
  proportionate production build code, not needless parsing/normalization.

## Required skill-perspective check

The `remove-ai-slops` and `programming` skills were not available in this session's
skill catalog, so their stated criteria were applied directly. The review found no
tests that merely prove a requested deletion, mirror constants, or provide false
confidence; no untyped escape hatch or validation/parsing layer was introduced by this
range; and no needless production abstraction was introduced. The vocabulary and
source-of-truth inconsistencies above violate the maintainability/overfit perspective
at MEDIUM severity. The direct `110ms` delay is a LOW token-discipline violation.

## Merge verdict

**APPROVE with WATCH status.** No critical or high-severity correctness or regression
finding blocks merge. Resolve the two MEDIUM consistency findings in closeout so the
complete rebrand stays coherent beyond the main navigation.
