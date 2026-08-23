# ADR-008 — Anonymous, claimable quickstart for agent-first provisioning

**Status:** Accepted 2026-08-23; implemented locally, production launch gated

## Context

Postbag's agent-assisted signup already lets a person hand an emailed code to an
agent, after which the agent receives an API key and can complete the setup. That
flow is fast, but it still interrupts the job before the agent can prove that the
form works.

For an agent-native product, the stronger first experience is for the agent to
finish the safe, reversible part first: provision a form, wire it into the site,
send a test submission and verify that Postbag stored it. The owner can then claim
that work instead of creating an account in advance.

Anonymous provisioning adds an abuse and retention surface. It cannot be allowed to
send email, Telegram messages or webhooks before a person claims it.

## Decision

1. Postbag will provide a public, unauthenticated quickstart that creates a bounded
   **sandbox Form** with a 24-hour expiry.
2. The response will be immediately useful to an agent: it returns the Form's submit
   URL, framework snippets, test-and-verify instructions, expiry, a single-use claim
   URL and literal `next` calls.
3. The sandbox accepts and durably stores test Submissions, so the agent can prove
   the integration. It creates no active Destination or Delivery before claim.
4. Claiming requires human authentication. Claiming atomically moves the sandbox
   resources into the person's organization and consumes the claim token. Delivery
   remains off until a Destination is configured and any required verification is
   complete.
5. The endpoint must be idempotent and tightly bounded by expiry, request and
   submission limits, payload limits, bot controls and abuse monitoring. Expired,
   unclaimed sandboxes and their Submissions are deleted by an explicit retention
   job.
6. The authenticated `/v1/quickstart` remains the full path for existing accounts.
   The implementation may use a distinct public route so authentication and rate
   limits are unambiguous; the exact route belongs in the OpenAPI change.
7. Marketing may prepare future-state copy around “finish the form first; claim it
   when you are ready,” but no public surface may present anonymous provisioning as
   available until the deployed flow has been verified end to end.

## Alternatives

- **Keep account-first onboarding.** Lower abuse risk and already shipped, but the
  person must stop the agent before the form exists. Rejected as the long-term
  default because it weakens the most distinctive agent-native experience.
- **Let anonymous forms deliver immediately.** The shortest demo, but turns Postbag
  into an unauthenticated outbound-message relay. Rejected.
- **Create a disposable account for the agent.** Hides signup rather than removing
  it, complicates ownership and recovery, and gives an anonymous actor more
  capability than it needs. Rejected.

## Consequences

- The first-run story becomes: ask an agent to add a form, watch it create and test
  the Form, then claim the finished setup.
- Unclaimed Forms are deliberately useful but inert: they demonstrate durable
  receipt, not delivery.
- Claiming, cleanup and rate limiting are security boundaries and need live
  database, concurrency and abuse-path tests before launch.
- Agent docs, CLI/MCP affordances and the marketing site can converge on the same
  claimable workflow once the API contract ships.
