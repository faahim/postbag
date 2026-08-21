# Job H — Agent onboarding without a browser: email-code keys, Agent Skill, landing copy

Repo `/Users/faahim/Developer/postbag` (branch `main`; **no git commands**; leave changes in the
working tree; finish with the changed-file list). Read `CLAUDE.md`, `docs/PRINCIPLES.md` (§1 the
three-minute test, §7 self-host parity, §8 agent-native), `docs/AGENT-NATIVE.md`, `PROGRESS.md`
item 2e, then the code named below. Keep `pnpm lint`, `pnpm typecheck`, `pnpm test` green
workspace-wide (`DATABASE_URL=postgres://postbag:postbag@localhost:5433/postbag`).
**Do not add dependencies** (Better Auth 1.6.25 ships the `emailOTP` plugin; the server already has
`resend`). Before writing site UI, invoke the `make-interfaces-feel-better` and `transitions-dev`
skills and follow `docs/DESIGN.md`.

**Why.** Today an agent cannot do anything until a human opens the dashboard and creates an API
key. here.now's onboarding removes that step: the agent asks for a code by email, the human reads
six digits out of their inbox, the agent gets a key. This job gives Postbag the same path and a
skill file agents can install, so "set up a form on this site" works from a fresh repo in one
conversation with no browser.

**File boundary:** `packages/auth/**`, `apps/server/src/**` (auth routes, `app.ts`, `env.ts`,
`llms.md`, tests), `packages/cli/**`, new top-level `skills/`, `apps/site/src/**`. Regenerate
`api/openapi.yaml` + SDK types with `pnpm openapi:export` and `pnpm --filter @postbag/sdk generate`
— never by hand. Do not touch `apps/web/**`, `packages/mcp/**`, `docs/`, `PROGRESS.md`, `README.md`.

## 1. Email-code sign-in that returns an API key

### 1a. Better Auth `emailOTP` plugin (`packages/auth/src/auth.ts`)
Add `emailOTP` from `better-auth/plugins` with `otpLength: 6`, `expiresIn: 600`, `allowedAttempts: 3`,
`storeOTP: "hashed"`, `disableSignUp: false`, and `sendVerificationOTP` supplied by the caller through a
new `CreateAuthOptions.sendEmailOTP?: (input: { email: string; otp: string; type: string }) => Promise<void>`.
When the option is absent the plugin is still registered but `sendVerificationOTP` throws a clear
error (the server maps it to `501 email_not_configured`). New users created by OTP go through the
same `databaseHooks.user.create.after` as every other path (→ personal org). Confirm with a test,
the same way job G tested social creation (`auth.$context` → internal adapter), or via
`auth.api.sendVerificationOTP` + `auth.api.signInEmailOTP` with a captured OTP.

### 1b. Server endpoints (public, in the OpenAPI doc with `security: []`, tag `discovery`)
`apps/server/src/routes/v1/authCodes.ts`, registered before `requireOrg` like `/v1/auth/providers`.

- `POST /v1/auth/request-code` — body `{ email }` (`z.email()`, lowercased/trimmed). Sends the code
  through `auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } })`. Response `200`
  `{ ok: true, expires_in: 600, next: "POST /v1/auth/verify-code with { email, code, key_name }" }`.
  Always `200` for a well-formed email, whether or not a user exists (no enumeration). Rate limit
  with the existing `TokenBucketLimiter`: 3 per email per 10 min and 10 per client IP per 10 min
  (use the same client-IP resolution as the submit path); over the limit → `429 rate_limited` with
  `hint`. If `RESEND_API_KEY` is unset → `501 email_not_configured`, hint: "Set RESEND_API_KEY and
  MAIL_FROM on the server, or create a key in the dashboard at {APP_URL}/app/settings/api-keys".
  `operationId: auth_request_code`.
- `POST /v1/auth/verify-code` — body `{ email, code, key_name?: string, scopes?: ("manage"|"read"|"submit")[] }`.
  Verifies via `auth.api.signInEmailOTP({ body: { email, otp: code } })`; wrong/expired code →
  `401 invalid_code` (hint mentions 3 attempts and requesting a new code). On success, resolve the
  user's personal organization (the one provisioning created; if the user belongs to several, the
  one where they are `owner`, oldest first) and mint an API key **through the exact same code path
  `POST /v1/api-keys` uses** (extract a shared helper if it is inline today), `scopes` default
  `["manage"]`, `key_name` default `"agent · <YYYY-MM-DD>"`. Response `201`:
  ```json
  { "api_key": "pb_live_…", "key_id": "key_…", "scopes": ["manage"],
    "organization": { "id": "org_…", "slug": "…", "name": "…" },
    "user": { "email": "…", "created": true },
    "next": [ "Store api_key in ~/.config/postbag/credentials.json (mode 0600) or POSTBAG_API_KEY",
              "POST /v1/quickstart to create a routed form in one call",
              "GET /v1/me to see limits and what exists" ] }
  ```
  The key is shown once. `operationId: auth_verify_code`. Do **not** set a session cookie on this
  response — it is a key-minting endpoint for agents, not a browser login.
