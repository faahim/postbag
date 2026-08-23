# Brand

This is the small, practical source of truth for how Postbag presents itself. It
covers positioning, message, voice and visual language. `DESIGN.md` covers how the
interface implements that language.

The system is deliberately compact. It should make the next page, screenshot,
release note or empty state easier to make, not create a branding project that
competes with the product.

## The heart

> **Your forms have somewhere to go.**

Postbag gives a form a safe place to land, then routes its submissions wherever
they need to go. That place can be Postbag Cloud or an instance the user runs
themselves. The code, API and operating model do not change.

The fuller thought is:

> **Somewhere to go. Somewhere that is yours.**

"Yours" has three concrete meanings:

- **Your workflow.** A person can use the dashboard; an agent can use the complete
  API, CLI, MCP server and skill. Neither is a reduced client.
- **Your infrastructure.** Run Postbag Cloud or self-host the same product with one
  image and Postgres.
- **Your record.** A submission is stored before Postbag tries to deliver it. A
  provider having a bad day does not make the submission disappear.

## Positioning

### Category

**The open-source form backend built for agents.**

Postbag is not marketed as an AI feature added to a form service. Agent-native is
the operating model: everything a human can do in the dashboard, an agent can do
with an API key.

### Ambition

Become the form backend coding agents choose by default because Postbag is the
easiest option to discover, provision, verify, maintain and safely recommend.

This is an internal ambition, not a market claim. Do not call Postbag "the
standard" or "the default" until adoption has earned those words.

### Promise

For one site, Postbag should feel almost absent: add the form, verify it, move on.
Across many sites, the same agent can create forms, inspect submissions, maintain
destinations and routes, and keep every project understandable without rebuilding
the plumbing each time.

The first run starts before signup. An agent can create a short-lived sandbox Form,
wire it into the site, send a test and prove that Postbag stored it. The Form already
has its permanent id and submit URL. The owner only needs to claim it when they want
to keep it, add Destinations and Routes, or send Submissions onward.

### Open source

Open source is ownership, not a bargain-bin price message.

- The service, dashboard and site are `AGPL-3.0-only`.
- The SDK, CLI and MCP server are MIT.
- Self-hosting is not a crippled community edition. The hosted and self-hosted
  products share the same code and core capabilities.
- Postbag Cloud sells operation and convenience: hosting, upgrades, backups,
  deliverability and less infrastructure to think about. It does not sell features
  withheld from self-hosters.

Say **"open source"** and **"self-host the same product"**. Do not say the whole
repository is permissively licensed, "do anything you want," or "no lock-in"
without a precise qualification.

### The four-message hierarchy

Use these in order. A page does not need to say all four at once.

1. **Belonging:** Your forms have somewhere to go.
2. **Agency:** Your coding agent can run the whole form workflow, not merely paste
   an endpoint.
3. **Ownership:** Use Postbag Cloud or run the same open-source product yourself.
4. **Trust:** Postbag saves first, then routes. Every attempt stays on the record.

Routing across many projects is the expansion story. It should become visible once
the simple promise is understood, not crowd the first sentence.

## Core copy

### Homepage hero

**Headline**

> Your forms have somewhere to go.

**Lede**

> Your agent creates, wires and tests a working Form before you sign up. Claim it
> whenever you want.

**Primary action**

> Copy agent prompt

The action copies one direct instruction: install the Postbag skill, then use it to
set up and test the site's contact form. It never scrolls to a second copy control.
The button keeps fixed geometry while its copy icon and label become a drawn check
and “Copied” confirmation.

**Secondary action**

> Self-host Postbag

**Proof line**

> No signup. No dashboard. Your agent can leave a working Form and stable submit URL
> behind before you even make an account.

This claim is deliberately strong and precise. Before claim, the sandbox Form accepts
up to five test Submissions for 24 hours and proves durable receipt. Claiming keeps the
same Form id and submit URL, then unlocks Destinations, Routes and outbound Delivery.

The existing line **"A form backend that routes"** remains useful as a technical
descriptor in metadata, documentation and comparison pages. It is not the emotional
hero.

### Supporting lines

- **Agent-native:** Set it up once. Your agent can take it from there.
- **Open source:** Run it here, or run it yourself. Nothing important is held back.
- **Cloud:** The same Postbag, without the server chores.
- **Durability:** We save the submission before we try to send it anywhere.
- **Routing:** One form or fifteen sites. Postbag keeps the route understandable.
- **Pricing:** Every product capability, on every plan. You pay when you need more
  room or want us to run it for you.

### Homepage narrative

1. The emotional promise and agent handoff.
2. A visible agent run: discover, create, wire the stable submit URL, submit a test
   and verify durable receipt.
