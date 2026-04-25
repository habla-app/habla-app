FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
# OpenSSL es requerido por el engine de Prisma en Alpine.
# postgresql16-client trae el binario `pg_dump` que usa el job de
# backup automatizado a R2 (Lote 7). Versión 16 para coincidir con la
# versión del servidor Postgres en Railway — un cliente más viejo
# falla con "server version mismatch" al dumpear.
RUN apk add --no-cache openssl postgresql16-client

# --- Install dependencies ---
FROM base AS deps
WORKDIR /app
COPY .npmrc pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY packages/db/package.json ./packages/db/
COPY packages/db/prisma ./packages/db/prisma
RUN pnpm install --frozen-lockfile

# --- Build ---
FROM base AS builder
WORKDIR /app
# Traer TODO del stage deps: node_modules del root + de cada sub-paquete.
# Con pnpm 10 + node-linker=hoisted los workspace packages viven en
# apps/web/node_modules/@habla/* y packages/db/node_modules/, no en el root.
COPY --from=deps /app ./
COPY . .

# NEXT_PUBLIC_* deben estar presentes en build-time — Next.js las inlinea
# como literales en el bundle cliente durante `next build`. Railway con
# builder=DOCKERFILE solo pasa variables a `docker build` si el Dockerfile
# las declara como ARG. Si no, Next inlinea `undefined` y el cliente
# nunca las ve (ej: PostHog nunca se inicializa → hotfix Abr 2026).
#
# Railway auto-forwardea cualquier ARG declarado acá a --build-arg si hay
# una Service/Shared Variable con el mismo nombre. Agregar un ARG nuevo
# acá cuando sumes una NEXT_PUBLIC_*.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

# Generar cliente Prisma antes del build de Next.js
RUN pnpm --filter @habla/db exec prisma generate
RUN pnpm --filter @habla/web build

# --- Production ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Sub-Sprint 5: pasamos a custom server (apps/web/server.ts) para montar
# Socket.io sobre el mismo proceso de Next (CLAUDE.md §15). Ya no usamos
# `output: "standalone"` — copiamos el workspace completo (node_modules
# hoisted + .next + packages) y ejecutamos con tsx.
COPY --from=builder /app ./

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Aplicar migraciones pendientes y arrancar el server Next + Socket.io.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma && cd apps/web && npx tsx server.ts"]
