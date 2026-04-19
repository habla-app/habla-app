FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
# OpenSSL es requerido por el engine de Prisma en Alpine
RUN apk add --no-cache openssl

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
