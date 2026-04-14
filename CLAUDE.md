# CLAUDE.md — Habla! App

> Este archivo es el cerebro del proyecto. Léelo completo antes de tocar cualquier código.
> Última actualización: Abril 2026

---

## 1. QUÉ ES HABLA!

WebApp de torneos de predicciones deportivas orientada al mercado peruano. Los usuarios compran **Lukas** (moneda virtual in-app) para inscribirse en torneos sobre partidos de fútbol reales. Gana quien más puntos acumule con sus predicciones. Los premios se pagan en Lukas canjeables por productos físicos/digitales en la tienda integrada.

**Posicionamiento clave:** No es una apuesta (los Lukas no se retiran como efectivo). Es un torneo de habilidad, como un torneo de ajedrez o póker de destreza.

**Fecha límite inamovible:** 11 de junio de 2026 — Día 1 del Mundial FIFA 2026.

---

## 2. MECÁNICA DEL NEGOCIO

### Flujo central
1. Usuario compra Lukas con soles peruanos (Culqi / Yape)
2. Usuario selecciona un torneo activo y paga entrada en Lukas
3. Usuario envía su combinada de 5 predicciones (ticket) antes del cierre (5 min antes del partido)
4. Durante el partido, los puntos se calculan automáticamente en tiempo real
5. Al finalizar el partido, los Lukas del pozo neto se distribuyen automáticamente a los ganadores
6. Los ganadores canjean sus Lukas en la tienda por premios reales

### Sistema de predicciones — puntuación por ticket
| # | Predicción | Puntos | Dificultad |
|---|-----------|--------|------------|
| 1 | Resultado: Local / Empate / Visita | 3 pts | Baja |
| 2 | Ambos equipos anotan (BTTS) | 2 pts | Baja-Media |
| 3 | Más de 2.5 goles | 2 pts | Media |
| 4 | Habrá tarjeta roja | 6 pts | Alta |
| 5 | Marcador exacto | 8 pts | Muy alta |

**Máximo por ticket:** 21 puntos. Un jugador puede enviar múltiples tickets no idénticos para el mismo torneo (máximo 10 en MVP).

### Modelo económico
- **Rake:** 12% del pozo bruto → ingreso principal de la plataforma
- **Distribución del pozo neto (ejemplo 100 jugadores × S/10):**
  - 1er lugar: 35%
  - 2do lugar: 20%
  - 3er lugar: 12%
  - 4to–10mo: 33% repartido
- **Margen en premios físicos:** ~30% (costo real vs Lukas emitidos)
- Los Lukas vencen a los 12 meses desde la compra

### Tipos de torneo
| Tipo | Entrada | Partido típico |
|------|---------|----------------|
| Express | S/ 3–5 | Liga 1, torneos rápidos |
| Estándar | S/ 10–20 | Champions, Copa Libertadores |
| Premium | S/ 30–50 | Clásicos, partidos del Mundial |
| Gran Torneo | S/ 100 | Final del Mundial |

---

## 3. STACK TECNOLÓGICO

### Stack completo
| Capa | Tecnología | Notas |
|------|-----------|-------|
| Frontend | Next.js 14 (React) | SSR + PWA, sin app store |
| Backend API | Node.js + Fastify | Alta performance, tiempo real |
| Base de datos | PostgreSQL 16 | Transacciones atómicas de Lukas |
| Cache / Tiempo real | Redis 7 | Ranking en vivo, sesiones |
| ORM | Prisma | Schema, migraciones, type-safety |
| WebSockets | Socket.io (sobre Fastify) | Ranking actualizado en vivo |
| Auth | NextAuth.js v5 (5.0.0-beta.30) | Google OAuth + magic link — v5 aún sin release estable |
| Pagos | Culqi + Yape API | Pasarelas peruanas |
| API deportiva | API-Football (RapidAPI) | Eventos en tiempo real, polling 30s |
| Email | Resend | Email transaccional |
| SMS/Notif. | Twilio | Alertas de torneo |
| Hosting | Railway | Auto-scaling, deploy desde GitHub |
| CDN / DNS | Cloudflare | DDoS protection, edge caching |
| Monitoreo errores | Sentry | Frontend + Backend |
| Monitoreo infra | Grafana + Prometheus | Dashboards de uso |
| Contenedores dev | Docker + Docker Compose | Dev == Prod |
| Gestión de paquetes | pnpm 10.x + workspaces | Monorepo |
| Orquestador | Turborepo (turbo) | Build/test/lint orchestration |
| CI/CD | GitHub Actions | Tests + deploy automático |

