# syntax=docker/dockerfile:1
#
# Local Compose uses targets: api-dev | web-dev | api | web
# Railway must use Dockerfile.api / Dockerfile.web (not this file alone —
# the final stage is web/nginx, which will break the api service).

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
ARG VITE_API_URL=/api/v1
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

FROM base AS api
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=build /app /app
WORKDIR /app
EXPOSE 8080
CMD ["sh", "-c", "pnpm --filter api db:migrate && pnpm --filter api start:prod"]

FROM nginx:1.27-alpine AS web
ENV PORT=8080
ARG API_PUBLIC_HOST=api-dev-b66f.up.railway.app
ENV API_PUBLIC_HOST=$API_PUBLIC_HOST
ENV NGINX_ENVSUBST_FILTER=^(PORT|API_PUBLIC_HOST)$$
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
