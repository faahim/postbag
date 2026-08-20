# @postbag/auth

Better Auth configuration shared by the server. It configures email/password sessions,
organizations, invitations, and hashed API keys; it does not mount HTTP routes.

Organization-owned keys use the `pb_live_` secret prefix and metadata shaped as
`{ scopes: ("manage" | "read" | "submit")[] }`; `hasScope` and `requireScope` fail closed
on malformed metadata. Better Auth records exposed by Postbag use `org_`, `usr_`, and
`key_` ids, while its internal session/account records use random UUIDs.

Regenerate the Better Auth Drizzle schema after plugin changes with:

```sh
pnpm --filter @postbag/auth exec auth generate --config src/generate.ts --output ../db/src/schema/auth.ts
```
