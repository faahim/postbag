---
title: "Self-hosting Postbag"
description: "Run the same open-source Postbag yourself with Postgres 16, optional private attachment storage, explicit environment settings, and health checks."
order: 32
section: Operate
modified: "2026-08-24"
---

Postbag Cloud and self-hosted Postbag share the same code and core capabilities. A small text-only installation is one application container plus Postgres 16. File attachments additionally require a private S3-compatible bucket such as MinIO, Cloudflare R2, AWS S3, or Backblaze B2. Run the API and worker together, or split the same image by role when you need independent scaling.

## Start with Docker Compose

Build the application image from the public repository:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: postbag
      POSTGRES_USER: postbag
      POSTGRES_PASSWORD: change-me
    volumes:
      - postbag-postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postbag -d postbag"]
      interval: 2s
      retries: 15

  postbag:
    build: .
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://postbag:change-me@db:5432/postbag
      NODE_ENV: production
      PORT: "3000"
      APP_URL: https://forms.example.com
      BETTER_AUTH_SECRET: replace-with-a-long-random-secret
      POSTBAG_ROLE: all
      MIGRATE_ON_BOOT: "true"
      TZ: UTC
      RESEND_API_KEY: re_…
      MAIL_FROM: "Forms <forms@example.com>"
      ANONYMOUS_QUICKSTART_ENABLED: "false"
    ports:
      - "3000:3000"

volumes:
  postbag-postgres: {}
```

Keep the database on a persistent volume and replace every example secret before the first boot.

## Required settings

| Variable                 | What it controls                                                                |
| ------------------------ | ------------------------------------------------------------------------------- |
| `DATABASE_URL`           | Postgres connection string.                                                     |
| `APP_URL`                | Public origin used in submit URLs, embeds, `llms.txt`, and documentation links. |
| `BETTER_AUTH_SECRET`     | Session signing secret. Use a long random value.                                |
| `POSTBAG_ROLE`           | `api`, `worker`, or `all`. Multiple workers are safe.                           |
| `PORT`, `TZ`, `NODE_ENV` | Defaults are `3000`, `UTC`, and `production`.                                   |
| `MIGRATE_ON_BOOT`        | Runs committed Drizzle migrations before the process starts.                    |

## Private attachment storage

Set these variables together to enable multipart file attachments:

| Variable                    | What it controls                                                      |
| --------------------------- | --------------------------------------------------------------------- |
| `STORAGE_ENDPOINT`          | HTTPS endpoint for the S3-compatible service.                         |
| `STORAGE_REGION`            | Provider region; defaults to `auto` for R2-compatible services.       |
| `STORAGE_BUCKET`            | Private bucket name. Public bucket access must remain disabled.       |
| `STORAGE_ACCESS_KEY_ID`     | Bucket-scoped access key.                                             |
| `STORAGE_SECRET_ACCESS_KEY` | Bucket-scoped secret key.                                             |
| `STORAGE_FORCE_PATH_STYLE`  | Set `true` for providers such as local MinIO that require path style. |

Postbag refuses file parts with `503 attachment_storage_unavailable` when storage is not configured; JSON, URL-encoded, and multipart text Submissions continue to work. Self-host attachment limits are configurable through the same organization limit fields reported by `GET /v1/me`.

## Email and sign-in

`RESEND_API_KEY` and `MAIL_FROM` enable email Destinations, email-code authentication, and invitation email. Verify the sending domain before relying on any of those flows.

Google and GitHub OAuth are optional. A provider is enabled only when both its client id and secret are present:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
```

Leave an entire pair unset to disable that provider. A half-configured pair stops startup with a named validation error. Self-hosting does not depend on OAuth.

## Anonymous agent provisioning

`ANONYMOUS_QUICKSTART_ENABLED` defaults to `false`. Set it to `true` to allow agents to create bounded 24-hour sandbox Forms without credentials. `ANONYMOUS_SANDBOX_GLOBAL_LIMIT` caps active sandboxes across the instance and defaults to `1000`.

If you expose public sandbox creation, rate-limit the exact `/v1/public/sandboxes` path at the edge. Do not rate-limit `/s/{formId}` as an anonymous-quickstart measure because the same path receives owned Form Submissions.

Trust forwarded client-IP headers only from your reverse proxy. Otherwise an attacker can bypass source-address limits by supplying those headers directly.

Turning public creation off stops new sandboxes. Existing claim and retention cleanup paths remain available.

## Delivery requirements

Receiving a Submission does not require an outbound provider. Delivery does. Configure the relevant provider, then create both a Destination and a Route.

- Email uses `RESEND_API_KEY` and `MAIL_FROM`.
- Telegram and webhook secrets store their own Destination configuration.
- A Destination without a Route can be tested directly, but it receives no Form Submissions.
- A Form without a Destination and Route still stores incoming Submissions.

## Health and operations

`GET /health` reports database status, worker heartbeat, and the oldest pending Delivery age. The application image also defines a Docker health check.

Logs are structured JSON. Migrations live in `packages/db/drizzle` and run in order. Never edit a migration that has already been applied.

When upgrading from the first attachment release, keep the old worker running until
`object_deletions` is empty. Migration 0009 deliberately refuses to run while legacy
deletion work is pending because those rows predate retained-byte accounting; once the
queue drains, retry the normal deployment.

Back up Postgres independently of the application container. A restore rehearsal matters more than a backup job that has never been opened.

## Upgrade safely

1. Back up Postgres.
2. Build the new image from the release you intend to run.
3. Start it with `MIGRATE_ON_BOOT=true`.
4. Wait for `/health` to report a live database and worker.
5. Submit a `_test` payload through a real Form and confirm its Delivery.

Form and Stream Schemas are immutable versions. Upgrades do not rewrite published Schema contracts.

## Source and licenses

The source is public at [github.com/faahim/postbag](https://github.com/faahim/postbag). The server, dashboard, and site are AGPL-3.0-only. The SDK, CLI, and MCP server are MIT licensed and published on npm.

The Dockerfile builds for arm64 and amd64. Use the same repository image for the API and worker; select the process role with `POSTBAG_ROLE`.
