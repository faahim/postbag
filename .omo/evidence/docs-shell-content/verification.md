# Documentation lane verification

## Shell and content compile

- Scenario: every Astro documentation route renders with the new shared shell and the five rewritten guides.
- Invocation: `pnpm --filter @postbag/site typecheck`.
- Binary observable: exit 0, 55 files checked, 0 errors, 0 warnings. Astro reports one existing inline-script hint in `Base.astro`.
- Artifact: `.omo/evidence/docs-shell-content/site-typecheck.log`.

## Static site build

- Scenario: HTML pages, Markdown twins, error pages, sitemap, and postbuild cleanup all generate from the shared worktree.
- Invocation: `pnpm --filter @postbag/site build`.
- Binary observable: exit 0, 83 pages built, sitemap generated, `[site] postbuild clean ok`.
- Artifact: `.omo/evidence/docs-shell-content/site-build.log`.

## Token and copy guardrails

- Scenario: the owned shell contains no hardcoded colors, ad hoc durations, `transition: all`, or decorative em/en dashes in changed visible copy.
- Invocation: the two `rg` scans recorded in `static-audit.log`.
- Binary observable: both result sections are empty; the five built documentation routes are present and non-empty.
- Artifact: `.omo/evidence/docs-shell-content/static-audit.log`.

## Rendered truth markers

- Scenario: generated HTML contains the corrected capability, OAuth, Destination and Route, and npm-publication statements.
- Invocation: `rg` over the five generated documentation HTML files.
- Binary observable: matching generated lines are present for each corrected claim.
- Artifact: `.omo/evidence/docs-shell-content/owned-artifacts.log`.

## Diff hygiene

- Scenario: the shared diff has no whitespace errors after the documentation changes.
- Invocation: `git diff --check`.
- Binary observable: exit 0 and explicit `PASS` marker.
- Artifact: `.omo/evidence/docs-shell-content/diff-check.log`.

Browser viewport verification is intentionally left to the parent integration QA lane, which owns the running development server and cross-surface screenshots. This lane did not claim browser evidence.