---

## 4. ESTRUCTURA DEL MONOREPO

```
habla-app/
├── CLAUDE.md                    ← Este archivo
├── .github/
│   └── workflows/
│       ├── ci.yml               ← Tests en cada PR
│       └── deploy.yml           ← Deploy a Railway en merge a main
├── docker-compose.yml           ← PostgreSQL + Redis para desarrollo
├── docker-compose.test.yml      ← BD aislada para tests
├── .env.example                 ← Variables de entorno documentadas
├── .gitignore
├── package.json                 ← Root: scripts globales + turbo devDependency
├── pnpm-lock.yaml               ← Lockfile de dependencias (commiteado)
├── pnpm-workspace.yaml          ← Define los workspaces + onlyBuiltDependencies
├── turbo.json                   ← Turborepo: build/test/lint orchestration
│
├── apps/
│   ├── web/                     ← Next.js 14 (Frontend)
│   │   ├── app/                 ← App Router
│   │   │   ├── (auth)/          ← Rutas de login/registro
│   │   │   ├── (main)/          ← Layout principal autenticado
│   │   │   │   ├── torneos/     ← Lista y detalle de torneos
│   │   │   │   ├── torneo/[id]/ ← Inscripción + ticket + ranking en vivo
│   │   │   │   ├── wallet/      ← Balance Lukas, historial, comprar
│   │   │   │   ├── tienda/      ← Catálogo de premios, canjear
│   │   │   │   └── perfil/      ← Datos de usuario, estadísticas
│   │   │   ├── admin/           ← Panel de administración
│   │   │   │   ├── torneos/     ← Crear/gestionar torneos
│   │   │   │   ├── usuarios/    ← Gestión de usuarios
│   │   │   │   └── reportes/    ← Métricas y reportes
│   │   │   ├── api/             ← API Routes de Next.js (auth callbacks, webhooks)
│   │   │   │   ├── auth/        ← NextAuth handlers
│   │   │   │   └── webhooks/    ← Culqi webhook (confirmación de pago)
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx         ← Landing page pública
│   │   ├── components/
│   │   │   ├── ui/              ← Componentes base (Button, Input, Modal...)
│   │   │   ├── torneo/          ← TorneoCard, TorneoList, RankingEnVivo...
│   │   │   ├── ticket/          ← FormularioPredicciones, TicketResumen...
│   │   │   ├── wallet/          ← BalanceLukas, HistorialTransacciones...
│   │   │   ├── tienda/          ← PremioCard, ModalCanje...
│   │   │   └── layout/          ← Header, Footer, Nav, Sidebar...
│   │   ├── lib/
│   │   │   ├── auth.ts          ← Configuración NextAuth
│   │   │   ├── api-client.ts    ← Cliente HTTP para llamar al backend
│   │   │   └── socket-client.ts ← Cliente WebSocket para ranking en vivo
│   │   ├── hooks/               ← Custom hooks React
│   │   ├── stores/              ← Estado global (Zustand)
│   │   ├── public/
│   │   │   └── manifest.json    ← PWA manifest
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   └── package.json
│   │
│   └── api/                     ← Node.js + Fastify (Backend)
│       ├── src/
│       │   ├── server.ts        ← Entry point, Fastify instance
│       │   ├── config/
│       │   │   ├── env.ts       ← Validación de variables de entorno (zod)
│       │   │   └── constants.ts ← RAKE = 0.12, MAX_TICKETS = 10, etc.
│       │   ├── plugins/
│       │   │   ├── auth.ts      ← JWT validation plugin
│       │   │   ├── cors.ts
│       │   │   ├── rate-limit.ts ← 60 req/min por IP
│       │   │   ├── redis.ts     ← Plugin Redis
│       │   │   └── socket.ts    ← Socket.io plugin
│       │   ├── modules/         ← Un módulo por dominio de negocio
│       │   │   ├── auth/
│       │   │   │   ├── auth.routes.ts
│       │   │   │   ├── auth.service.ts
│       │   │   │   └── auth.schema.ts   ← Zod schemas
│       │   │   ├── usuarios/
│       │   │   │   ├── usuarios.routes.ts
│       │   │   │   ├── usuarios.service.ts
│       │   │   │   └── usuarios.schema.ts
│       │   │   ├── lukas/               ← Wallet / moneda virtual
│       │   │   │   ├── lukas.routes.ts
│       │   │   │   ├── lukas.service.ts ← Lógica atómica de transacciones
│       │   │   │   └── lukas.schema.ts
│       │   │   ├── torneos/
│       │   │   │   ├── torneos.routes.ts
│       │   │   │   ├── torneos.service.ts
│       │   │   │   └── torneos.schema.ts
│       │   │   ├── tickets/             ← Predicciones de cada usuario
│       │   │   │   ├── tickets.routes.ts
│       │   │   │   ├── tickets.service.ts
│       │   │   │   └── tickets.schema.ts
│       │   │   ├── puntuacion/          ← Motor de puntos
│       │   │   │   ├── puntuacion.service.ts ← Cálculo de puntos por evento
│       │   │   │   └── puntuacion.types.ts
│       │   │   ├── ranking/
│       │   │   │   ├── ranking.service.ts    ← Lee/escribe en Redis
│       │   │   │   └── ranking.socket.ts     ← Emite via WebSocket
│       │   │   ├── partidos/            ← Integración API-Football
│       │   │   │   ├── partidos.service.ts
│       │   │   │   ├── partidos.poller.ts    ← Polling cada 30s
│       │   │   │   └── partidos.mapper.ts    ← Normaliza respuesta API-Football
│       │   │   ├── premios/             ← Tienda de premios y canje
│       │   │   │   ├── premios.routes.ts
│       │   │   │   ├── premios.service.ts
│       │   │   │   └── premios.schema.ts
│       │   │   ├── pagos/               ← Integración Culqi/Yape
│       │   │   │   ├── pagos.routes.ts
│       │   │   │   ├── pagos.service.ts
│       │   │   │   ├── culqi.client.ts
│       │   │   │   └── pagos.webhook.ts ← Manejo de webhooks de Culqi
│       │   │   └── admin/
│       │   │       ├── admin.routes.ts
│       │   │       └── admin.service.ts
│       │   ├── jobs/                    ← Cron jobs / tareas programadas
│       │   │   ├── cerrar-torneos.job.ts    ← Cierra inscripciones 5 min antes
│       │   │   ├── distribuir-premios.job.ts ← Al finalizar el partido
│       │   │   └── vencer-lukas.job.ts      ← Vencimiento de Lukas a 12 meses
│       │   └── shared/
│       │       ├── errors.ts        ← Custom error classes
│       │       ├── logger.ts        ← Pino logger
│       │       └── redis-keys.ts    ← Constantes de keys de Redis
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── db/                      ← Prisma: schema + migraciones + client
│   │   ├── prisma/
│   │   │   ├── schema.prisma    ← Fuente de verdad del modelo de datos
│   │   │   ├── migrations/      ← Migraciones generadas por Prisma
│   │   │   └── seed.ts          ← Datos iniciales (admin user, premios demo)
│   │   ├── src/
│   │   │   └── index.ts         ← Exporta PrismaClient singleton
│   │   └── package.json
│   │
│   ├── shared/                  ← Tipos y utilidades compartidas
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── torneo.types.ts
│   │   │   │   ├── ticket.types.ts
│   │   │   │   ├── lukas.types.ts
│   │   │   │   └── api.types.ts     ← Request/Response shapes compartidos
│   │   │   ├── constants/
│   │   │   │   ├── puntuacion.ts    ← PUNTOS_RESULTADO=3, PUNTOS_BTTS=2, etc.
│   │   │   │   └── torneos.ts       ← Estados, tipos de torneo, rake
│   │   │   └── utils/
│   │   │       ├── lukas.utils.ts   ← Formateo de moneda Lukas
│   │   │       └── fecha.utils.ts   ← Helpers de fecha para torneos
│   │   └── package.json
│   │
│   └── ui/                      ← Design system compartido (futuro)
│       ├── src/
│       │   └── index.ts
│       └── package.json
│
└── docs/                        ← Documentación técnica
    ├── arquitectura.md          ← Diagrama de arquitectura
    ├── api.md                   ← Endpoints documentados
    ├── modelo-datos.md          ← Explicación del schema
    ├── ranking-en-vivo.md       ← Flujo técnico del ranking
    └── deploy.md                ← Guía de deploy a Railway
```

