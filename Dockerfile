# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter api build
ARG VITE_API_URL=http://localhost:3000/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter web build

FROM deps AS api-dev
COPY . .
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter api db:migrate && pnpm --filter api start:dev"]

FROM deps AS web-dev
COPY . .
EXPOSE 5173
CMD ["pnpm", "--filter", "web", "dev", "--host", "0.0.0.0", "--port", "5173"]

# Production API (Railway service: api)
FROM base AS api
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter api db:migrate && pnpm --filter api start:prod"]

# Production web (Railway service: web) — listens on $PORT
FROM nginx:1.27-alpine AS web
ENV PORT=80
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
