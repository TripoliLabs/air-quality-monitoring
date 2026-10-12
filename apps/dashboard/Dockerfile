# =============================================================================
# @aq/dashboard — Vue 3 + Vite SPA. BUILD CONTEXT = REPO ROOT.
#   docker build -f apps/dashboard/Dockerfile -t aq-dashboard .
# Production stage is optional — the dashboard is normally deployed as a static site.
# =============================================================================

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile

# --- development: Vite HMR ---------------------------------------------------
FROM deps AS dev
WORKDIR /repo/apps/dashboard
EXPOSE 5173
CMD ["pnpm", "exec", "vite", "--host", "--port", "5173"]

# --- build: bundle assets ----------------------------------------------------
# A production build always reads the live API and never contains the mock.
# With no build args it calls the API on its own origin (/api and /socket.io,
# proxied by nginx below). Set VITE_API_URL only if the API is on another host.
FROM deps AS build
ARG VITE_API_URL=
ARG VITE_WS_URL=
ARG VITE_MAP_STYLE_LIGHT=
ARG VITE_MAP_STYLE_DARK=
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_WS_URL=${VITE_WS_URL} \
    VITE_MAP_STYLE_LIGHT=${VITE_MAP_STYLE_LIGHT} \
    VITE_MAP_STYLE_DARK=${VITE_MAP_STYLE_DARK}
RUN pnpm --filter @aq/dashboard build

# --- production: nginx static serving ----------------------------------------
FROM nginx:alpine AS prod
RUN apk add --no-cache curl
COPY apps/dashboard/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /repo/apps/dashboard/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD curl -fsS http://localhost/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
