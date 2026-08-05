# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile
# Build package nội bộ @qlhs/contracts TRƯỚC: dist của nó bị .dockerignore loại khỏi
# build context, mà web cần types của nó → phải build trong image (không dựa dist máy host).
RUN pnpm --filter @qlhs/contracts build
RUN pnpm --filter @qlhs/web build

FROM nginx:alpine
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
