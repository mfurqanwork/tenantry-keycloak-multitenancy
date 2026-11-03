# Keycloak with the Tenantry login theme (ADR-0021). Keycloakify packs the theme with Maven.
FROM node:22-bookworm AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends maven openjdk-17-jdk-headless \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2 prune @tenantry/login-theme --docker

FROM base AS theme
COPY --from=pruner /repo/out/json/ .
COPY .npmrc .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
COPY tsconfig.base.json .
RUN pnpm --filter "@tenantry/login-theme^..." build \
  && pnpm --filter @tenantry/login-theme build:jar

FROM quay.io/keycloak/keycloak:26.8.1
COPY --from=theme /repo/apps/login-theme/dist_keycloak/tenantry-login-theme.jar /opt/keycloak/providers/
