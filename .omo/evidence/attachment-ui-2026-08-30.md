# Attachment drawer UI evidence — 2026-08-30

## Submission attachment presentation

- **Scenario:** A `SubmissionDetail` returned by the existing authenticated `/v1/submissions/{submissionId}` contract has one or more attachment records.
- **Invocation:** `pnpm --filter @postbag/web build`
- **Binary observable:** TypeScript accepts `submission.attachments`, `filename`, `content_type`, `size_bytes`, and `download_url`; Vite produces the `submission-drawer` production chunk successfully.
- **Artifact:** `apps/server/dist/public/assets/submission-drawer-DMJ0bD21.js` from the successful local build (build output listed `15.05 kB`, gzip `5.12 kB`).

## Size formatting

- **Scenario:** Attachment sizes cover bytes, fractional KiB, and whole MiB.
- **Invocation:** `pnpm --filter @postbag/web test -- submission-drawer.test.ts`
- **Binary observable:** 12 test files / 56 tests passed; `formatAttachmentSize(999)`, `formatAttachmentSize(1536)`, and `formatAttachmentSize(2 * 1024 * 1024)` resolve to `999 B`, `1.5 KiB`, and `2 MiB`.
- **Artifact:** `apps/web/src/components/submission-drawer.test.ts`.

## Web package gate

- **Scenario:** The changed drawer compiles in the dashboard package.
- **Invocation:** `pnpm --filter @postbag/web typecheck && pnpm --filter @postbag/web build && git diff --check`
- **Binary observable:** TypeScript exited 0, Vite build completed, and `git diff --check` emitted no whitespace errors.
- **Artifact:** This evidence record and the generated production bundle above.
