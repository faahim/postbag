# Design

Postbag has to be **beautiful**. Not "clean for a dev tool" — beautiful, the kind of
interface people screenshot. That is a product requirement with the same weight as
"never lose a submission", and it is achieved *economically*: an off-the-shelf
component system, one deliberate coat of identity, and relentless attention to
feel. No bespoke design system.

`BRAND.md` is the source of truth for positioning, voice and the tactile-routing
visual direction. This document defines how product and marketing interfaces
implement it.

## 1. Foundation: shadcn/ui, owned

- **shadcn/ui** (Radix primitives + Tailwind), copied into `apps/web/src/components/ui`.
  It is our code, not a dependency — we can change anything and never wait on upstream.
- Works identically in a Vite SPA (ADR-003) or Next.js, so this decision is independent
  of that one.
- Tailwind v4 with CSS variables as the **only** place colours, radii, shadows and motion
  durations are defined. No hardcoded colour classes in components (`text-red-500` is a
  lint error; `text-destructive` is not).
- Tables/inbox on TanStack Table; forms on react-hook-form + zod (same zod schemas the
  API uses, via the SDK); charts with a single restrained library, styled by tokens.

## 2. The coat: what makes it *Postbag* and not "another shadcn dashboard"

The default shadcn look is recognisable and reads as generic. The identity pass is
small in code and must be done deliberately, once, in Phase 1 before any screen is
built:

| Lever | Decision |
|---|---|
| **Typography** | Instrument Sans for UI, Bricolage Grotesque for marketing display moments, and JetBrains Mono for ids, payloads and code. Tabular numerals on every count. Do not begin the overhaul with a font migration. |
| **Colour** | Midnight ink and ink-indigo carry marketing; periwinkle is the primary action and active-routing colour. Product surfaces stay quieter and near-neutral. Red is reserved for destructive semantics and rare status moments. **The marketing site commits to the midnight (dark) look** — light tokens stay parked in the CSS but are not shipped or maintained to the same bar. The dashboard keeps both themes. |
| **Radius & density** | One radius scale, slightly tighter than shadcn default; comfortable density on the inbox, compact in tables. |
| **Signature motif** | The primary logo is two Submissions settling into a pocket. Marketing uses the receiving aperture, luminous Form planes and restrained routing traces. Product UI borrows the same geometry quietly. Status and empty-state marks use that receiving/routing geometry; the old red circular postmark is retired. |
| **Empty states** | Every list has a designed empty state that teaches the next action. The first-run Forms screen *is* the onboarding. |
| **Iconography** | Lucide, one stroke width, never mixed sets. |

## 3. Feel: the rules that make it snappy and delightful

These are non-negotiable on every screen and are checked in review.

- **Motion tokens, not ad-hoc durations.** `--duration-fast/base/slow`, `--ease-out-*`
  defined once; every transition references them. Reduced-motion respected.
- **Composed ease-out, never toy motion.** Identity-facing movement settles quickly
  without elastic or bounce easing. Existing bounce tokens are retired as each
  affected surface moves into the new identity coat.
- **Enter/exit choreography** for lists, sheets, dialogs, toasts; staggered reveals
  on the inbox; never a hard pop unless intentional.
- **Optimistic UI** on every mutation that can be (toggle route, mark spam, retry
  delivery) with rollback on failure. The inbox updates live (SSE on `/v1/events`).
- **Micro-interactions that confirm:** the "copied" state on snippets, the success
  check on destination test, the shake on an invalid mapping.
- **Polish fundamentals:** optical alignment, font smoothing, hairline borders over
  heavy ones, layered shadows, image outlines, `tabular-nums`, focus rings that look
  intentional, hover states on everything clickable.
- **Tactile controls on the grain.** The canvas grain is the heart of the material
  language, and controls sit *on* it physically: buttons carry a top edge that
  catches light, weight underneath, grain blended into the primary face, and a
  press that visibly sinks in (`--btn-*` tokens). Toward tactile hardware, short
  of skeuomorphism. Grain may be used creatively on other surfaces the same way.
- **Graceful media.** Images never flash in: an inline LQIP paints instantly and
  the real image fades + settles over it (`img.media-reveal`); cached loads
  appear immediately.
- **Performance is design:** skeletons over spinners, no layout shift, route-level
  code splitting, keyboard-first (⌘K command palette from day one).

## 4. Process: how this gets enforced

- **Skills are mandatory on UI work.** Any task that touches `apps/web` invokes
  `make-interfaces-feel-better` and `transitions-dev` (and `design-taste-frontend` /
  `frontend-design` for new screens or the marketing site) *before* writing code.
  `CLAUDE.md` golden rule 11 says so; reviewers check for it.
- **Screens are designed before built** for the three hero flows (first-run → first
  email; the submissions inbox; the stream mapping editor). Quick mock or `.pen` first;
  everything else is composed from the system directly.
- **The solo-dev path gets the polish budget first** (Principle 1). Advanced screens
  ship functional-and-consistent, then get their pass.
- **A "feels off" report is a bug**, filed and fixed like one.

## 5. Out of scope

- A bespoke component library or Figma-grade token pipeline.
- Theming per organization (beyond light/dark) until a customer needs it.
- Custom illustration sets beyond the one motif family.
