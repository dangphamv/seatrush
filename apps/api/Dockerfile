# Build 1 lần ở CI, tag theo commit SHA, nơi chạy chỉ kéo image về (ADR 0004).
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter "@seatrush/api..."
RUN pnpm --filter "@seatrush/api..." build
# Chỉ dependency production của api + package workspace nó dùng.
RUN pnpm --filter @seatrush/api deploy --prod /out

FROM node:22-alpine
# Runtime không cần npm/corepack; bỏ đi để Trivy không báo lỗ hổng của chúng (và giảm bề mặt tấn công).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s CMD wget -qO- http://127.0.0.1:4000/health || exit 1
# Migration là bước release riêng: node node_modules/@seatrush/db/dist/migrate.js
CMD ["node", "dist/main.js"]
