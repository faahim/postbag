# Mapping extras copy audit

## Contract inspected

- `packages/core/src/mapping.ts`: `applyMapping` returns mapped `payload` and unused input roots as `extras`.
- `apps/server/src/routes/submit.ts`: a Stream Delivery stores `mapped.payload` only.
- `apps/server/src/worker/index.ts`: the Delivery context passes `extras: {}` to destination adapters.
- `apps/server/src/destinations/webhook.ts`: webhook JSON serializes that context, so delivered `extras` is currently empty.

## Public/docs correction

- `apps/site/src/pages/glossary.astro`: Mapping now says it determines the Delivery payload and unused values remain on the original Submission.
- `apps/site/src/components/home/Destinations.astro`, `apps/site/src/content/docs/webhooks.md`, and `docs/ARCHITECTURE.md`: removed inaccurate `extras` fields from webhook examples.
- `apps/site/src/content/docs/routing.md` and `docs/DOMAIN-MODEL.md`: state that Stream preview returns unused values under `extras`; Delivery does not.

## Verification

- `pnpm --filter @postbag/core test -- mapping.test.ts` — 11 files / 46 tests passed.
- `pnpm --filter @postbag/site typecheck` — 0 errors, 0 warnings; one pre-existing inline JSON-LD hint.
- `pnpm --filter @postbag/site build` — 83 static pages built successfully.
- `rg -n -i "extras.*(deliver|send|payload|webhook)|deliver.*extras|send.*extras|unmapped.*extras|extras.*unmapped" apps/site/src docs` now returns only the two corrected preview-only statements in routing docs and the domain model.
