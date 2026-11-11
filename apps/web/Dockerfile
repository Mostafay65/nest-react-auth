# syntax=docker/dockerfile:1
# Built from the repository root: docker build -f apps/web/Dockerfile .

FROM node:24-alpine AS build
WORKDIR /app
ENV HUSKY=0
# Every workspace manifest is needed for npm to read the lockfile.
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY e2e/package.json e2e/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace @nest-react-auth/web --workspace @nest-react-auth/contracts --ignore-scripts
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN npm run build --workspace @nest-react-auth/contracts \
 && npm run build --workspace @nest-react-auth/web

# nginx's stable branch, as an unprivileged user on port 8080. The slim variant has
# nginx and its core libraries only; the full one adds curl, njs, and image and XSLT
# modules that serving static files never uses. The upgrade picks up Alpine's fixes.
FROM nginxinc/nginx-unprivileged:1.30-alpine-slim AS runtime
USER root
RUN apk upgrade --no-cache
USER nginx
COPY apps/web/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY apps/web/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/"]
