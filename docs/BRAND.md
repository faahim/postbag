# Brand

This is the working source of truth for Postbag's positioning, voice, and visible
identity. Keep it short enough to use while writing a page or building a state.
Implementation details live in [DESIGN.md](./DESIGN.md).

## The idea

> **Your forms have somewhere to go.**

A Form has a dependable place to land. Postbag saves each Submission, keeps the
record, and routes it where it belongs.

The fuller thought is:

> **Somewhere to go. Somewhere that is yours.**

"Yours" means:

- **Your workflow.** A person can use the dashboard. An agent can use the complete
  API, CLI, MCP server, and skill.
- **Your infrastructure.** Use Postbag Cloud or run the same product yourself.
- **Your record.** Postbag stores a Submission before it tries to deliver it.

## Positioning

**Postbag is the open-source form backend built for agents.**

Agent-native is the operating model, not an AI feature. An agent can discover
Postbag, create a working Form, wire it into a site, submit a test, read the stored
Submission, claim the Form, add Destinations and Routes, and verify Delivery.

Anonymous provisioning is live. Before signup, an agent can create a 24-hour
sandbox Form with a stable Form id and submit URL. It can admit up to five test
Submissions of up to 16 KiB each and prove durable receipt. The sandbox capability
token is shown only at creation and remains usable for status and claim until the
sandbox is claimed or expires. An unclaimed sandbox creates no Destination, Route,
Delivery, Event, or outbound traffic.

After authentication and claim, the same Form id and submit URL remain. A
Destination and Route are required before new Submissions can create outbound
Delivery. Copied test Submissions are never delivered retroactively.

### Message order

Use these layers in order. Most surfaces need one or two, not all four.

1. **Belonging:** Your forms have somewhere to go.
2. **Agency:** Your agent can set up and manage the full Form workflow.
3. **Ownership:** Use Postbag Cloud or self-host the same open-source product.
4. **Trust:** Postbag saves first, then routes. Every attempt stays on the record.

Routing across many projects is the expansion story. Explain it after the single
Form promise is clear.

### Open source

Open source means ownership, not bargain positioning.

- The service, dashboard, and site are AGPL-3.0-only.
- The SDK, CLI, and MCP server are MIT.
- Self-hosting is a first-class offering, not a reduced community edition.
- Cloud sells operation and convenience: hosting, upgrades, backups,
  deliverability, and less infrastructure to think about.

Say **"open source"** and **"self-host the same product."** Do not imply that the
whole repository is permissively licensed or claim "no lock-in" without explaining
the licence split.

### Claims we do not make

- Postbag is not yet "the standard," "the default," or "the leading" form backend.
- Postbag is not "AI-powered." Agents operate it through explicit contracts.
- A sandbox proves receipt, not outbound Delivery.
- Self-host parity does not mean every hosted provider is bundled. It means every
  capability has a self-host path.

## Core copy

### Homepage

**Headline**

> Your forms have somewhere to go.

**Lede**

> Your agent creates, wires and tests a working Form before you sign up. Claim it
> whenever you want.

**Primary action**

> Copy agent prompt

The button copies one direct instruction to install the Postbag skill and set up a
working contact Form. Its geometry stays fixed while the icon and label change to
confirm the copy.

**Secondary action**

> Self-host Postbag

### Useful supporting lines

- **Agent-native:** Your agent can set up and test the Form. The dashboard is there
  when you want it.
- **Open source:** Run it here, or run it yourself. Nothing important is held back.
- **Cloud:** The same Postbag, without the server chores.
- **Durability:** We save the Submission before we try to send it anywhere.
- **Routing:** One Form or fifteen sites. Postbag keeps every Route understandable.
- **Pricing:** Every product capability is on every plan. Plans differ by limits.

### Homepage narrative

1. The emotional promise and agent handoff.
2. One submit URL and a stored test Submission.
3. The agent creates, wires, and proves a sandbox Form.
4. The owner claims it; the agent adds a Destination and Route.
5. Save first, deliver second, retry with a record.
6. One Form grows into shared Schemas, Routes, and many projects.
7. Cloud and self-hosting are two doors into the same product.

## Voice

Postbag sounds like Fahim explaining a tool he cares about to another developer at
the same desk. Keep the warmth and plain honesty. Leave the social-media shorthand,
emoji, slang, and self-conscious quirks out of product copy.

### Calibration

- Warm: 8/10
- Casual: 7/10
- Formal: 3/10
- Humorous: 2/10
- Technically precise: 9/10

