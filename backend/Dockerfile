# =============================================================================
# Air Quality Monitoring - Backend Dockerfile
# Multi-stage build for development and production
# =============================================================================

# Base stage - Bun installation
FROM node:24-alpine AS base
RUN npm install -g bun
WORKDIR /app
COPY package.json bun.lock ./

# =============================================================================
# Development stage - hot reload support
# =============================================================================
FROM base AS dev
RUN bun install --frozen-lockfile
COPY . .
EXPOSE 3000 9229
CMD ["bun", "run", "start:dev"]

# =============================================================================
# Build stage - compile TypeScript
# =============================================================================
FROM base AS build
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
RUN bun install --frozen-lockfile --production

# =============================================================================
# Production stage - minimal runtime image
# =============================================================================
FROM node:24-alpine AS prod
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs
WORKDIR /app
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/package.json ./
USER nestjs
EXPOSE 3000
ENV NODE_ENV=production
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
