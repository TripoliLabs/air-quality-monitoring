# =============================================================================
# @aq/db — Database migrations runner. BUILD CONTEXT = REPO ROOT.
#   docker build -f packages/db/Dockerfile -t aq-migrate .
# =============================================================================

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS runner
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter "./packages/*" build

ENTRYPOINT ["sh", "-c"]
CMD ["pnpm --filter @aq/db migrate:relational && pnpm --filter @aq/db migrate:telemetry"]