---

## 5. MODELO DE DATOS (Prisma Schema — tablas principales)

```prisma
// packages/db/prisma/schema.prisma

model Usuario {
  id            String   @id @default(cuid())
  email         String   @unique
  nombre        String
  telefono      String?
  fechaNac      DateTime?
  verificado    Boolean  @default(false)
  rol           Rol      @default(JUGADOR)
  balanceLukas  Int      @default(0)       // en centavos de Lukas
  creadoEn      DateTime @default(now())
  
  tickets       Ticket[]
  transacciones TransaccionLukas[]
  canjes        Canje[]

  @@map("usuarios")
}

enum Rol { JUGADOR ADMIN }

model Partido {
  id             String   @id @default(cuid())
  externalId     String   @unique  // ID de API-Football
  liga           String
  equipoLocal    String
  equipoVisita   String
  fechaInicio    DateTime
  estado         EstadoPartido @default(PROGRAMADO)
  // Resultado final (se llena al terminar)
  golesLocal     Int?
  golesVisita    Int?
  btts           Boolean?      // Ambos anotaron
  mas25Goles     Boolean?      // Más de 2.5 goles
  huboTarjetaRoja Boolean?
  torneos        Torneo[]
  creadoEn       DateTime @default(now())

  @@map("partidos")
}

enum EstadoPartido { PROGRAMADO EN_VIVO FINALIZADO CANCELADO }

model Torneo {
  id             String        @id @default(cuid())
  nombre         String
  tipo           TipoTorneo
  entradaLukas   Int           // Costo en centavos de Lukas
  partidoId      String
  partido        Partido       @relation(fields: [partidoId], references: [id])
  estado         EstadoTorneo  @default(ABIERTO)
  totalInscritos Int           @default(0)
  pozoBruto      Int           @default(0) // Suma de todas las entradas
  pozoNeto       Int           @default(0) // Pozo bruto - rake
  rake           Int           @default(0) // 12% del pozo bruto
  cierreAt       DateTime      // 5 min antes del partido
  distribPremios Json?         // Snapshot de distribución al cerrar
  tickets        Ticket[]
  creadoEn       DateTime      @default(now())

  @@map("torneos")
}

enum TipoTorneo { EXPRESS ESTANDAR PREMIUM GRAN_TORNEO }
enum EstadoTorneo { ABIERTO CERRADO EN_JUEGO FINALIZADO CANCELADO }

model Ticket {
  id              String   @id @default(cuid())
  usuarioId       String
  usuario         Usuario  @relation(fields: [usuarioId], references: [id])
  torneoId        String
  torneo          Torneo   @relation(fields: [torneoId], references: [id])
  // Las 5 predicciones
  predResultado   ResultadoPred  // LOCAL | EMPATE | VISITA
  predBtts        Boolean
  predMas25       Boolean
  predTarjetaRoja Boolean
  predMarcadorLocal   Int
  predMarcadorVisita  Int
  // Puntuación
  puntosTotal     Int      @default(0)
  puntosResultado Int      @default(0)
  puntosBtts      Int      @default(0)
  puntosMas25     Int      @default(0)
  puntosTarjeta   Int      @default(0)
  puntosMarcador  Int      @default(0)
  // Premio
  posicionFinal   Int?
  premioLukas     Int      @default(0)
  creadoEn        DateTime @default(now())
  
  @@unique([usuarioId, torneoId, predResultado, predBtts, predMas25, predTarjetaRoja, predMarcadorLocal, predMarcadorVisita])
  @@map("tickets")
}

enum ResultadoPred { LOCAL EMPATE VISITA }

model TransaccionLukas {
  id          String          @id @default(cuid())
  usuarioId   String
  usuario     Usuario         @relation(fields: [usuarioId], references: [id])
  tipo        TipoTransaccion
  monto       Int             // Positivo = ingreso, Negativo = egreso
  descripcion String
  refId       String?         // ID de torneo, pago, canje, etc.
  venceEn     DateTime?       // Para Lukas comprados (12 meses)
  creadoEn    DateTime        @default(now())

  @@map("transacciones_lukas")
}

enum TipoTransaccion {
  COMPRA          // Usuario compra Lukas con soles
  ENTRADA_TORNEO  // Usuario paga entrada
  PREMIO_TORNEO   // Usuario recibe premio
  CANJE           // Usuario canjea en tienda
  BONUS           // Lukas gratis (referidos, promociones)
  VENCIMIENTO     // Lukas expirados
}

model Premio {
  id          String   @id @default(cuid())
  nombre      String
  descripcion String
  costeLukas  Int      // Precio en Lukas
  stock       Int      @default(0)
  imagen      String?
  activo      Boolean  @default(true)
  canjes      Canje[]
  creadoEn    DateTime @default(now())

  @@map("premios")
}

model Canje {
  id         String      @id @default(cuid())
  usuarioId  String
  usuario    Usuario     @relation(fields: [usuarioId], references: [id])
  premioId   String
  premio     Premio      @relation(fields: [premioId], references: [id])
  lukasUsados Int
  estado     EstadoCanje @default(PENDIENTE)
  direccion  Json?       // Dirección de envío si aplica
  creadoEn   DateTime    @default(now())

  @@map("canjes")
}

enum EstadoCanje { PENDIENTE PROCESANDO ENVIADO ENTREGADO CANCELADO }
```

