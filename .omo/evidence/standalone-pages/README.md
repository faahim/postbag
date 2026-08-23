# Standalone public pages evidence

## Static verification

- Scenario: all Astro site types remain valid after replacing the six standalone pages.
- Invocation: `pnpm --filter @postbag/site typecheck`.
- Binary observable: exit 0; 54 files checked; 0 errors and 0 warnings.
- Artifact: `site-typecheck.log`.

- Scenario: every public route still compiles into the production static output.
- Invocation: `pnpm --filter @postbag/site build`.
- Binary observable: exit 0; 78 pages built; all six owned routes listed; postbuild clean ok.
- Artifact: `site-build.log`.

- Scenario: owned pages contain no stale claims, decorative em dashes, old Postmark references, hardcoded colors, ad-hoc durations, or diff whitespace errors.
- Invocation: the `git diff --check` and `rg` commands captured in `source-audit.log`.
- Binary observable: exit 0; both scans print `clean`; exactly six owned page paths are listed.
- Artifact: `source-audit.log`.

## Browser verification

- Scenario: Yearly pricing interaction at 900 by 1000.
- Invocation: load `/pricing/`, activate the `Yearly` tab by role, inspect the selected state, Pro price, billing detail and checkout href.
- Binary observable: `aria-selected=true`; Pro price `12`; detail `$144 billed yearly.`; href contains `plan=pro&interval=year&checkout=1`; document width equals client width at 900.
- Artifacts: `browser-audit.json`, `pricing-tablet-yearly-viewport.png`, `pricing-tablet-selfhost-viewport.png`.

- Scenario: standalone page family at desktop, tablet and mobile widths.
- Invocation: real in-app browser navigation at 1440 by 1000, 900 by 1000 and 390 by 844 with DOM overflow and surface checks.
- Binary observable: each checked page has `scrollWidth === clientWidth`; About contains the contact Form; changelog has 6 releases; glossary has 18 terms and 18 index links; 404 has no Postmark consumer; browser console has no warnings or errors.
- Artifacts: `browser-audit.json`, `browser-console.json`, `for-ai-agents-desktop-viewport.png`, `about-mobile-viewport.png`, `changelog-desktop-viewport.png`, `glossary-tablet-viewport.png`, `404-mobile-viewport.png`.
