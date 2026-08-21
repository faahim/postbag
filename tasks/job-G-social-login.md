# Job G — Social login (Google, GitHub) with Better Auth

Repo `/Users/faahim/Developer/postbag` (branch `main`; **no git commands**; leave changes in the
working tree; finish with the changed-file list). Read `CLAUDE.md`, `docs/PRINCIPLES.md` (§7
self-host parity, §9 beautiful by default), `docs/DESIGN.md`, `PROGRESS.md`, then
`packages/auth/src/auth.ts`, `apps/server/src/authSetup.ts`, `apps/server/src/env.ts`,
`apps/server/src/app.ts`, `apps/server/src/provisioning.ts`, `apps/web/src/lib/auth-client.ts`,
`apps/web/src/routes/sign-in.tsx`, `apps/web/src/routes/sign-up.tsx`,
`apps/web/src/routes/_app/settings/index.tsx`. Keep `pnpm lint`, `pnpm typecheck`, `pnpm test`
green workspace-wide (`DATABASE_URL=postgres://postbag:postbag@localhost:5433/postbag`).
**Do not add dependencies** — Better Auth 1.6.25 ships Google and GitHub providers; icons are
inline SVG (see 3b). Before writing any UI, invoke the `make-interfaces-feel-better` and
`transitions-dev` skills as `CLAUDE.md` rule 11 requires, and follow `docs/DESIGN.md`
(no hardcoded colour classes; motion via tokens).

**File boundary:** `packages/auth/**`, `apps/server/src/{env.ts,authSetup.ts,app.ts}`,
`apps/server/src/routes/v1/authProviders.ts` (new), `apps/server/src/**/*.test.ts`,
`apps/web/**`, `apps/server/.env.example` / `docker-compose.yml` env docs if they list env vars.
Do not touch `api/openapi.yaml` by hand (it is generated — run `pnpm openapi:export` after adding
the route), `docs/`, `PROGRESS.md`, `README.md`, `packages/{cli,mcp,sdk}`.

## 1. Server

