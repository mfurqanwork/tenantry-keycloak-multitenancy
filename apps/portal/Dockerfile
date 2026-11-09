# Builds the portal SPA and serves the static files with Caddy.
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2 prune @tenantry/portal --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
COPY .npmrc .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
COPY tsconfig.base.json .
ARG VITE_TENANTRY_BASE_DOMAIN=tenantry.localhost
ARG VITE_TENANTRY_VERSION=
ENV VITE_TENANTRY_BASE_DOMAIN=$VITE_TENANTRY_BASE_DOMAIN VITE_TENANTRY_VERSION=$VITE_TENANTRY_VERSION
RUN pnpm --filter "@tenantry/portal..." build

FROM caddy:2.10-alpine
COPY apps/portal/Caddyfile.spa /etc/caddy/Caddyfile
COPY --from=builder /repo/apps/portal/dist /srv
RUN chown -R 1000:1000 /data /config
USER 1000:1000
