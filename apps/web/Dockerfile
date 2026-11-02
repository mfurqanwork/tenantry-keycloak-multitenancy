# Builds the web SPA and serves the static files with Caddy.
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2 prune @tenantry/web --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
COPY .npmrc .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
COPY tsconfig.base.json .
RUN pnpm --filter "@tenantry/web..." build

FROM caddy:2.10-alpine
COPY apps/web/Caddyfile.spa /etc/caddy/Caddyfile
COPY --from=builder /repo/apps/web/dist /srv