---

## 6. REGLAS DE NEGOCIO CRÍTICAS

Estas reglas son **inamovibles** y deben implementarse con exactitud:

### Lukas
- Todo movimiento de Lukas es una transacción atómica. Si falla cualquier paso, se revierte todo.
- El balance nunca puede ser negativo. Verificar balance ANTES de descontar.
- Los Lukas comprados vencen a los 12 meses. Los ganados en torneos NO vencen.
- Los Lukas NO son retirables como efectivo bajo ninguna circunstancia.
- 1 Luka = S/ 1 peruano (paridad 1:1 para simplicidad).

### Tickets y Torneos
- El cierre de inscripciones es exactamente 5 minutos antes del inicio del partido. Es automático e irreversible.
- Dos tickets del mismo usuario en el mismo torneo NO pueden tener las 5 predicciones idénticas (constraint en BD).
- Máximo 10 tickets por usuario por torneo en MVP.
- Las predicciones enviadas son inmutables. No se pueden editar después de enviadas.
- Un torneo necesita mínimo 2 inscritos para activarse. Si no llega, se reembolsa la entrada.

### Puntuación
- Los puntos se calculan exclusivamente a partir de los eventos de API-Football. Cero intervención manual.
- Si API-Football falla, los puntos quedan en "pendiente" y se calculan retroactivamente al restaurar conexión.
- En caso de empate de puntos al final: el desempate es por marcador exacto primero, tarjeta roja después, y finalmente por orden de inscripción (primero en inscribirse gana en igualdad).

