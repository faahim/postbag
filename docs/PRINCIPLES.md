# Principles

These are constraints, not aspirations. Every feature, screen, endpoint and doc is
checked against them. If a change violates one, either the change is wrong or the
principle needs an ADR to amend it.

## 1. Two personas, one test each

**The solo dev.** Has one contact form on one site. Wants an endpoint and an email.
*Test:* time from signup to first email in the inbox under **three minutes**, meeting
exactly **one** new noun (Form).

**The operator.** Runs many sites — an agency with client sites, a lead-gen business,
a Smedja fleet. Wants forms from many sites grouped, normalised to one shape, and sent
to a partner or a CRM with rules. *Test:* fifteen sites → one partner with a delivery
window, configured **without code and without a support ticket**.

A feature that serves one persona while taxing the other is redesigned or hidden.
The solo dev is the acquisition funnel; the operator is the business. Never dilute
the operator's model to flatter the solo dev — **hide** it.

## 2. Defaults make concepts disappear

Every advanced concept has a default under which it does not exist for the user.

| Concept | The default that makes it invisible |
|---|---|
| Project | A "Default" project is created on signup. Forms live there until the user makes another. |
| Stream | A form with no stream routes directly to destinations. Streams appear the first time a user wants two forms to go to the same place. |
| Form schema | No declared schema + `observe` mode = accept anything. The user never picks a mode; they are just "collecting submissions". |
| Mapping | A route with no mapping is identity passthrough. |
| `managed` schema mode | API/CLI/MCP feature. Never an onboarding step, never a dashboard prompt. |
| Filters, transforms, windows, digests | Absent from the route until opened under "Rules". |

The API exposes all of it, always. The UI reveals it progressively.

## 3. Vocabulary

One word per concept. The API uses the engineering word; the UI may use a friendlier
label, but it is a *label*, not a second concept. Do not invent synonyms in code,
docs, or copy.

| Concept | API / code | UI label (draft) |
|---|---|---|
| Tenant | `organization` | Workspace |
| Folder for forms | `project` | Project |
| Endpoint that receives submissions | `form` | Form |
| One received payload | `submission` | Submission |
| Declared shape of a form | `form_schema` | Fields |
| A named group of forms with a shared output shape | `stream` | Bag *(candidate — on-brand; decide before Phase 1 UI)* |
| The shared output shape of a stream | `stream_schema` | What gets delivered |
| A form's field → stream field assignment | `mapping` | Match fields |
| Somewhere submissions can be sent | `destination` | Destination |
| form/stream → destination with rules | `route` | Send to |
| One attempt-tracked send of one submission via one route | `delivery` | Delivery |
| A change in what a form is actually receiving vs its schema | `drift` | Change detected |

Words we do **not** use: *endpoint* (as a noun for form), *integration*, *channel*,
*hook* (for destination), *entry*, *response* (for submission), *pipeline*.

## 4. Never lose a submission

- A submission is accepted the instant it is a row. The HTTP 200 is the receipt.
- Nothing in the write path makes a network call to a third party.
- Spam, schema violations, rate-limit overflow: **flag or quarantine, never drop.**
  Data is only deleted by explicit user action or retention policy.
- Delivery is a durable outbox with bounded retries and a dead state that is loud.
- Correctness is carried by **unique constraints in the database**, not by
  application logic: one submission per idempotency key, one delivery per
  (submission, route), one digest per (route, period).

## 5. Contract first

- The OpenAPI document is the truth. Dashboard, CLI, MCP server and SDK are clients
  of the same public API; nothing is possible in the UI that is impossible via API.
- Schemas (form and stream) are **versioned, immutable objects**. Submissions and
  deliveries record the version they were validated against.
- Downstream systems subscribe to schema changes; they are never surprised by them.

## 6. Endpoint first, never a form builder

Postbag receives forms. The form lives in the site's HTML (or is rendered by the
site from a schema Postbag serves). The day we add drag-and-drop form building we
are a worse Typeform; we do not add it.

## 7. Self-hostable by design

One Postgres, one container, one compose file. Every feature must work in that
deployment. The hosted product is the same image with billing turned on. No
feature may depend on a cloud-only service that has no self-host path.

## 8. Agent-native is a property, not a feature

An agent holding only an API key must be able to discover the API, create what it
needs, receive the embed snippet, verify a test submission arrived, and wire a
destination — without a browser and without a human. See `AGENT-NATIVE.md`.
Every error carries a `hint` and a `docs` URL. Every create returns what to do next.

## 9. Beautiful by default

Postbag must look and feel stunning — that is a requirement, not a nice-to-have — and
it gets there economically: shadcn/ui owned in-repo, one deliberate identity coat,
motion tokens, and the design skills invoked on every UI change. Details in
`DESIGN.md`. A screen that works but feels off is not done.