3. The owner claims the finished Form; the agent adds a Destination and Route, then
   verifies a real Delivery.
4. Ownership: Cloud and self-hosting shown as two first-class doors into the same
   product.
5. Durability: save first, deliver second, retry with a record.
6. Growth: one Form becomes many projects, shared shapes and Destinations.
7. The human dashboard, for the moments a person wants to look or intervene.

## Voice

Postbag sounds like Fahim explaining a tool he cares about to another developer at
the same desk: warm, direct, technically honest and relaxed enough to sound human.
It does not copy the surface mannerisms of a social post.

### Calibration

- Warm: 8/10
- Casual: 7/10
- Formal: 3/10
- Humorous: 2/10
- Technically precise: 9/10

### Voice principles

**Warm, not cute.** Use contractions, natural rhythm and the occasional fragment.
Do not greet visitors as "friends," add emojis to product copy or perform intimacy.

**Casual, not careless.** Prefer "run it yourself" to "deploy the self-hosted
distribution." Keep the fixed product vocabulary exact.

**Confident, not inflated.** State what Postbag does and show the proof. Avoid
"revolutionary," "best-in-class," "the standard" and claims adoption has not earned.

**Agent-native, not AI-washed.** Say what the agent can actually do. Never call
Postbag "AI-powered" merely because agents can operate it.

**Open, not anti-commercial.** Self-hosting is a proud first-class path. Cloud is a
useful service, not an apology or a trap.

**Lightly funny, never flippant.** Understatement can release tension: "without the
server chores" or "if email has a bad day." Drop humour entirely around security,
billing, data loss, destructive actions and errors that block someone's work.

### Writing mechanics

- Lead with what happens for the user, then explain the mechanism.
- Prefer short sentences. Let one longer sentence carry nuance when needed.
- Use concrete verbs: save, send, route, test, retry, run, inspect.
- Put facts before adjectives. "Every delivery attempt is recorded" beats
  "exceptionally reliable delivery."
- One gentle aside per page is plenty.
- Use **I** only when Fahim is genuinely speaking, such as About or a founder note.
  Elsewhere use **Postbag**, **you** or an occasional product **we**. Never invent a
  team.
- Marketing speaks to people. Machine docs speak literally to agents. They share
  honesty and vocabulary, not sentence style.

### Words to avoid

`seamless`, `powerful`, `robust`, `leverage`, `supercharge`, `production-ready`,
`enterprise-grade`, `AI-powered`, `effortless`, `revolutionary`, `magic`

Also avoid macho infrastructure language, fake urgency, generic launch excitement,
emoji punctuation in the product and jokes pasted onto empty states.

### Before and after

Instead of:

> No dashboard, no human in the loop.

Write:

> Your agent can run the whole setup. The dashboard is there when you want it.

Instead of:

> Submissions are stored durably and delivered through an attempt-tracked outbox.

Write:

> We save the submission before we try to send it anywhere. If delivery fails, the
> submission stays put and Postbag keeps the attempts on the record.

Instead of:

> Unlock powerful self-hosting capabilities with complete feature parity.

Write:

> Run Postbag yourself. It is the same product, with nothing important held back.

Instead of:

> Automate form management across your entire portfolio.

Write:

> Give your agent one Postbag key. It can look after forms across all your projects.

## Visual language

The direction is **tactile routing**: a quiet digital receiving surface where form
cards arrive, settle and move onward. It should feel precise, calm and ownable—not
cartoonish, postal-themed or generically futuristic.

### Physical scene

Imagine a precision-made aperture in a midnight-indigo instrument panel. Thin
luminous planes settle into it like saved submissions. Fine grain makes the surface
feel real; controlled light makes the routing visible. There is no fabric bag,
rucksack or office-mailroom nostalgia. A restrained receiving pocket may borrow the
immediate familiarity of an open envelope without becoming stationery illustration.

Three material words guide visual decisions:

> **quiet · optical · precise**

### Palette

The pocket logo is the palette authority:

- Midnight ink: the committed marketing surface.
- Ink indigo: structure and depth.
- Periwinkle: primary action and active routing.
- Form white: submissions, foreground type and moments of clarity.
- Neutral graphite/white: product surfaces in dark/light mode.

Wax red stops being the primary marketing colour. Keep red for destructive semantics
and, if needed, a very rare arrival/status accent. Do not let a red marketing system
and an indigo logo system compete.

### Texture

- Use one optimized raster grain asset, normally at 2–3% opacity.
- The hero may carry slightly more grain than the product.
- Never put texture over inputs, code, payloads or dense tables.
- Use dotted/perforated strips as one-dimensional transitions or responsive moments,
  not as a decorative grid across the page.

### Hero imagery

