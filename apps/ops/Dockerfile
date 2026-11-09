# The operator tools, and the seed the deploy runs (ADR-0029). Built from the pruned workspace.
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2 prune @tenantry/ops --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
COPY tsconfig.base.json .
RUN pnpm --filter "@tenantry/ops^..." build
COPY scripts/prod-seed.mjs scripts/
COPY scripts/lib/provisioner.mjs scripts/lib/

FROM builder
RUN mkdir /secrets && chown node:node /secrets
USER node
CMD ["node", "scripts/prod-seed.mjs"]