### Distribución de premios
- El rake es exactamente 12% del pozo bruto. Se calcula al centavo.
- Los premios se acreditan automáticamente al finalizar el partido. Sin aprobación manual.
- La distribución del pozo está en `packages/shared/src/constants/torneos.ts`.

### Seguridad
- Rate limiting: máximo 60 requests/minuto por IP.
- Verificación de email obligatoria para comprar Lukas.
- Edad mínima 18 años — verificación al registro (fecha de nacimiento).
- Las predicciones se bloquean con timestamp en BD al enviarlas.

---

## 7. FLUJO DEL RANKING EN TIEMPO REAL

```
API-Football (polling 30s)
        ↓
partidos.poller.ts → detecta evento (gol, tarjeta, fin)
        ↓
puntuacion.service.ts → recalcula puntos de TODOS los tickets del torneo
        ↓
Redis → escribe ranking actualizado (key: ranking:{torneoId})
        ↓
ranking.socket.ts → emite evento 'ranking:update' a sala Socket.io del torneo
        ↓
Cliente Web → recibe update y re-renderiza ranking sin reload
```

**Keys de Redis:**
- `ranking:{torneoId}` → sorted set con userId:ticketId y score = puntos
- `partido:estado:{externalId}` → estado actual del partido (cache 25s)
- `torneo:inscritos:{torneoId}` → contador en tiempo real de inscritos

