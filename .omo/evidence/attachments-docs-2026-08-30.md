# Attachment documentation evidence — 2026-08-30

## Scenario: release documentation has one consistent attachment contract

- **Invocation:** `node` content assertions over the listed product docs.
- **Binary observable:** exit code `0`; all ten assertions passed.
- **Coverage:** multipart `fl_…` references; 64 MiB multipart ceiling; Free, Pro and
  Team capacity; private S3-compatible storage; signed Delivery links; file-free
  anonymous sandboxes; durable deletion; and the attachment admission rationale.

## Scenario: public site renders the revised reference and pricing pages

- **Invocation:** `pnpm --filter @postbag/site build`
- **Binary observable:** exit code `0`; Astro built 83 static pages, including
  `/docs/submit-endpoint/`, `/docs/security/`, `/docs/destinations/`,
  `/docs/agents/` and `/pricing/`; postbuild reported `clean ok`.

## Scenario: patch is whitespace-safe

- **Invocation:** `git diff --check`
- **Binary observable:** exit code `0` with no output.
