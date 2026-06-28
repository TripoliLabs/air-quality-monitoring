# =============================================================================
# @aq/ingestion — telemetry pipeline. BUILD CONTEXT = REPO ROOT.
#   docker build -f services/ingestion/Dockerfile -t aq-ingestion .
# =============================================================================

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter "./packages/*" build

# --- development: hot reload -------------------------------------------------
FROM deps AS dev
WORKDIR /repo/services/ingestion
EXPOSE 3001
CMD ["pnpm", "run", "start:dev"]

# --- build + prod ------------------------------------------------------------
FROM deps AS build
RUN pnpm --filter @aq/ingestion build
RUN pnpm --filter @aq/ingestion deploy --prod /app

FROM node:24-alpine AS prod
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY --from=build /app ./
ENV NODE_ENV=production
EXPOSE 3001
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
