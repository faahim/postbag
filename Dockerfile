# syntax=docker/dockerfile:1
# Multi-stage, multi-arch (arm64 + amd64) build for the Postbag server image.
# `api`/`worker`/`all` are entrypoints of this one image, selected via POSTBAG_ROLE.

FROM node:22-alpine AS base
RUN corepack enable

# ---- deps + build ---------------------------------------------------------
FROM base AS build
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @postbag/core build \
 && pnpm --filter @postbag/db build \
 && pnpm --filter @postbag/auth build \
 && pnpm --filter @postbag/server build
# Prunes to a self-contained, production-only deploy of @postbag/server: its own
# dist/ plus real (non-symlinked) copies of the workspace packages it depends on.
RUN pnpm --filter @postbag/server deploy --prod --legacy /prod/server

# ---- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    POSTBAG_ROLE=all \
    PORT=3000 \
    TZ=UTC
WORKDIR /app
RUN addgroup -S postbag && adduser -S postbag -G postbag
COPY --from=build /prod/server /app
# @postbag/db's package.json only ships dist/ (see packages/db/package.json "files");
# the committed SQL migrations live alongside it in the repo, not in dist.
COPY --from=build /repo/packages/db/drizzle /app/node_modules/@postbag/db/drizzle
RUN chown -R postbag:postbag /app
USER postbag

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1

CMD ["node", "dist/main.js"]
