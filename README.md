# Postbag

**A form backend that routes.** Point any HTML form at a Postbag endpoint and it
lands in your inbox — then goes wherever it should: email, Telegram, a webhook, a
partner, your CRM. Built for people who run many sites, and for the AI agents that
build them.

```html
<form action="https://api.postbag.dev/s/fm_8f3kq2" method="POST">
  <input name="email" type="email" required>
  <textarea name="message"></textarea>
  <button>Send</button>
</form>
```

That's the whole integration for one form. Everything else — grouping forty forms
into one stream, mapping their different fields onto one shape, sending that shape
to a partner between two dates, a daily digest, never losing a submission — is there
when you need it and invisible when you don't.

> **New here (human or AI agent)? Read [`CLAUDE.md`](./CLAUDE.md) first.**

## Why it exists

Every website has forms. Every form needs somewhere to go. Formspree and friends
solve "somewhere" for one site; they fall over when you have fifteen sites feeding
one partner with fifteen slightly different forms. Postbag is the **source of truth**
for what each form collects, what each downstream system receives, and the versioned
contract between them.

## The one idea

> **The database makes it correct; events make it fast.**

A submission is accepted the instant it is a row. Delivery is a durable outbox that a
worker drains with retries. Realtime nudges are an accelerator, never a transport.
If every event stream in the system died, every submission would still arrive — late,
never lost. (Inherited from the lead pipeline this generalises; see
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).)

## Status

**Phase 1 — MVP live** at [postbag.dev](https://postbag.dev) (site, docs, dashboard at
`/app`, API at `/v1`). See [`PROGRESS.md`](./PROGRESS.md) for the live blueprint and
[`docs/ROADMAP.md`](./docs/ROADMAP.md) for phases.

## Documentation

Start at [`docs/README.md`](./docs/README.md).

## License

The server, dashboard, site and domain packages (`apps/*`, `packages/core`, `packages/db`,
`packages/auth`) are licensed under [AGPL-3.0](./LICENSE). The client packages that run
inside your own code — `@postbag/sdk`, the `postbag` CLI and `@postbag/mcp` — are
[MIT](./packages/sdk/LICENSE). Rationale in [ADR-006](./docs/decisions/ADR-006-license-and-business-model.md).
