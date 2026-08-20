# ADR-005 — Expression language for mappings, filters and transforms

**Status:** Proposed — needed for Phase 2; Phase 1 ships direct mapping only

## Context
Operators need "concat two fields", "only if budget > 1000", "rename and reshape
for partner X" without deploying code. Must be safe to run on user input, sandboxed,
deterministic, and expressible in JSON so agents can write it.

## Decision (proposed)
**JSONata** for `expr` in mappings, `filter` on routes, and `transform` on routes.
Reasons: JSON-native, side-effect-free, well-known to LLMs, small runtime, has a
timeout hook. Templates for human-readable destinations (email/Telegram) use a
restricted Mustache-style syntax with JSONata inside `{{ }}` for values.

## Alternatives
- **jq** (via `jq-web`/wasm). Powerful; less natural for non-engineers and heavier.
- **JS in an isolate** (`isolated-vm`, QuickJS wasm). Maximum power, maximum
  surface; revisit if JSONata proves limiting.
- **No language, GUI only.** Insufficient for partner-specific reshaping.

## Consequences
- Expressions are evaluated in `packages/core` with a hard time limit and input
  size cap; never in the submit path (only at delivery creation/retry).
- Mapping editor in the UI offers direct pick-a-field first; `expr` is the advanced tab.
