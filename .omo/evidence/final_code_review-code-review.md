# Code-quality review — Postbag brand overhaul

- **Review target:** `1b8a741..c462406` on `codex/brand-overhaul`, plus the current
  unstaged correction in `apps/web/src/routes/claim.tsx`.
- **Verdict:** `WATCH` / **APPROVE**
- **Blockers:** none.

## Scope and evidence reviewed

I independently inspected the full committed diff, the public-site and product changes,
the OpenAPI/generated-client wording change, manifests, social-asset generator and the
recorded browser evidence. I treated the evidence files as untrusted until I verified
their relevant source and reran the gates below.

The old server on `127.0.0.1:4323` returned 500 for documentation routes during this
review, but a fresh Astro process from this exact worktree on port 4325 served both
`/docs/agents/` and its Markdown alternate successfully. This was a stale dev-process
condition, not a source regression.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

1. **The two visual source-of-truth documents disagree about whether the retired
   postmark can be used.** `docs/DESIGN.md:36` permits the postmark for real
   Submission/Delivery state, while `docs/BRAND.md:208-211` unequivocally retires the
   old red circular postmark/check badge and directs status/empty states to use the
   receiving/routing mark. This is an operational source-of-truth conflict in the
   rebrand: a later contributor following DESIGN can legitimately reintroduce exactly
   the family this branch removed. Align DESIGN with BRAND before the next UI change.

### LOW

None.

## Correctness and regression checks that passed

- `git diff --check 1b8a741..HEAD` passed.
- `pnpm --filter @postbag/site typecheck` passed (one pre-existing Astro inline-script
  hint only).
- `pnpm --filter @postbag/site build` passed and rendered 83 static routes.
- `pnpm --filter @postbag/web typecheck` passed.
- `pnpm --filter @postbag/web test` passed: 3 files, 12 tests.
- `pnpm lint` passed.
- `pnpm test` passed: 38 files / 164 tests, with the workspace's 23 intentionally
  skipped files / 144 tests reported as skipped.
- The deterministic social generator produces all five committed 1200x630 PNGs, and
  the checked files identify as valid PNGs. The generated shared WebP is valid at
  1800x945.
- The generated SDK and MCP operation descriptions match the OpenAPI wording changed
  with the Stream vocabulary. The server route description matches too.
- The current unstaged claim copy correctly says the sandbox capability remains usable
  until claim/expiry; it no longer incorrectly calls the capability a one-time token.

## Accessibility, behavior, and test-relevance assessment

- The pricing interval control retains keyboard arrow handling, selected-state updates,
  and checkout URL updates. The reveal system has reduced-motion guards and a no-script
  fallback.
- I found no functional route, metadata, asset-path, generated-artifact, or type
  regression in the changed code. The fresh local docs check confirmed the markdown
  alternates resolve at `/docs/<slug>/index.md`.
- Automated tests are appropriately focused on existing product behavior; this branding
  change did **not** add deletion-only tests, implementation-mirroring tests, or
  tautological tests. The social generator is a small deterministic build utility and
  the build exercise is a relevant check.

## Required skill-perspective check

The `remove-ai-slops` and `programming` skills were not available in this review
session's skill catalog or under the local skill root, so I applied their stated review
criteria directly. The diff does **not** introduce deletion-only or tautological tests,
tests mirroring implementation constants, untyped escape hatches, needless parsing or
normalization in production paths, or unnecessary abstraction. The only maintainability
issue found is the conflicting visual guidance above.

## Recommendation

**APPROVE with WATCH status.** There are no CRITICAL/HIGH findings and therefore no
merge blocker. Resolve the MEDIUM documentation conflict in the normal closeout so
future work cannot revive the retired postmark family.
