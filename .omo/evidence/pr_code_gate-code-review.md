# Release-gate code review — `codex/brand-overhaul`

**Reviewed range:** `origin/main...6824bee3ded974799173bd470d6a37ae10d6645f`
**Special focus:** `origin/codex/brand-overhaul..HEAD` (`6d255b0..6824bee`, six commits)
**Reviewer mode:** read-only; no product files, commits, or existing worktree changes were altered.

## Verdict

**codeQualityStatus:** BLOCK
**recommendation:** REQUEST_CHANGES

## Resolution after review

All blocking findings were resolved before the branch was opened for review:

- `8692f18` removed the local password from the unpushed commit history.
- `0e2eb19` narrowed the workspace-timezone contract to the dashboard default for new digest Routes, regenerated OpenAPI/SDK/MCP artifacts, and added database-backed owner, validation, persistence, and member-authorization tests.
- `62f02f1` removed the tracked whitespace errors, aligned marketing detail copy with `docs/BRAND.md`, and made the page behind the mobile drawer inert while it is open.
- The Postgres-backed server suite passed 176/176 tests. The final static and browser gates are recorded in `final-manual-qa-3/brand-overhaul-manual-qa.md`.

The findings below are retained as the original review record.

Do not open the release PR until the two HIGH findings below are corrected and the contract behavior is verified against a real test database. The branch has useful, coherent visual work, but the late dashboard sweep added a plaintext password and a user-visible setting whose claimed scheduling effect is not implemented.

## Findings

### HIGH — plaintext local sign-in password committed to a public-PR branch

- **Location:** `PROGRESS.md:205` (introduced by `6824bee`)
- The change adds an email/password pair directly to a tracked file, immediately after stating that credentials should never be in the repository. Even if the account is local-only, opening the PR permanently publishes a reusable authentication secret in Git history and establishes an unsafe release-documentation pattern.
- **Required correction:** remove the password from the tracked document, rotate/reset the local account if it may be reused, and amend/rewrite the unpushed commit so the value never reaches the remote PR history. Keep only a non-secret setup instruction or a local-file location.

### HIGH — workspace timezone control does not control existing digest Route schedules as its UI/API contract says

- **Locations:** `apps/web/src/routes/_app/settings/index.tsx:80-99`, `apps/server/src/routes/v1/organizations.ts:60-69`, `packages/core/src/types.ts:487-490`, `apps/server/src/routes/v1/routesResource.ts:171-185`.
- Settings saves only `organization_settings.timezone`; it does not query or update Routes. Every created digest Route, however, requires its own `mode.timezone` and persists that JSON value directly. Therefore an existing daily/weekly Route continues in its old timezone after a user changes Settings, contrary to the Settings copy (“the clock your digest Routes follow”) and the new OpenAPI description (“digest Routes follow [the organization timezone]”).
- This is operationally material: a user changing the workspace timezone to move scheduled digests will see no change for Routes already configured. The API is also misleading for agents, despite the contract-first requirement.
- **Required correction:** either define and implement the intended inheritance/migration behavior (including existing Route behavior and a DB-backed authorization/validation test), or narrow the UI and OpenAPI copy to say this is only the default used when creating a new dashboard Route. The current API schema cannot truthfully promise Route inheritance because digest `mode.timezone` is required and stored per Route.

### MEDIUM — the new organization-settings mutation has no executed behavioral test in the available environment

- **Locations:** `apps/server/src/routes/v1/organizations.ts:140-163`; the nearby integration suite ends at `apps/server/src/routes/v1/organizations.test.ts:186` and contains no request for `PATCH /v1/organizations/active`.
- The new endpoint adds authz, timezone validation, a settings write, an unusual self-healing insert, OpenAPI, SDK, and dashboard use, yet no test covers owner/admin success, member/read-key rejection, invalid IANA input, or the no-settings-row path. The focused server command ran only non-DB tests here because `TEST_DATABASE_URL` was absent; 132 server tests were skipped.
- **Required correction:** add focused integration coverage and run it with a real disposable Postgres database before release. The test should assert the actual intended route-timezone semantics, not merely that a row can be updated.

### LOW — `git diff --check origin/main...HEAD` is not clean

- **Location:** `.omo/evidence/detail_layout_review-code-review.md:3-4`.
- The tracked evidence file has two trailing-whitespace errors. This is not a runtime defect, but it violates the branch’s stated final diff-hygiene gate and should be cleaned before PR creation.

### LOW — this is broader than a pure branding PR and should be called out or split

- **Locations:** `apps/server/src/routes/v1/organizations.ts:60-163`, `api/openapi.yaml:2071-2106`, `packages/sdk/src/schema.d.ts`, `apps/web/src/routes/_app/forms/$formId.tsx:151-435`, and `apps/web/src/components/routes-list.tsx`.
- The late commits add a server endpoint, a generated SDK operation, route-cadence editing, and a schema-publishing editor. These are product features, not presentation-only branding. They need product behavior test evidence and should be explicitly separated in the PR description, or split into a follow-up PR, so launch reviewers can reason about API and scheduling risk independently.

## Checked-safe areas

- `apps/server/src/app.ts:112` registers the new organization route; the route is not orphaned.
- The checked-in OpenAPI file matches the server-generated document: the focused `apps/server/src/openapi.test.ts` run passed.
- The generated client declaration is fresh: regenerating `api/openapi.yaml` with the repository’s `openapi-typescript` version into `/tmp` matched `packages/sdk/src/schema.d.ts` byte-for-byte.
- Web production build passed (`tsc --noEmit` plus Vite build), including the new Settings/Events parent routes and generated route tree.
- Focused web tests passed: 3 files / 12 tests. The targeted server command passed its runnable subset: 10 files / 42 tests; it did **not** constitute real endpoint integration proof because the database-backed cases were skipped.
- `git show --check` is clean for each of the six post-remote commits. The full branch check failure is limited to the older tracked evidence whitespace noted above.
- I found no API/OpenAPI/SDK drift for the new endpoint itself. The concern is the semantics promised by that endpoint, not generated-type consistency.

## Skill-perspective check

The mandated `remove-ai-slops` and `programming` skills were not available in this session’s skill catalog, so their files could not be loaded. I applied their stated review criteria directly: no deletion-only or tautological tests were added, and no prompt-string tests were introduced. The new production code does contain a small `isValidTimezone` boundary check that is appropriate for this API mutation; no untyped escape hatch or needless parsing abstraction was found in the newly added endpoint. The missing behavioral coverage above is still material because this is a real persistent scheduling setting, not because a test is stylistically weak.

## Review limits

- `TEST_DATABASE_URL` and `DATABASE_URL` were absent, so live Postgres authorization and persistence behavior could not be executed in this review.
- The worktree contained concurrent, unreviewed changes during review (`packages/mcp/src/generated/operations.json` modified and `.omo/evidence/final-manual-qa-3/` untracked). They were neither touched nor included in the reviewed committed range.