---

## 8. VARIABLES DE ENTORNO

Documentadas en `.env.example`. Nunca commitear `.env`:

```bash
# Base de datos
DATABASE_URL=postgresql://habla:habla@localhost:5432/habladb
REDIS_URL=redis://localhost:6379

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# API Deportiva
API_FOOTBALL_KEY=        # RapidAPI key para API-Football
API_FOOTBALL_HOST=v3.football.api-sports.io

# Pagos
CULQI_PUBLIC_KEY=
CULQI_SECRET_KEY=
CULQI_WEBHOOK_SECRET=

# Notificaciones
RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
API_URL=http://localhost:3001
JWT_SECRET=
NODE_ENV=development

# Monitoreo
SENTRY_DSN=
```

---

## 9. DOCKER COMPOSE (DESARROLLO)

```yaml
# docker-compose.yml (raíz del proyecto)
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: habla
      POSTGRES_PASSWORD: habla
      POSTGRES_DB: habladb
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 10. COMANDOS DE DESARROLLO

```bash
# Instalar dependencias (desde raíz)
pnpm install

# Levantar infraestructura local
docker-compose up -d

# Generar cliente Prisma y correr migraciones
# NOTA: Prisma busca DATABASE_URL. Si se ejecuta desde packages/db/,
# usar: export DATABASE_URL="postgresql://habla:habla@localhost:5432/habladb"
# antes de correr el comando, o ejecutar desde la raíz del monorepo.
pnpm --filter @habla/db db:migrate

# Generar cliente Prisma (necesario después de cambios al schema)
cd packages/db && export DATABASE_URL="postgresql://habla:habla@localhost:5432/habladb" && pnpm exec prisma generate

# Seed de datos iniciales
pnpm --filter @habla/db db:seed

# Correr todos los servicios en desarrollo
pnpm dev
# Equivale a: turbo run dev (corre web en :3000 y api en :3001)

# Correr solo el frontend
pnpm --filter @habla/web dev

# Correr solo el backend
pnpm --filter @habla/api dev

# Tests
pnpm test

# Build de producción
pnpm build

