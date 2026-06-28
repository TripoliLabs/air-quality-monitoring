# =============================================================================
# @aq/api — NestJS API. BUILD CONTEXT = REPO ROOT (single pnpm workspace lockfile).
#   docker build -f apps/api/Dockerfile -t aq-api .
# =============================================================================

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

# --- install + build the workspace packages this app depends on --------------
FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter "./packages/*" build

# --- development: hot reload (nest --watch) ----------------------------------
FROM deps AS dev
WORKDIR /repo/apps/api
EXPOSE 3000 9229
CMD ["pnpm", "run", "start:dev"]

# --- build: compile the app + produce a pruned prod bundle in /app -----------
FROM deps AS build
RUN pnpm --filter @aq/api build
RUN pnpm --filter @aq/api deploy --prod /app

# --- production: minimal runtime --------------------------------------------
FROM node:24-alpine AS prod
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY --from=build /app ./
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
