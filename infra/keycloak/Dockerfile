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

# The production realms for this image's domain (ADR-0029).
FROM node:22-slim AS realms
WORKDIR /repo
COPY scripts/prod-realm.mjs scripts/
COPY scripts/lib/prod-realm.mjs scripts/lib/
COPY infra/keycloak/platform-realm.json infra/keycloak/corp-demo-realm.json infra/keycloak/
ARG TENANTRY_BASE_DOMAIN=tenantry.localhost
RUN node scripts/prod-realm.mjs "$TENANTRY_BASE_DOMAIN" /realms

FROM quay.io/keycloak/keycloak:26.8.1 AS prod
COPY --from=theme /repo/apps/login-theme/dist_keycloak/tenantry-login-theme.jar /opt/keycloak/providers/
COPY --from=realms /realms/ /opt/keycloak/data/import/
RUN /opt/keycloak/bin/kc.sh build --db=postgres --health-enabled=true --cache=local

# The dev image: the last stage, so a plain build gets it.
FROM quay.io/keycloak/keycloak:26.8.1
COPY --from=theme /repo/apps/login-theme/dist_keycloak/tenantry-login-theme.jar /opt/keycloak/providers/