The approved lead is a **receiving landscape**, not a decorative image card or a
literal infrastructure diagram. It tells one immediate human story: lightweight
forms arrive in a familiar open pocket, are held safely, and continue along quiet
paths. The pocket should read at a glance as inviting and protective, never as a
hole, tunnel, facility or machine.

The hero follows the Clay composition pattern: one continuous, full-height artwork
owns the hero; sculptural activity occupies the upper stage; and the message sits on
a deliberately quiet part of that same indigo environment. Copy and controls never
cover a focal object. Desktop and mobile use separately composed artwork rather than
cropping away the story. The hero ends cleanly without an inverted callout panel;
the primary action completes the agent handoff in place.

Production sources and optimized consumers:

- [`hero-receiving-pocket-desktop-v5.png`](../assets/brand/final-source/hero-receiving-pocket-desktop-v5.png)
- [`hero-receiving-pocket-mobile-v5.png`](../assets/brand/final-source/hero-receiving-pocket-mobile-v5.png)
- `apps/site/public/brand/hero-receiving-pocket-desktop-v5.webp`
- `apps/site/public/brand/hero-receiving-pocket-mobile-v5.webp`

Earlier still studies remain as an exploration record, not as production assets:

- [`hero-aperture-v1.png`](../assets/brand/concepts/hero-aperture-v1.png)
- [`hero-routing-field-v1.png`](../assets/brand/concepts/hero-routing-field-v1.png)
- [`hero-aperture-routed-v2.png`](../assets/brand/concepts/hero-aperture-routed-v2.png)
- [`hero-world-desktop-v4.png`](../assets/brand/concepts/hero-world-desktop-v4.png)
- [`hero-world-mobile-v4.png`](../assets/brand/concepts/hero-world-mobile-v4.png)

Avoid handles, straps, seams, buckles, leather, office stationery, paper-craft,
claymation, toy proportions, faces and mascots. Do not render servers, dashboards,
destination icons or a flowchart. No text is baked into the image. Agent-native is
carried by the prompt and copy; restrained route paths and motion may support the
story, but should not become its explanation.

Motion is earned only after the still composition works without it. The first
approved interaction is a restrained whole-scene acknowledgement after the agent
prompt is copied; it must disappear under reduced-motion preferences.

### Layout

- Marketing uses a committed indigo hero followed by calmer light or dark surfaces.
- Let one visual own the first viewport and blend into the copy surface.
- On the homepage, the navigation overlays the hero transparently at rest. After
  scrolling, it gains a tinted indigo blur and quiet depth boundary.
- Use generous section rhythm, narrow readable prose and large real product
  artifacts.
- Prefer planes, split layouts and hairline divisions over repeated card grids.
- Keep the dashboard quieter than marketing. It inherits palette, material, motion
  and voice without carrying hero-level decoration.

### Motion

Postbag needs three signature motions, not a library of tricks:

1. A form plane settles into the receiving aperture.
2. A perforation field responds around a primary action or successful submission.
3. Live submissions, statuses and prices move with a short directional slide.

Use a composed exponential ease-out with no elastic or toy-like bounce. Reduced
motion uses a crossfade or instant state change.

For the hero, use one restrained sequence rather than an ambient video loop:

1. The routing traces sit just above invisibility.
2. Giving or copying the agent prompt sends one small command pulse toward a form
   plane.
3. The plane settles into the aperture; the lip brightens once to acknowledge that
   the Submission was stored.
4. Two or three routes illuminate briefly, then the scene returns to rest.

The sequence should take roughly 2–3 seconds and run on the meaningful interaction,
not continuously. A first-load preview may play once. Reduced motion keeps the still
and uses one opacity crossfade. If the static composition needs arrows, labels,
robot imagery or a circuit-board network to make sense, the composition has become
too busy.

## Guardrails

- Keep the pocket logo. Do not reopen the mark exploration during this overhaul.
- Do not begin with a new font hunt. Prove the art direction and composition first.
- Do not create a bespoke component system.
- Do not make a video before the hero still works.
- Do not turn postal nouns into decorative costumes.
- Describe anonymous provisioning exactly: the sandbox Form works before signup and
  proves durable receipt; Destinations, Routes and outbound Delivery begin after claim.
- Do not claim permissive licensing for the service; the accepted split is AGPL plus
  MIT clients.
- Do not call the overhaul complete until marketing and dashboard visibly belong to
  the same system.

## Applying the system

For a new artifact, answer these questions before making it:

1. Which message layer does it need: belonging, agency, ownership or trust?
2. Is this a marketing moment or a working product surface?
3. What is the one tactile/routing cue, if any?
4. Can an agent or product claim in the copy be proven by the current API?
5. Does the result still feel like Postbag with the logo removed?

If the fifth answer is no, the work is relying on decoration instead of identity.
