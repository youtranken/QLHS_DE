# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
# Build @qlhs/contracts TRƯỚC (dist bị .dockerignore loại → build trong image).
RUN pnpm --filter @qlhs/contracts build
RUN pnpm --filter @qlhs/api prisma:generate \
  && pnpm --filter @qlhs/api build

FROM node:24-alpine AS runtime
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo ./
WORKDIR /repo/apps/api
EXPOSE 3000
# Entrypoint runs `prisma migrate deploy` then starts the app (see the script).
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