- The email: plain text + minimal HTML, subject `Your Postbag code: 123456`, body states the code,
  the 10-minute expiry, "an AI agent or the Postbag CLI asked for this on your behalf; if you did
  not, ignore this email". Use the existing email adapter / Resend client and `MAIL_FROM`.
- Tests: request → captured OTP → verify → key works against `/v1/me`; wrong code 401; fourth
  attempt rejected; rate limit 429; unconfigured email 501; new user gets an org; existing user
  keeps their org; OpenAPI has both ops with `security: []`.

### 1c. `llms.txt` (`apps/server/src/llms.md`)
Add a section **"Getting an API key without a browser"** right after the opening, with the two
calls and the one human step in between, plus the `postbag.json` convention. Keep it short; the
whole file must still read top-to-bottom in under a minute.

## 2. CLI: `postbag login` learns the code flow (`packages/cli`)
`postbag login` with no `--api-key` and no `POSTBAG_API_KEY`: prompt "Email (or paste an API key):".
If the input looks like a key (`pb_live_`/`pb_test_` prefix) → existing path. Otherwise call
`auth_request_code`, print "Code sent to <email> — check your inbox", prompt "Code:", call
`auth_verify_code` with `key_name: "postbag-cli · <hostname>"`, save the returned key in the
credentials file, print the org name. `--email <addr>` and `--code <digits>` flags make it
non-interactive in two invocations (`postbag login --email a@b.c` → sends; `postbag login --email a@b.c --code 123456`
→ verifies) so an agent can drive it without a TTY. Update the README's 60-second flow and the
agent section. Tests with the fake-fetch harness: both invocations, key saved with mode 0600.

## 3. Agent Skill (`skills/postbag/SKILL.md` + served copy)
- Create `skills/postbag/SKILL.md` following the Agent Skills format (YAML frontmatter `name: postbag`,
  `description:` one sentence that says when to use it — "Use when a site or app needs a form
  endpoint, contact form, lead capture, or to route submissions to email/Telegram/webhooks" — then a
  body ≤ 150 lines): what Postbag is in three sentences; the decision tree (`postbag.json` exists? →
  reuse `form_id`; `POSTBAG_API_KEY` or credentials file? → use it; otherwise ask the human for their
  email and run the code flow); the quickstart call with a real request/response; the embed snippet;
  how to verify a test submission; the vocabulary; links to `/llms.txt`, `/openapi.json`, `/docs/`.
  Prefer `npx postbag …` commands where they exist, with the raw HTTP equivalent beside each.
- Serve it: `GET /.well-known/skills/index.json` → `{ "skills": [{ "name": "postbag", "url": "{APP_URL}/.well-known/skills/postbag/SKILL.md" }] }`
  and `GET /.well-known/skills/postbag/SKILL.md` (text/markdown, 1-hour cache). Bundle the file into
  the server build the same way `llms.md` is. Test both routes.

## 4. Landing page: "set up your agent in seconds" (`apps/site`)
In `apps/site/src/components/home/AgentNative.astro` (and the `for-ai-agents` page), replace the
current API-only framing with a three-option block that reads in five seconds:
1. **Paste to your agent** — a one-line prompt in a copyable code block:
   `Set up a contact form on this site with Postbag. Read https://postbag.dev/llms.txt first.`
2. **Install the skill** — `npx skills add faahim/postbag --skill postbag` (note: works once the repo
   is public; also show the `/.well-known/skills/` URL).
3. **MCP** — `npx -y @postbag/mcp` with the env var, and the CLI `npx postbag login`.
Below it, the two-call code flow (`request-code` → `verify-code`) as the answer to "how does the agent
get a key?". Update the FAQ entries that currently say the CLI/MCP are "in progress" only if the
orchestrator tells you they are published — otherwise leave the words "in progress" but show the
real command names. Use `CodeBlock.astro` and the existing design tokens; no new colours.

## Acceptance
- [ ] `curl -X POST {APP_URL}/v1/auth/request-code -d '{"email":"…"}'` sends a code;
      `verify-code` returns a working `pb_live_` key and, for a new email, a provisioned org
- [ ] `postbag login` interactive and two-step non-interactive flows work
- [ ] `skills/postbag/SKILL.md` exists and is served at `/.well-known/skills/postbag/SKILL.md`
- [ ] Landing page block as in §4; `astro check` clean
- [ ] `pnpm lint && pnpm typecheck && pnpm test` green; `pnpm openapi:export` run; SDK regenerated

## Not in this job
Anonymous/claimable quickstart (PROGRESS 2e(c), awaiting a decision); dashboard UI; docs pages
beyond llms.txt; publishing.
