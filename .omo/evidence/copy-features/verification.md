# Feature marketing-copy verification

- **Scenario:** Compile the rewritten feature-page content as part of the Astro site.
- **Invocation:** `pnpm --filter @postbag/site typecheck`
- **Binary observable:** command exited 0; Astro reported 0 errors and 0 warnings (one pre-existing inline JSON-LD hint in `src/layouts/Base.astro`).
- **Scope check:** `rg -n -i '\\b(schema|mapping|stream|outbox|worker|idempotency|constraint|versioned|transaction|payload|hmac|postgres|database)\\b' apps/site/src/content/features.ts` found only `schema` inside the preserved agent-facing API example. No visible marketing copy contains a blocked implementation term.
- **Whitespace check:** `git diff --check -- apps/site/src/content/features.ts` exited 0.
