FROM node:20-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY apps/api/tsconfig.build.json apps/api/tsconfig.build.json
COPY apps/api/nest-cli.json apps/api/nest-cli.json
COPY apps/api/eslint.config.mjs apps/api/eslint.config.mjs
COPY apps/api/src apps/api/src
COPY apps/api/test apps/api/test

RUN pnpm install --frozen-lockfile --filter api...

WORKDIR /repo/apps/api
RUN pnpm exec prisma generate
RUN pnpm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/src/main.js"]
