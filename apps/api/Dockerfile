# API image, built from the pruned workspace.
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2 prune @tenantry/api --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
COPY tsconfig.base.json .
RUN pnpm --filter "@tenantry/api..." build

FROM builder
ARG TENANTRY_VERSION=dev
ENV NODE_ENV=production TENANTRY_VERSION=$TENANTRY_VERSION
RUN mkdir /secrets && chown node:node /secrets
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
