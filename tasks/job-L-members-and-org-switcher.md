# Job L — Members, invitations, roles, and the organization switcher

Repo `/Users/faahim/Developer/postbag` (branch `main`; **no git commands**; leave changes in the
working tree; finish with the changed-file list). Read `CLAUDE.md` (golden rules 2, 6, 8, 11),
`docs/PRINCIPLES.md` §1 (the operator persona is the business), `docs/DOMAIN-MODEL.md` (Membership:
`owner | admin | member`), `docs/AGENT-NATIVE.md`, `PROGRESS.md`, then `packages/auth/src/auth.ts`
(Better Auth `organization()` plugin — read its options in `node_modules/better-auth` for invitations,
`sendInvitationEmail`, roles, `setActive`), `apps/server/src/middleware/requireOrg.ts` (how the
active org is resolved — note the "most recent membership" fallback), `apps/server/src/provisioning.ts`,
`apps/server/src/routes/v1/{me,apiKeys,authCodes}.ts`, `apps/server/src/lib/otpEmail.ts` (Resend
sender pattern), `apps/web/src/lib/auth-client.ts` (has `organizationClient()` already),
`apps/web/src/components/app-shell/topbar.tsx`, `apps/web/src/routes/_app/settings/index.tsx`,
`packages/cli/src/commands/*.ts`. Keep `pnpm lint`, `pnpm typecheck`,
`DATABASE_URL=postgres://postbag:postbag@localhost:5433/postbag pnpm test` green. No new deps. Before
UI, invoke `make-interfaces-feel-better` and `transitions-dev` and follow `docs/DESIGN.md` (every list
has a designed empty state). Regenerate `api/openapi.yaml`, SDK and MCP operations with the usual
scripts; never hand-edit them. Do not touch `apps/site/**`, `docs/`, `PROGRESS.md`.

## Why
A user can already belong to many organizations in the data model (Better Auth org plugin; `member`,
`invitation` tables), but nothing lets anyone invite, switch, or distinguish roles. Fahim manages
Postbag for friends/clients and must be a member of their orgs **and** keep his own. That is the
operator persona, and it must work for agencies too.

## 1. Active organization — fix the seam first
- Fallback in `requireOrg` for sessions with no `activeOrganizationId`: **the organization the user
  owns** (oldest owner membership), not the most recent membership. A new invitation must never
  change someone's default dashboard. Test it.
- `POST /v1/me/active-organization` `{ organization_id }` (`operationId: me_set_active_organization`,
  session only; membership required) → sets `session.activeOrganizationId` through Better Auth's
  `setActiveOrganization`. `GET /v1/me` gains `organizations: [{ id, slug, name, role, is_active }]`
  (only orgs the user is a member of — this is the user's own data, not cross-tenant).
- API keys are unaffected (a key is bound to one org).

## 2. Members and invitations (API, org-scoped, in the contract)
Thin wrappers over Better Auth's organization API so the dashboard, CLI and MCP share one surface:
- `GET /v1/members` (`members_list`): id, user { id, name, email }, role, joined_at.
- `PATCH /v1/members/{memberId}` (`members_update_role`) — owner only; cannot demote the last owner.
- `DELETE /v1/members/{memberId}` (`members_remove`) — owner/admin; a member may remove themselves
  (leave) unless they are the last owner.
- `GET /v1/invitations` (`invitations_list`): pending invitations (email, role, expires_at, invited_by).
- `POST /v1/invitations` (`invitations_create`) `{ email, role }` — owner/admin; sends an email via
  Resend (subject "{Inviter} invited you to {Org} on Postbag"; plain + minimal HTML; link to
  `{APP_URL}/app/invitations/{id}`); 7-day expiry; re-inviting resends.
- `DELETE /v1/invitations/{id}` (`invitations_revoke`).
- `POST /v1/invitations/{id}/accept` (`invitations_accept`) — **session only**, the invitee's email must
  match the session user's email; on success the org becomes the active org for that session.
  Public `GET /v1/invitations/{id}` (`invitations_get`, `security: []`) returns just `{ organization:
  { name }, invited_by_name, role, expires_at, email_hint }` (masked email) so the accept page can render
  before sign-in.
- Role semantics (enforce in the routes, with tests): **owner** — everything incl. delete org, billing
  (future), API keys, members/roles; **admin** — everything except billing, deleting the org, changing
  owners; **member** — read everything, create/edit forms, destinations, routes, streams; cannot
  manage members, API keys, or org settings. Existing routes: add the check where it's cheap
  (API keys → owner/admin; org settings → owner/admin); don't boil the ocean — list what you gated.
- Events: `member.invited`, `member.joined`, `member.role_changed`, `member.removed` in the org's
  event log with the acting user.

## 3. Dashboard
- **Org switcher** in the topbar (left of the user menu): current org name with the VIP badge if
  present (job K added it); a menu listing the user's orgs with role chips, "Create organization"
  (Better Auth `organization.create` + our provisioning for settings/default project — reuse
  `provisionPersonalOrganization`'s pieces), and the switch sets active org then reloads queries
  (invalidate everything under the org). Keyboard accessible; ⌘K palette gets "Switch to …" entries.
- **Settings → Members**: table of members (avatar initial, name, email, role select for owners,
  remove), pending invitations section with resend/revoke, "Invite" inline form (email + role) with
  the standard success transition. Designed empty state ("It's just you here" + invite CTA).
- **Accept page** `/app/invitations/:id`: shows org + inviter; if signed out → sign-in/sign-up with
  `redirect` back; if signed in with a different email → explain and offer sign-out; accept → lands in
  the new org with a short welcome moment.
- Sign-up via invitation: a user who signs up from the accept page still gets their own personal
  org (provisioning unchanged) **and** joins the inviting org; their active org becomes the inviting
  org for that first session.

## 4. CLI
`postbag orgs list|switch <slug-or-id>`, `postbag members list|remove <id>|role <id> <role>`,
`postbag invitations list|create --email … --role …|revoke <id>`. (Accept stays browser-only.)

## Tests
requireOrg fallback; every route's role matrix (owner/admin/member/outsider → expected status);
last-owner protections; accept with matching/mismatching email; event emission; `/v1/me.organizations`;
OpenAPI sync picks up new operations with correct security.

## Acceptance
- [ ] Owner-first active-org fallback; `me_set_active_organization`; `/v1/me.organizations`
- [ ] Members + invitations endpoints with role enforcement and emails
- [ ] Topbar org switcher, Settings → Members, accept page, ⌘K entries
- [ ] CLI commands; contract/SDK/MCP regenerated
- [ ] `pnpm lint && pnpm typecheck && pnpm test` green; web + CLI build