### Rules

- Lead with what happens for the user, then explain the mechanism.
- Prefer short sentences and concrete verbs: save, route, test, retry, run, inspect.
- Put facts before adjectives.
- Keep Postbag's fixed nouns exact: Form, Submission, Stream, Schema, Mapping,
  Destination, Route, Delivery, and Drift.
- Use light humour only when it releases tension. Never joke about security,
  billing, data loss, or blocked work.
- Use **I** only when Fahim is genuinely speaking, such as About or a founder note.
  Never invent a team.
- Machine docs speak literally to agents. Marketing speaks to people. Both stay
  bluff-free.

Avoid:

`seamless`, `powerful`, `robust`, `leverage`, `supercharge`,
`production-ready`, `enterprise-grade`, `AI-powered`, `effortless`,
`revolutionary`, `magic`

### Rewrite examples

Instead of:

> No dashboard, no human in the loop.

Write:

> Your agent can run the setup. The dashboard is there when you want it.

Instead of:

> Submissions are stored durably and delivered through an attempt-tracked outbox.

Write:

> We save the Submission before we try to send it anywhere. If Delivery fails, the
> Submission stays put and every attempt remains on the record.

Instead of:

> Unlock powerful self-hosting capabilities with complete feature parity.

Write:

> Run Postbag yourself. It is the same product, with nothing important held back.

## Visual language

The direction is **tactile routing**: a quiet digital receiving surface where Form
planes arrive, settle, and move onward.

> **quiet · optical · precise**

### Palette and material

- Midnight ink for committed brand environments.
- Ink-indigo for structure and optical depth.
- Periwinkle for primary action and active routing.
- Form white for received data and moments of clarity.
- Neutral graphite and white for working product surfaces.
- Red only for destructive or rare semantic states.

Use restrained grain, optical depth, and tinted layered shadows. Do not texture
inputs, code, payloads, or dense tables.

The canvas itself carries a fine, static material grain in light and dark modes.
It should remain visible in the breathing room across marketing, documentation,
auth, and product shells. Cards and working surfaces sit above it as quieter,
more opaque planes. Brand-ink environments may use the same grain at a slightly
higher intensity, but never enough to compete with type or the receiving imagery.

### Shape family

- The settled pocket logo is the primary mark. Do not reopen it.
- A receiving aperture, a Form plane, and a restrained route trace form the
  supporting visual family.
- The old red circular postmark/check badge is retired. Status and empty-state
  marks use receiving/routing geometry instead.
- Lucide is the ordinary interface icon family. A checkbox, menu selection, or
  copied state may still use a familiar check.

Avoid cartoon bags, postal costumes, robots, mascots, circuit-board density,
decorative arrows, generic rounded-square check badges, and repeated generic cards.

The retired dashboard paths `/bags` and `/bags/:id` exist only as redirects for old
bookmarks. New dashboard code, navigation, and copy use `/streams` and **Stream**.

### Layout

- The approved hero is one continuous receiving environment. Preserve it.
- Give sections generous breathing room and one clear job.
- Prefer planes, split compositions, real artifacts, and hairline structure over
  endless card grids.
- Do not repeat the same layout family down a page.
- The product inherits the identity at lower intensity. It does not carry hero-level
  decoration.

### Motion

Motion must communicate arrival, routing, hierarchy, or feedback.

Signature motions:

1. A Form plane settles into a receiving aperture.
2. A route trace acknowledges a completed action.
3. Live statuses move with a short directional slide.

Use the shared composed ease-out tokens. Motion must be interruptible. Reduced
motion uses a crossfade or instant state change. Nothing loops only to look clever.

### Production hero assets

- `assets/brand/final-source/hero-receiving-pocket-desktop-v5.png`
- `assets/brand/final-source/hero-receiving-pocket-mobile-v5.png`
- `apps/site/public/brand/hero-receiving-pocket-desktop-v5.webp`
- `apps/site/public/brand/hero-receiving-pocket-mobile-v5.webp`

Earlier files under `assets/brand/concepts/` are exploration records, not
production consumers.

## Before shipping a branded surface

1. Which message layer does this surface need?
2. Is the product claim supported by the current API and deployment?
3. Does it use the settled palette, type, shape, and motion tokens?
4. Does it work at desktop, tablet, mobile, keyboard, and reduced motion?
5. Does every visible string use the fixed vocabulary and sound like a person?
6. Does it still feel like Postbag with the logo removed?

If the last answer is no, the surface is relying on decoration instead of identity.
