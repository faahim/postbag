# Brand-fidelity release gate — `5ea058a`

**Recommendation: APPROVE**

Scope: read-only re-gate of the committed head after `62f02f1`, against
`docs/BRAND.md` and `docs/DESIGN.md`. This supplements the existing manual QA
and code-review evidence; it does not reassert their unrelated product findings.

## Findings

### CRITICAL

None. The marketing pages are live DOM/content components, not raster or
screenshot substitutes. The mark remains the real reusable `BrandMark.astro`
component, and the branded canvas remains token-driven CSS plus the dedicated
grain asset.

### HIGH

None.

The previous high-severity marketing-register breach is closed. The prohibited
terms found in `features.ts` and `usecases.ts` occur only inside real, labelled
agent artifacts (`code: { title: "What your agent sees/sends" }`), which is
explicitly allowed by `docs/BRAND.md`. The surrounding titles, ledes, sections,
and FAQs now speak in reader outcomes rather than implementation machinery.
`compare.ts` has likewise moved its Postbag descriptions and comparison labels
to reader language.

### MEDIUM

None.

The mobile drawer now makes the background regions inert on open:
`apps/site/src/components/Nav.astro:84,105`. It retains its dialog semantics,
focus return, Escape close, explicit Tab loop, scroll lock, and closed-drawer
inert state at lines 50 and 93–140. This closes the prior modal-isolation gap.

### LOW / watch items

- `apps/site/src/components/BrandMark.astro` contains literal SVG paint values.
  They belong to the reusable primary brand illustration, rather than component
  colour utilities or page-level one-offs. This is appropriate for the asset and
  is not a token-system violation.
- The comparison pages still include concrete third-party facts. Their
  correctness is a continuing editorial responsibility, not a fidelity defect
  in this committed revision.

## Checks

- Committed head is `5ea058adf0420bef1378320c88215d1ec7abb90c`; worktree was
  clean at review time.
- `git diff --check` and `git diff --check main...HEAD` passed.
- Full marketing-register scan of `features.ts`, `usecases.ts`, and
  `compare.ts` found only three allowed terms, each within explicitly labelled
  agent code artifacts; none remain in explanatory prose.
- Mobile drawer source confirms `aria-modal`, background `inert`, focus return,
  Escape handling, and a bounded focus loop.
- Existing evidence reviewed: `.omo/evidence/final-manual-qa-3/`,
  `.omo/evidence/brand-overhaul-gate-review.md`,
  `.omo/evidence/brand-overhaul-clone-fidelity.md`, and
  `.omo/evidence/texture-system-clone-fidelity.md`.

No true brand-fidelity release blocker remains at this head. Product/security or
release-process issues reported by separate gates remain outside this review's
approval scope.
