# syntax=docker/dockerfile:1
# Built from the repository root: docker build -f apps/api/Dockerfile .

FROM node:26-alpine AS base
WORKDIR /app
# Git hooks are a development tool; skip them inside images.
ENV HUSKY=0

# Every workspace manifest is needed for npm to read the lockfile.
FROM base AS manifests
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY e2e/package.json e2e/

FROM manifests AS build
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace @nest-react-auth/api --workspace @nest-react-auth/contracts --ignore-scripts
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build --workspace @nest-react-auth/contracts \
 && npm run build --workspace @nest-react-auth/api

# Production dependencies only. TypeScript is a dev dependency and also an optional
# peer of @nestjs/swagger, so npm keeps it unless optional packages are left out too.
# argon2 ships a prebuilt binary for linux-musl: no install script or compiler needed.
FROM manifests AS runtime-deps
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace @nest-react-auth/api --omit=dev --omit=optional --ignore-scripts

FROM node:26-alpine AS runtime
# Only node is needed at runtime: drop the package managers (and the CVEs they
# bundle), and take Alpine security fixes released after the base image.
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production
WORKDIR /app
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/main.js"]
