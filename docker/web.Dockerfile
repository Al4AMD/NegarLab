FROM node:22-slim AS build

ENV PNPM_HOME=/pnpm \
    PATH="/pnpm:$PATH" \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN npm install -g pnpm@11.21.0

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ip/package.json packages/ip/package.json

RUN pnpm install --frozen-lockfile --filter @negarlab/web...

COPY packages/ip packages/ip
COPY apps/web apps/web

RUN pnpm --filter @negarlab/web build

FROM caddy:2-alpine

COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv

EXPOSE 80
