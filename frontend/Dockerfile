# =============================================================================
# Air Quality Monitoring - Frontend Dockerfile
# Multi-stage build for development and production
# Note: Production stage is optional - frontend is deployed as static site on cloud
# =============================================================================

# Base stage - Bun installation
FROM node:24-alpine AS base
RUN npm install -g bun
WORKDIR /app
COPY package.json bun.lock ./

# =============================================================================
# Development stage - Vite HMR
# =============================================================================
FROM base AS dev
RUN bun install --frozen-lockfile
COPY . .
EXPOSE 5173
CMD ["bun", "run", "dev", "--host"]

# =============================================================================
# Build stage - bundle assets
# VITE_* variables passed as build args from CI/CD
# =============================================================================
FROM base AS build
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# =============================================================================
# Production stage - Nginx static serving (optional, for self-hosting)
# =============================================================================
FROM nginx:alpine AS prod
RUN apk add --no-cache curl
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
