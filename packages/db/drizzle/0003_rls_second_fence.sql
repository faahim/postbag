-- NOTE: RLS is ENABLED but not FORCED: table owners (and superusers) stay exempt so a
-- self-hosted deployment whose DB user owns the tables keeps working before the request
-- path sets `app.org_id`. The fence applies to `postbag_app`, which the app adopts per
-- request once RLS_ENFORCED is wired (see apps/server/src/env.ts).
-- Job D §5 "Postgres RLS as the second fence" (ARCHITECTURE.md "Multi-tenancy").
--
-- `postbag_app` is a non-owner role with no table-creation rights and no BYPASSRLS. The
-- app's normal connection role (the migration/owner role, e.g. `postbag`) is a member of
-- it, so a session can `SET LOCAL ROLE postbag_app` to drop into the fenced role for the
-- rest of that transaction only, then it reverts automatically at COMMIT/ROLLBACK — plain
-- `SET ROLE` would leak into the next borrower of a pooled connection, so callers must use
-- `LOCAL`. This needs no separate password/credential — self-host stays a single
-- DATABASE_URL — and keeps the submit path and the worker (which claims deliveries across
-- every org by design) on the unrestricted owner role, exactly as the second-fence design
-- requires: "the submit path and the worker use a role/bypass path."
--
-- Every policy denies by default: `current_setting('app.org_id', true)` is NULL until a
-- session runs `select set_config('app.org_id', '<org id>', true)` (the parameterized
-- equivalent of `SET LOCAL app.org_id = …` — `SET` itself takes no bind parameters), and
-- `organization_id = NULL` is never true in SQL, so an unset or wrong org id sees zero rows.
--
-- Deliberately NOT covered: better-auth's own tables (user, session, account,
-- verification, organization, member, invitation, apikey). requireOrg resolves the caller
-- (which organization an API key or session belongs to) by reading `apikey`/`member`
-- *before* `app.org_id` can be known, and better-auth's own query builder talks to those
-- tables directly — fencing them here would break sign-in and key verification. They stay
-- protected the existing way: every query already carries an explicit WHERE on the id
-- being looked up.
CREATE ROLE postbag_app NOLOGIN NOBYPASSRLS;
--> statement-breakpoint
GRANT postbag_app TO CURRENT_USER;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO postbag_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON
  organization_settings,
  projects,
  forms,
  form_schemas,
  form_schema_drafts,
  streams,
  stream_schemas,
  stream_sources,
  destinations,
  routes,
  digests,
  deliveries,
  submissions,
  events,
  drift_events,
  system_webhooks,
  system_webhook_deliveries,
  idempotency_keys
TO postbag_app;
--> statement-breakpoint
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON organization_settings
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON projects
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON forms
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE form_schemas ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON form_schemas
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE form_schema_drafts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON form_schema_drafts
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON streams
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE stream_schemas ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON stream_schemas
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE stream_sources ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON stream_sources
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON destinations
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON routes
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE digests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON digests
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON deliveries
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON submissions
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON events
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE drift_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON drift_events
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE system_webhooks ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON system_webhooks
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE system_webhook_deliveries ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON system_webhook_deliveries
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
--> statement-breakpoint
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY tenant_isolation ON idempotency_keys
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
