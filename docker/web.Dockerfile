FROM node:20-bookworm-slim AS build

RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/web/tsconfig.json apps/web/tsconfig.json
COPY apps/web/tsconfig.app.json apps/web/tsconfig.app.json
COPY apps/web/tsconfig.node.json apps/web/tsconfig.node.json
COPY apps/web/vite.config.ts apps/web/vite.config.ts
COPY apps/web/index.html apps/web/index.html
COPY apps/web/public apps/web/public
COPY apps/web/src apps/web/src
COPY apps/web/eslint.config.js apps/web/eslint.config.js

ARG VITE_API_BASE=/api
ARG VITE_DEV_TOOLS=false

RUN pnpm install --frozen-lockfile --filter web...

WORKDIR /repo/apps/web
RUN printf 'VITE_API_BASE=%s\nVITE_DEV_TOOLS=%s\n' "$VITE_API_BASE" "$VITE_DEV_TOOLS" > .env.production
RUN pnpm run build

FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80
