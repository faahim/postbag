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

> Your agent can build, wire and test your form before you even sign up. Claim it
> whenever you want.

**Primary action**

> Copy agent prompt

The button copies one direct instruction to install the Postbag skill and set up a
working contact Form. Its geometry stays fixed while the icon and label change to
confirm the copy.

**Secondary action**

> Self-host Postbag

### Useful supporting lines

These are the canonical phrasings. Reuse them verbatim where they fit, so the same
promise never exists in three wordings.

- **Agent-native:** Your agent can set up and test the form. The dashboard is
  there when you want it.
- **Open source:** Run it here, or run it yourself. Nothing important is held back.
- **Cloud:** The same Postbag, without the server chores.
- **Durability:** We save every message before we try to send it anywhere.
- **Routing:** One form or fifteen sites — everything lands in one tidy place.
- **Pricing:** Every plan gets the whole product. Plans differ by room, not
  features.

### Homepage narrative

Value first, mechanism deferred. Each section answers a reader's question:

1. The promise, and who does the work: your forms have somewhere to go, and your
   agent can take it from here.
2. "Will it fit my site?" — one URL, whatever your site already uses, with a live
   form to try.
3. "Can anything get lost?" — saved the moment it arrives; sending comes second.
4. "What does the agent actually do?" — builds, wires, proves; you claim.
5. "What if I have lots of forms?" — fifteen sites, one tidy place.
6. "Why should I trust that?" — the promises are real rules, shown as an
   artifact, framed so nobody has to read them.
7. "Where does it go?" — your inbox, Telegram, anything with a URL.
8. "Is it really mine?" — cloud and self-hosting are two doors into the same
   product.

## Voice

Postbag sounds like Fahim explaining a tool he cares about to a friend at the same
desk. Warm, plain, a little playful, never impressed with itself. The reader might
be a developer, a vibe coder, or neither — the words have to work for all three.
Leave the social-media shorthand, emoji, slang, and self-conscious quirks out.

There are **two registers**. Know which one you are writing in before you type.

### The marketing register

Homepage, features, use cases, pricing, about, compare, CTAs, FAQ, empty states,
404 — anywhere a person is deciding whether they like us.

- **Talk about what the reader gets, never about how Postbag works inside.** The
  machinery is the agent's business; deferring it to the agent *is* the product
  promise. If humans must understand the internals to want Postbag, the page has
  failed.
- Calibration: warm 8/10 · casual 7/10 · humorous 4/10 · technical 2/10 ·
  **concrete 9/10**. Plain is not vague — trust claims need specifics ("if your
  email is down all weekend, nothing is lost; it's all still here on Monday"),
  just never internals.
- **Ordinary words:** form, message, inbox, send, save, claim, keep. The fixed
  product nouns (Submission, Stream, Schema, Mapping, Route, Delivery, Drift)
  belong to the product register and do not appear on marketing pages. "Form" is
  an ordinary word here — lowercase.
- **Blocklist on marketing pages:** schema, mapping, stream, outbox, worker,
  idempotency, constraint, versioned, transaction, payload, HMAC, Postgres,
  database. If a sentence needs one, the sentence belongs in the docs.
- **Humor is dry, kind, and brief.** The reference joke: "This form is a Postbag
  form. Of course it is." Never near data loss, security, or billing. Never wacky.
- **Showing the machine as an artifact is welcome** — a real API response, a real
  compose file, a real database rule, framed so the reader knows they never have
  to read it ("this is what your agent sees; you never have to"). *Explaining*
  the machine in prose is not.
- **Tell one small story per surface.** The strongest warmth is a reader
  recognising their own Saturday, not a joke. Each major surface gets at most
  one micro-story — a person, a moment, a near-miss, a quiet save. The
  reference story (homepage, Journey section): *"Someone fills in your form at
  2am on a Saturday. Your email is mid-outage. On Monday the message is in
  your inbox like nothing happened."* Everything around the story stays
  declarative; two stories on one page cancel each other out.
- **Subtraction budgets.** A page earns trust by saying each thing once: lede
  ≤ 20 words (the page's one story may run longer), one supporting paragraph
  per section, footnote items only when they add a fact the section has not
  already stated, FAQ answers ≤ 40 words. If a sentence restates what a
  neighbouring section already said, cut it — repetition across sections is
  verbosity too.
- **The read-aloud test**, before anything ships: would you say this sentence,
  out loud, to a friend who asked what Postbag is? If not, rewrite it.

### The product register

Docs, quickstart, API reference, dashboard, error messages, /for-ai-agents, and
agent-facing files (llms.txt, OpenAPI, the skill).

- Technically precise: 9/10. The fixed vocabulary is law here: Form, Submission,
  Stream, Schema, Mapping, Destination, Route, Delivery, Drift — capitalized,
  one word per concept, no synonyms.
- Still human: short sentences, concrete verbs (save, route, test, retry, run,
  inspect), facts before adjectives.
- Machine docs speak literally to agents. Both registers stay bluff-free.

### Rules for both

- Lead with what happens for the reader; the mechanism comes second, if at all.
- Use **I** only when Fahim is genuinely speaking, such as About or a founder
  note. "We" may refer to Postbag-the-service; never invent a team.
- Never joke about security, billing, data loss, or blocked work.

Avoid:

`seamless`, `powerful`, `robust`, `leverage`, `supercharge`,
`production-ready`, `enterprise-grade`, `AI-powered`, `effortless`,
`revolutionary`, `magic`, `just works`

### Rewrite examples

Instead of:

> No dashboard, no human in the loop.

Write:

> Your agent can run the setup. The dashboard is there when you want it.

Instead of:

> Submissions are stored durably and delivered through an attempt-tracked outbox.

Write:

> We save every message before we try to send it anywhere. If sending fails, the
> message stays put — and we keep trying.

Instead of:

> A Stream gives Forms one versioned output Schema. Mappings settle their
> different field names before Routes send the shared shape onward.

Write:

> Forms on fifteen sites? Postbag lines them all up — mismatched field names and
> all — so everything arrives in one tidy place. Your agent does the lining up.

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
5. Is it in the right register — ordinary words on marketing surfaces, fixed
   vocabulary on product surfaces — and does every sentence pass the read-aloud
   test?
6. Does it still feel like Postbag with the logo removed?

If the last answer is no, the surface is relying on decoration instead of identity.
