# Streams pagination verification

- **Scenario:** An organization has 101 Streams, with the second request reached through the first page's cursor.
- **Invocation:** `pnpm --filter @postbag/web test -- src/lib/queries/streams.test.ts`
- **Binary observable:** `fetchAllStreams` returned 101 rows; the mocked API received `{ limit: 100 }` first and `{ cursor: "next-page", limit: 100 }` second. The same run also confirmed a repeated cursor throws rather than looping forever. Result: 10 files / 40 tests passed.
- **Scenario:** Compile the dashboard after replacing the one-page Streams query.
- **Invocation:** `pnpm --filter @postbag/web typecheck`
- **Binary observable:** exited 0.
- **Scenario:** Check the focused diff for whitespace errors.
- **Invocation:** `git diff --check -- apps/web/src/lib/queries/streams.ts apps/web/src/lib/queries/streams.test.ts`
- **Binary observable:** exited 0.