# Lint
pnpm lint
```

---

## 11. PRIORIDADES MVP — QUÉ ES Y QUÉ NO ES

### ✅ MVP (debe estar el 11 de junio)
- Auth completo (Google OAuth + email/magic link)
- Compra de Lukas vía Culqi
- Wallet de Lukas (balance, historial)
- Crear torneos desde admin panel
- Inscripción a torneos
- Envío de tickets de predicciones
- Motor de puntuación automático (API-Football)
- Ranking en vivo por WebSocket
- Distribución automática de premios al finalizar
- Tienda de premios básica (catálogo + solicitud de canje manual)
- Notificaciones por email (Resend)
- Admin panel: crear torneos, ver métricas básicas, gestionar canjes

### ❌ Post-MVP (no bloquea el lanzamiento)
- Ligas privadas (grupos de amigos) → v1.1 Agosto 2026
- Gamificación (niveles, logros, streaks) → v1.2 Septiembre 2026
- WhatsApp Bot → v1.3 Noviembre 2026
- App nativa iOS/Android → v2.0 Q1 2027
- Múltiples deportes (básquet, vóley) → v1.3
- Programa de referidos automatizado → v1.2
- KYC avanzado → post-MVP
- Yape API → post-MVP (Culqi primero)

---

## 12. PLAN DE SPRINTS

| Sprint | Fechas | Entregable principal | Estado |
|--------|--------|---------------------|--------|
| Sprint 0 | 11-17 Abr | Setup monorepo, CI/CD, Docker, schema BD, wireframes, contratos API-Football y Culqi | ✅ Completado 14 Abr |
| Sprint 1 | 18-24 Abr | Auth (Google OAuth + magic link), perfil, landing page + lista de espera | Pendiente |
| Sprint 2 | 25 Abr-1 May | Módulo Lukas: compra Culqi, balance, historial, webhook confirmación | Pendiente |
| Sprint 3 | 2-8 May | Torneos: crear desde admin, listar, inscribir, cierre automático | Pendiente |
| Sprint 4 | 9-15 May | Tickets: formulario 5 predicciones, validaciones, múltiples tickets, confirmación | Pendiente |
| Sprint 5 | 16-22 May | API-Football: eventos tiempo real, motor de puntuación, ranking vía WebSocket | Pendiente |
| Sprint 6 | 23-29 May | Cierre torneos, distribución premios, tienda básica, email notifications | Pendiente |
| Sprint 7 | 30 May-5 Jun | Admin panel completo, QA, test de carga (500 usuarios simultáneos), beta | Pendiente |
| Sprint 8 🚀 | 6-10 Jun | Go Live a producción, monitoreo 24/7, soporte activo | Pendiente |

---

## 13. CONVENCIONES DE CÓDIGO

- **Lenguaje:** TypeScript strict en todo el proyecto
- **Nombres de archivos:** kebab-case (`torneo.service.ts`)
- **Nombres de funciones/variables:** camelCase
- **Nombres de tipos/clases:** PascalCase
- **Rutas API REST:** `/api/v1/{recurso}` en plural y kebab-case
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Branches:** `main` (producción), `develop` (integración), `feat/nombre-feature`
- **PR a main:** siempre requiere pasar CI (tests + lint)
- **Validación:** Zod en entrada de datos (API y formularios)
- **Errores:** siempre lanzar clases de error tipadas, nunca `throw new Error('string')`
- **Logs:** Pino logger, nunca `console.log` en producción

---

## 14. CONTEXTO DE NEGOCIO IMPORTANTE

- **Mercado:** Perú, Lima Metropolitana primera. Hombres 18-45 años.
- **Competencia directa:** ninguna exacta. Diferente a Betsson/Inkabet (apuestas reguladas). Diferente a Sorare (fantasy complejo).
- **Riesgo regulatorio principal:** que los Lukas sean clasificados como apuesta. Mitigación: no son retirables como efectivo, son créditos de entretenimiento.
- **Riesgo técnico principal:** caída durante partidos en vivo con mucho tráfico. Railway tiene auto-scaling. Test de carga obligatorio en Sprint 7.
- **Riesgo de negocio principal:** pasivo de Lukas acumulados sin canjear. Vencimiento a 12 meses + provisión del 25%.
- **KPI más importante en lanzamiento:** inscriptos por torneo. El pozo grande es lo que hace atractivo el juego.
- **Breakeven proyectado:** Q4 2027 (~18 meses post-lanzamiento).

---

## 15. ESTADO DEL SPRINT 0 (completado 14 Abr 2026)

### Lo que se configuró
- Monorepo con pnpm 10.33.0 + Turborepo 2.x
- CI/CD con GitHub Actions (deploy.yml en push a main, ci.yml en PRs)
- Docker Compose: PostgreSQL 16 + Redis 7 levantados y verificados
- Prisma: migración inicial `20260414021221_init` aplicada — 7 tablas creadas
- Estructura completa de carpetas y archivos placeholder con TODOs por sprint
- SSH configurado para push a GitHub

### Versiones instaladas (verificadas)
- Node.js: v24.14.1
- pnpm: 10.33.0 (packageManager en package.json)
- Turbo: 2.9.6
- Prisma: 5.22.0
- next-auth: 5.0.0-beta.30 (v5 aún sin release estable)
- Docker: 29.4.0

### Decisiones técnicas tomadas
- **pnpm 10.x en vez de 9.x:** La versión 9.15.4 originalmente planeada no era compatible con la instalación disponible. Se actualizó a 10.33.0 sin impacto funcional.
- **next-auth beta:** NextAuth v5 no tiene versión estable publicada. Se usa `5.0.0-beta.30` que es la más reciente y funcional.
- **CI simplificado:** Los pasos de `build`, `test` y `lint` están comentados en los workflows porque aún no hay código compilable. Se habilitarán progresivamente en los sprints siguientes.
- **onlyBuiltDependencies:** Configurado en `pnpm-workspace.yaml` para permitir build scripts de Prisma, esbuild y unrs-resolver.

### Qué falta del Sprint 0 (pendiente)
- Wireframes de las pantallas principales
- Contrato firmado con API-Football (RapidAPI)
- Contrato firmado con Culqi (pasarela de pagos)
