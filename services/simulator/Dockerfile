# =============================================================================
# @aq/simulator — simulated LoRaWAN deployment. BUILD CONTEXT = REPO ROOT.
# Builds the node FIRMWARE host binary (musl, same base as the runtime) and runs
# it per node to produce real uplink payloads.
#   docker build -f services/simulator/Dockerfile -t aq-simulator .
# =============================================================================

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
RUN apk add --no-cache build-base # gcc + make for the firmware host build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter "./packages/*" build # shared deps (@aq/db, @aq/telemetry-codec, …)
RUN pnpm --filter @aq/simulator build
RUN make -C firmware host && make -C firmware test # build the node firmware + run its unit tests

FROM deps AS dev
WORKDIR /repo/services/simulator
ENV FIRMWARE_BIN=/repo/firmware/build/aq-node-sim
CMD ["node", "dist/index.js"]
