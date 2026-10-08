FROM node:22-bookworm-slim
# HackerAI web app for the self-hosted Coolify deploy (see selfhost/README.md).
# Coolify "Dockerfile" build pack with this fork as the git source:
#   Base Directory "/", Dockerfile Location "/selfhost/Dockerfile", port 3000.
# The build context is the repository root; selfhost/Dockerfile.dockerignore
# keeps local node_modules, .git and .env files out of it.

# Node 22 (>= 22.22) is required by @workos-inc/* and posthog-node. The pnpm
# version matches package.json "packageManager".
ENV CI=1 HUSKY=0 NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g pnpm@10.33.2

# `next build` inlines NEXT_PUBLIC_* into the server and browser bundles, so
# these must be "Available during build" in Coolify, with Build secrets left on
# standard build arguments (BuildKit secrets never set these ARGs). Fail now
# rather than after the build.
ARG NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_WORKOS_REDIRECT_URI
ARG NEXT_PUBLIC_FORCE_SUBSCRIPTION_TIER
ARG NEXT_PUBLIC_DISABLE_CLOUD_SANDBOX
# Optional. Left unset, PostHog stays off and its host keeps the code default.
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG BUILD_NODE_MEMORY_MB=6144
RUN : "${NEXT_PUBLIC_CONVEX_URL:?is required as a build variable}" \
 && : "${NEXT_PUBLIC_BASE_URL:?is required as a build variable}" \
 && : "${NEXT_PUBLIC_WORKOS_REDIRECT_URI:?is required as a build variable}" \
 && : "${NEXT_PUBLIC_FORCE_SUBSCRIPTION_TIER:?is required as a build variable}" \
 && : "${NEXT_PUBLIC_DISABLE_CLOUD_SANDBOX:?is required as a build variable}"

WORKDIR /app

# Install first so source-only changes reuse this layer. packages/* are pnpm
# workspace members and patches/ holds pnpm patchedDependencies. The build
# needs devDependencies (typescript, tailwind), so NODE_ENV is not set yet.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY packages ./packages
RUN pnpm install --frozen-lockfile

COPY . .
ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_WORKOS_REDIRECT_URI=$NEXT_PUBLIC_WORKOS_REDIRECT_URI \
    NEXT_PUBLIC_FORCE_SUBSCRIPTION_TIER=$NEXT_PUBLIC_FORCE_SUBSCRIPTION_TIER \
    NEXT_PUBLIC_DISABLE_CLOUD_SANDBOX=$NEXT_PUBLIC_DISABLE_CLOUD_SANDBOX
RUN NODE_OPTIONS="--max-old-space-size=${BUILD_NODE_MEMORY_MB}" pnpm build

ENV NODE_ENV=production PORT=3000
EXPOSE 3000
# /robots.txt is static and bypasses AuthKit (proxy.ts).
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/robots.txt > /dev/null || exit 1
CMD ["node", "selfhost/server.mjs"]
