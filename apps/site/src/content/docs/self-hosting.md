---
title: "Self-hosting guide: Docker, Postgres, environment"
description: "Run Postbag yourself: the Docker image (api, worker or all), Postgres 16, docker-compose, every environment variable (DATABASE_URL, APP_URL, BETTER_AUTH_SECRET, POSTBAG_ROLE, MIGRATE_ON_BOOT, RESEND_API_KEY, MAIL_FROM), health checks and upgrades."
order: 32
section: Operate
---

Postbag is one image plus Postgres. The hosted product runs the same image.

## docker-compose

```yaml
services:
  db:
    image: postgres:16-alpine
    environment: { POSTGRES_DB: postbag, POSTGRES_USER: postbag, POSTGRES_PASSWORD: change-me }
    volumes: [ "postbag-postgres:/var/lib/postgresql/data" ]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U postbag -d postbag"], interval: 2s, retries: 15 }
  postbag:
    build: .                       # or the published image when available
    depends_on: { db: { condition: service_healthy } }
    environment:
      DATABASE_URL: postgres://postbag:change-me@db:5432/postbag
      NODE_ENV: production
      PORT: "3000"
      APP_URL: https://forms.example.com
      BETTER_AUTH_SECRET: a-long-random-secret
      POSTBAG_ROLE: all            # api | worker | all
      MIGRATE_ON_BOOT: "true"
      TZ: UTC
      RESEND_API_KEY: re_…
      MAIL_FROM: "Forms <forms@example.com>"
    ports: [ "3000:3000" ]
volumes: { postbag-postgres: {} }
```

## Environment

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | Postgres connection string. |
| `APP_URL` | Public origin. Used in submit URLs, embed snippets, `llms.txt` and docs links. |
| `BETTER_AUTH_SECRET` | Session signing secret. |
| `POSTBAG_ROLE` | `api`, `worker` or `all`. Run two containers for independent scaling; several workers are safe. |
| `PORT`, `TZ`, `NODE_ENV` | Defaults `3000`, `UTC`, `production`. |
| `MIGRATE_ON_BOOT` | `true` runs pending Drizzle migrations at start. |
| `RESEND_API_KEY`, `MAIL_FROM` | Email destinations. Verify the sending domain in Resend. |

## Health and operations

`GET /health` returns database status, worker heartbeat and oldest pending delivery age; the image has a Docker `HEALTHCHECK` on it. Logs are structured JSON. Migrations live in `packages/db/drizzle` and are applied in order; never edit an applied migration.

## Upgrades

Pull the new image, restart with `MIGRATE_ON_BOOT=true`. Schemas (form and stream) are immutable versions, so upgrades never rewrite your contracts.

## Single-organization installs

Disable signups after creating the first organization if the instance is private. Plan limits under the `selfhost` plan are effectively unlimited.

## Access to the image

The repository is private during the first phase. If you want to self-host now, [get in touch](/about/) and we will arrange access; the image is multi-arch (arm64, amd64) and built from the same Dockerfile as production.