### 1a. Env (optional — self-host parity)
Add to `apps/server/src/env.ts`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`,
`GITHUB_CLIENT_SECRET` — all `z.string().optional()`. A provider is **enabled iff both its id and
secret are set**; half-configured pairs throw at boot with a clear message naming the missing
variable. Nothing else changes for operators who set none of them.

### 1b. `createAuth` in `packages/auth`
Extend `CreateAuthOptions` with
`readonly socialProviders?: { readonly google?: { clientId: string; clientSecret: string }; readonly github?: { … } }`
and pass it through to `betterAuth({ socialProviders })` — only the providers present. GitHub:
request the `user:email` scope so private-email users still get an address (Better Auth's
GitHub provider does this by default; verify, don't assume). Configure
`account: { accountLinking: { enabled: true, trustedProviders: ["google", "github"] } }` so a
user who signed up with email+password can later click "Continue with Google" on the same
address and land in the same account (and vice versa). Keep `emailAndPassword` enabled.

Confirm (with a test) that `databaseHooks.user.create.after` — and therefore
`provisionPersonalOrganization` — runs for users created through a social sign-in, not just
`signUp.email`. Approach: call `auth.api` with a mocked provider token is heavy; acceptable
alternative is a unit test that drives the Better Auth adapter's user-create path the same way
the OAuth callback does (look at how Better Auth creates users on social sign-in and assert the
hook fires), or an integration test with the Drizzle adapter inserting via the internal adapter.
If neither is practical, say so explicitly in the report rather than claiming coverage.

### 1c. Public discovery endpoint
`GET /v1/auth/providers` — **no auth required** (register it outside `requireOrg`, like the
submit path; keep it in the OpenAPI doc with `security: []`, tag `discovery`,
`operationId: auth_providers`). Response:
```json
{ "email_password": true, "social": ["google", "github"], "sign_in_url": "https://postbag.dev/app/sign-in" }
```
`social` lists only enabled providers, in that order. The SPA reads this to decide which
buttons to render, so a self-hosted instance with no providers shows none. Test: with no env →
`social: []`; with both → both; cached for 60 s via `Cache-Control: public, max-age=60`.

Run `pnpm openapi:export` so `api/openapi.yaml` and the SDK types include the new operation
(regenerate `packages/sdk/src/schema.d.ts` with `pnpm --filter @postbag/sdk generate`).

### 1d. Redirects
After OAuth, Better Auth redirects to the `callbackURL` the client passed. The SPA passes
`/app` (sign-in) and `/app?welcome=1` for new users via `newUserCallbackURL`; errors go to
`/app/sign-in?error=<code>` via `errorCallbackURL`. Make sure `trustedOrigins` already covers
`APP_URL` (it does) — no change needed unless tests show otherwise.

## 2. Dashboard (`apps/web`)

### 2a. Provider buttons on sign-in and sign-up
Fetch `GET /v1/auth/providers` once (TanStack Query, `staleTime: Infinity`) and render, **above**
the email form, one full-width secondary button per enabled provider: "Continue with Google",
"Continue with GitHub", each with the provider's monochrome mark (inline SVG, `currentColor`,
16 px — Google's official mark is multicolour; use the monochrome "G" for the secondary-button
style, it reads fine and keeps the palette ours). Between buttons and form: a hairline divider
with "or" centred. While the providers request is loading, render the email form only (no
layout shift: reserve the space with a skeleton of the same height only if at least one provider
is expected — i.e. when the hosted build flag `import.meta.env.VITE_HOSTED` is set; otherwise
render nothing until loaded). Clicking calls
`signIn.social({ provider, callbackURL: "/app", newUserCallbackURL: "/app?welcome=1", errorCallbackURL: "/app/sign-in?error=oauth" })`
and shows a pressed/loading state until the redirect happens. Both pages share one
`<SocialButtons intent="sign-in" | "sign-up" />` component.

If `?error=` is present on sign-in, show the existing error surface with a human sentence
("Google sign-in didn't complete. Try again or use your email and password.").

### 2b. Settings → Connected accounts
In `apps/web/src/routes/_app/settings/index.tsx` add a "Connected accounts" card: list
`authClient.listAccounts()` (provider, email if available, connected date); for each enabled
provider not yet linked, a "Connect" button (`authClient.linkSocial({ provider, callbackURL: "/app/settings" })`);
"Disconnect" (`unlinkAccount`) disabled with a tooltip when it is the only sign-in method and
the user has no password. Designed empty state when nothing is connected.

### 2c. Copy
Sign-up page subtitle keeps the three-minute promise. Button labels are exactly "Continue with
Google" / "Continue with GitHub". No "Sign up with" vs "Sign in with" split — Better Auth
handles both through the same call.

## 3. Tests
- Server: env validation (half pairs rejected), `/v1/auth/providers` shapes, provisioning hook on
  social user creation (see 1b caveat), OpenAPI contains `auth_providers` with empty security.
- Web: `SocialButtons` renders nothing with `social: []`, one button per provider otherwise,
  and calls `signIn.social` with the right args (existing test setup in `apps/web`; if there is
  none, add a minimal Vitest + Testing Library setup only if the deps already exist — otherwise
  skip web unit tests and say so).

## Acceptance
- [ ] With `GOOGLE_*`/`GITHUB_*` unset: nothing changes; `/v1/auth/providers` → `social: []`
- [ ] With both set: buttons render on sign-in and sign-up; OAuth round-trip creates a user **and**
      their personal org/project (verified manually by the orchestrator in production)
- [ ] Email+password user can link Google with the same email and keep one account
- [ ] Connected-accounts card in settings
- [ ] `pnpm lint && pnpm typecheck && pnpm test` green; `pnpm openapi:export` run

## Not in this job (the orchestrator does these)
Creating the OAuth apps (Google Cloud Console, GitHub), Coolify env vars, docs, PROGRESS,
`apps/site` copy ("Sign in with Google or GitHub" on the pricing/landing CTA).
