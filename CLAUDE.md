# CLAUDE.md — Habla! App

> Este archivo es el cerebro del proyecto. Léelo completo antes de tocar cualquier código.
> Última actualización: 17 de Abril 2026 (Sprint 1 completado)

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
| Auth | NextAuth.js v5 (5.0.0-beta.30) | MVP: solo magic link via Resend (Google OAuth post-lanzamiento). v5 aún sin release estable |
| Pagos | Culqi + Yape API | Pasarelas peruanas |
| API deportiva | api-football.com (directo) | Cuenta hablaplay@gmail.com, plan básico. Header: x-apisports-key |
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
| CSS | Tailwind CSS 3.4 + PostCSS | Clases utilitarias, colores de marca con prefijo `brand-*` |

---

## 4. ESTRUCTURA DEL MONOREPO

```
habla-app/
├── CLAUDE.md
├── .npmrc                       ← node-linker=hoisted (requerido para Windows + Node 24)
├── Dockerfile                   ← Multi-stage build para web app (Railway usa esto)
├── railway.toml                 ← Fuerza Railway a usar Dockerfile (builder = "DOCKERFILE")
├── .dockerignore                ← Excluye node_modules, .git, docs del build context
├── .claude/
│   └── launch.json              ← Config del dev server para Claude Preview
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── docker-compose.yml
├── docker-compose.test.yml
├── .env.example
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── turbo.json
│
├── apps/
│   ├── web/                     ← Next.js 14 (Frontend)
│   │   ├── app/
│   │   │   ├── (auth)/          ← login, registro (rutas públicas)
│   │   │   ├── (main)/          ← layout autenticado
│   │   │   │   ├── torneos/     ← /torneos — lista pública (ver sin login)
│   │   │   │   ├── torneo/[id]/ ← /torneo/:id — detalle + combinada (login para inscribir)
│   │   │   │   ├── wallet/      ← /wallet — requiere login
│   │   │   │   ├── tienda/      ← /tienda — ver sin login, canjear requiere login
│   │   │   │   └── perfil/      ← /perfil — requiere login
│   │   │   ├── admin/           ← rutas de admin (rol ADMIN)
│   │   │   ├── api/
│   │   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   │   └── webhooks/culqi/route.ts
│   │   │   ├── layout.tsx       ← Fonts (Barlow Condensed + DM Sans) + metadata
│   │   │   ├── globals.css      ← Variables CSS de marca + Tailwind directives
│   │   │   └── page.tsx         ← Landing pública con tabs (En vivo/Abiertos/Próximos/Finalizados)
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── torneo/
│   │   │   ├── ticket/          ← FormularioCombinadaPrediccion (5 predicciones)
│   │   │   ├── wallet/
│   │   │   ├── tienda/
│   │   │   └── layout/
│   │   │       ├── NavBar.tsx   ← ✅ Implementado — Logo + botón Entrar / balance Lukas
│   │   │       └── BottomNav.tsx ← ✅ Implementado — 5 tabs de navegación inferior
│   │   ├── lib/
│   │   │   ├── auth.ts
│   │   │   ├── api-client.ts
│   │   │   └── socket-client.ts
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── public/
│   │   │   ├── manifest.json
│   │   │   └── mockup.html      ← Mockup HTML de referencia (accesible en /mockup.html)
│   │   ├── next.config.js       ← output: standalone para Railway
│   │   ├── tailwind.config.js   ← Colores de marca con prefijo brand-*
│   │   ├── postcss.config.js    ← Tailwind + Autoprefixer
│   │   └── package.json
│   │
│   └── api/                     ← Node.js + Fastify (Backend)
│       ├── src/
│       │   ├── server.ts
│       │   ├── config/
│       │   │   ├── env.ts
│       │   │   └── constants.ts
│       │   ├── plugins/
│       │   │   ├── auth.ts
│       │   │   ├── cors.ts
│       │   │   ├── rate-limit.ts
│       │   │   ├── redis.ts
│       │   │   └── socket.ts
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── usuarios/
│       │   │   ├── lukas/
│       │   │   ├── torneos/
│       │   │   ├── tickets/
│       │   │   ├── puntuacion/
│       │   │   ├── ranking/
│       │   │   ├── partidos/
│       │   │   ├── premios/
│       │   │   ├── pagos/
│       │   │   └── admin/
│       │   ├── jobs/
│       │   │   ├── cerrar-torneos.job.ts
│       │   │   ├── distribuir-premios.job.ts
│       │   │   └── vencer-lukas.job.ts
│       │   └── shared/
│       │       ├── errors.ts
│       │       ├── logger.ts
│       │       └── redis-keys.ts
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── db/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── src/index.ts
│   │   └── package.json
│   ├── shared/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── constants/
│   │   │   └── utils/
│   │   └── package.json
│   └── ui/
│
└── docs/
    ├── arquitectura.md
    ├── api.md
    ├── modelo-datos.md
    ├── ranking-en-vivo.md
    └── deploy.md
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
  balanceLukas  Int      @default(0)       // en unidades enteras de Lukas (1 Luka = S/1)
  creadoEn      DateTime @default(now())
  
  tickets       Ticket[]
  transacciones TransaccionLukas[]
  canjes        Canje[]

  @@map("usuarios")
}

enum Rol { JUGADOR ADMIN }

model Partido {
  id              String        @id @default(cuid())
  externalId      String        @unique  // ID de api-football.com
  liga            String
  equipoLocal     String
  equipoVisita    String
  fechaInicio     DateTime
  estado          EstadoPartido @default(PROGRAMADO)
  golesLocal      Int?
  golesVisita     Int?
  btts            Boolean?
  mas25Goles      Boolean?
  huboTarjetaRoja Boolean?
  torneos         Torneo[]
  creadoEn        DateTime      @default(now())

  @@map("partidos")
}

enum EstadoPartido { PROGRAMADO EN_VIVO FINALIZADO CANCELADO }

model Torneo {
  id             String        @id @default(cuid())
  nombre         String
  tipo           TipoTorneo
  entradaLukas   Int           // Unidades enteras de Lukas
  partidoId      String
  partido        Partido       @relation(fields: [partidoId], references: [id])
  estado         EstadoTorneo  @default(ABIERTO)
  totalInscritos Int           @default(0)
  pozoBruto      Int           @default(0)
  pozoNeto       Int           @default(0)
  rake           Int           @default(0)
  cierreAt       DateTime
  distribPremios Json?
  tickets        Ticket[]
  creadoEn       DateTime      @default(now())

  @@map("torneos")
}

enum TipoTorneo   { EXPRESS ESTANDAR PREMIUM GRAN_TORNEO }
enum EstadoTorneo { ABIERTO CERRADO EN_JUEGO FINALIZADO CANCELADO }

model Ticket {
  id                 String        @id @default(cuid())
  usuarioId          String
  usuario            Usuario       @relation(fields: [usuarioId], references: [id])
  torneoId           String
  torneo             Torneo        @relation(fields: [torneoId], references: [id])
  predResultado      ResultadoPred
  predBtts           Boolean
  predMas25          Boolean
  predTarjetaRoja    Boolean
  predMarcadorLocal  Int
  predMarcadorVisita Int
  puntosTotal        Int           @default(0)
  puntosResultado    Int           @default(0)
  puntosBtts         Int           @default(0)
  puntosMas25        Int           @default(0)
  puntosTarjeta      Int           @default(0)
  puntosMarcador     Int           @default(0)
  posicionFinal      Int?
  premioLukas        Int           @default(0)
  creadoEn           DateTime      @default(now())
  
  @@unique([usuarioId, torneoId, predResultado, predBtts, predMas25, predTarjetaRoja, predMarcadorLocal, predMarcadorVisita])
  @@map("tickets")
}

enum ResultadoPred { LOCAL EMPATE VISITA }

model TransaccionLukas {
  id          String          @id @default(cuid())
  usuarioId   String
  usuario     Usuario         @relation(fields: [usuarioId], references: [id])
  tipo        TipoTransaccion
  monto       Int             // Positivo = ingreso, Negativo = egreso (unidades enteras)
  descripcion String
  refId       String?
  venceEn     DateTime?       // Solo Lukas de COMPRA vencen a 12 meses
  creadoEn    DateTime        @default(now())

  @@map("transacciones_lukas")
}

enum TipoTransaccion {
  COMPRA
  ENTRADA_TORNEO
  PREMIO_TORNEO
  CANJE
  BONUS
  VENCIMIENTO
}

model Premio {
  id          String   @id @default(cuid())
  nombre      String
  descripcion String
  costeLukas  Int
  stock       Int      @default(0)
  imagen      String?
  activo      Boolean  @default(true)
  canjes      Canje[]
  creadoEn    DateTime @default(now())

  @@map("premios")
}

model Canje {
  id          String      @id @default(cuid())
  usuarioId   String
  usuario     Usuario     @relation(fields: [usuarioId], references: [id])
  premioId    String
  premio      Premio      @relation(fields: [premioId], references: [id])
  lukasUsados Int
  estado      EstadoCanje @default(PENDIENTE)
  direccion   Json?
  creadoEn    DateTime    @default(now())

  @@map("canjes")
}

enum EstadoCanje { PENDIENTE PROCESANDO ENVIADO ENTREGADO CANCELADO }
```

---

## 6. REGLAS DE NEGOCIO CRÍTICAS

### Lukas
- **1 Luka = S/ 1 peruano (paridad 1:1).** `balanceLukas` se almacena en unidades enteras, no centavos.
- Todo movimiento de Lukas es una transacción atómica. Si falla cualquier paso, se revierte todo.
- El balance nunca puede ser negativo. Verificar balance ANTES de descontar.
- Los Lukas de COMPRA vencen a los 12 meses (campo `venceEn` en TransaccionLukas).
- Los Lukas ganados en torneos (PREMIO_TORNEO, BONUS) NO vencen — `venceEn = null`.
- Los Lukas NO son retirables como efectivo bajo ninguna circunstancia.
- El bonus de bienvenida es 500 Lukas (tipo BONUS, sin vencimiento).

### Tickets y Torneos
- El cierre de inscripciones es exactamente 5 minutos antes del inicio del partido. Automático e irreversible.
- Dos tickets del mismo usuario en el mismo torneo NO pueden tener las 5 predicciones idénticas (constraint en BD).
- Máximo 10 tickets por usuario por torneo en MVP.
- Las predicciones enviadas son inmutables. No se pueden editar después de enviadas.
- Un torneo necesita mínimo 2 inscritos para activarse. Si no llega, se reembolsa la entrada.

### Puntuación
- Los puntos se calculan exclusivamente a partir de los eventos de api-football.com. Cero intervención manual.
- Si la API falla, los puntos quedan en "pendiente" y se calculan retroactivamente al restaurar conexión.
- Desempate de puntos al final: marcador exacto primero → tarjeta roja → orden de inscripción (timestamp).

### Distribución de premios
- El rake es exactamente 12% del pozo bruto, calculado al entero de Luka.
- Los premios se acreditan automáticamente al finalizar el partido. Sin aprobación manual.
- La distribución está en `packages/shared/src/constants/torneos.ts`.

### Navegación y acceso
- **Cualquier usuario puede navegar sin estar registrado:** ver lista de torneos, partidos en vivo, ranking, tienda.
- **El registro/login se solicita SOLO en el momento de inscribirse a un torneo.**
- Tras el login, el flujo continúa automáticamente hacia la pantalla de combinada del torneo que el usuario quería.
- Wallet y Perfil requieren login siempre.

### Seguridad
- Rate limiting: máximo 60 requests/minuto por IP.
- Verificación de email obligatoria para comprar Lukas.
- Edad mínima 18 años — verificación al registro (fecha de nacimiento).
- Las predicciones se bloquean con timestamp en BD al enviarlas.

---

## 7. FLUJO DEL RANKING EN TIEMPO REAL

```
api-football.com (polling cada 30s, header: x-apisports-key)
        ↓
partidos.poller.ts → detecta evento (gol, tarjeta, fin de partido)
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
- `ranking:{torneoId}` → sorted set con `usuarioId:ticketId` y score = puntosTotal
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

# API Deportiva — cuenta directa hablaplay@gmail.com en api-football.com
# IMPORTANTE: NO usar RapidAPI. Header es x-apisports-key (no X-RapidAPI-Key)
API_FOOTBALL_KEY=
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

### ⚠️ Notas críticas sobre Railway

- **`DATABASE_URL` NO se hereda automáticamente entre servicios en Railway.** La inyecta solo en el servicio Postgres. Para el servicio web, hay que crear la variable explícitamente con valor `${{ Postgres.DATABASE_URL }}` (referencia al servicio Postgres). Sin esto, Prisma falla con `P1012 Environment variable not found: DATABASE_URL` al arrancar y el healthcheck falla infinitamente
- **`NEXTAUTH_URL` sin `/` final:** debe ser exactamente `https://habla-app-production.up.railway.app`. Con slash final NextAuth rompe las redirects
- **`HOSTNAME=0.0.0.0` obligatorio:** sin esto, Next.js standalone escucha solo en `localhost` y el healthcheck de Railway no lo alcanza

---

## 9. DOCKER COMPOSE (DESARROLLO)

```yaml
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

**Requisito previo:** El archivo `.npmrc` con `node-linker=hoisted` ya está en el repo.
Es necesario para que pnpm enlace los módulos correctamente en Windows + Node 24.

```bash
pnpm install
docker-compose up -d
pnpm --filter @habla/db db:migrate
pnpm --filter @habla/db db:seed
pnpm dev          # web en :3000, api en :3001
pnpm test
pnpm build
pnpm lint
```

---

## 11. PRIORIDADES MVP

### ✅ MVP (debe estar el 11 de junio)
- Auth completo (Google OAuth + email/magic link)
- Navegación pública sin login (torneos, ranking, tienda)
- Compra de Lukas vía Culqi
- Wallet de Lukas (balance, historial)
- Crear torneos desde admin panel
- Inscripción a torneos (requiere login)
- Formulario de combinada — 5 predicciones (ver sección 16)
- Motor de puntuación automático (api-football.com)
- Ranking en vivo por WebSocket
- Distribución automática de premios al finalizar
- Tienda de premios básica (catálogo + solicitud de canje manual)
- Notificaciones por email (Resend)
- Admin panel: crear torneos, ver métricas básicas, gestionar canjes

### ❌ Post-MVP
- Ligas privadas → v1.1 Agosto 2026
- Gamificación (niveles, logros, streaks) → v1.2 Septiembre 2026
- WhatsApp Bot → v1.3 Noviembre 2026
- App nativa iOS/Android → v2.0 Q1 2027
- Múltiples deportes → v1.3
- Programa de referidos automatizado → v1.2
- KYC avanzado → post-MVP
- Yape API → post-MVP

---

## 12. PLAN DE SPRINTS

| Sprint | Fechas | Entregable principal | Estado |
|--------|--------|---------------------|--------|
| Sprint 0 | 11-17 Abr | Setup monorepo, CI/CD, Docker, schema BD, wireframes, contratos API-Football y Culqi | ✅ Completado 14 Abr |
| Sprint 1 | 18-24 Abr | Auth (magic link Resend), perfil, middleware rutas protegidas | ✅ Completado 17 Abr |
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

## 15. ESTADO DEL SPRINT 0 (completado 15 Abr 2026)

### Lo que se configuró (14 Abr)
- Monorepo con pnpm 10.33.0 + Turborepo 2.x
- CI/CD con GitHub Actions (deploy.yml en push a main, ci.yml en PRs)
- Docker Compose: PostgreSQL 16 + Redis 7 levantados y verificados
- Prisma: migración inicial `20260414021221_init` aplicada — 7 tablas creadas
- Estructura completa de carpetas y archivos placeholder con TODOs por sprint
- SSH configurado para push a GitHub

### Lo que se construyó (15 Abr)
- **Landing page completa** (`apps/web/app/page.tsx`) con 4 tabs: En vivo, Abiertos, Próximos, Finalizados
- **NavBar** (`components/layout/NavBar.tsx`) — Logo + botón Entrar
- **BottomNav** (`components/layout/BottomNav.tsx`) — 5 tabs de navegación inferior
- Mockup HTML convertido a componentes React/Next.js con datos mock estáticos
- Fuentes Barlow Condensed + DM Sans integradas via `next/font/google` (CSS variables `--font-barlow`, `--font-dm-sans`)
- Paleta de colores de marca en Tailwind con prefijo `brand-*` y CSS variables en `globals.css`
- `postcss.config.js` creado (Tailwind + Autoprefixer)
- Mockup de referencia accesible en `/mockup.html`
- Deploy a Railway configurado y funcionando en `https://habla-app-production.up.railway.app`

### Fixes de build aplicados (15 Abr)
- `apps/web/app/api/auth/[...nextauth]/route.ts` — agregados handlers GET/POST placeholder (sin exports el build fallaba)
- `apps/web/app/api/webhooks/culqi/route.ts` — agregado handler POST placeholder
- `next.config.js` — eliminado `experimental.serverActions: true` (deprecated en Next.js 14.2), agregado `output: "standalone"` para Railway
- `.npmrc` — agregado `node-linker=hoisted` (necesario para que pnpm enlace módulos correctamente en Windows + Node 24)
- CI/CD workflows actualizados: ahora ejecutan `pnpm build` como verificación

### Deploy a Railway (15 Abr)
- **Dockerfile** creado en raíz — multi-stage: base (pnpm) → deps (install) → builder (next build) → runner (standalone)
- **railway.toml** con `builder = "DOCKERFILE"` — Railpack (builder default de Railway) no detectaba pnpm y usaba `npm install` que falla con `workspace:*`
- **Variable obligatoria en Railway:** `HOSTNAME=0.0.0.0` — sin esto, Next.js standalone solo escucha en localhost y el healthcheck falla
- **Custom Start Command en Railway:** dejar vacío — el Dockerfile CMD (`node apps/web/server.js`) es el correcto
- **URL en producción:** `https://habla-app-production.up.railway.app`

### Versiones instaladas (verificadas)
- Node.js: v24.14.1
- pnpm: 10.33.0
- Turbo: 2.9.6
- Prisma: 5.22.0
- next-auth: 5.0.0-beta.30
- Docker: 29.4.0

### Decisiones técnicas tomadas
- **pnpm 10.x:** versión 9.x no era compatible. Actualizado a 10.33.0 sin impacto funcional.
- **next-auth beta:** NextAuth v5 no tiene versión estable. Se usa `5.0.0-beta.30`.
- **node-linker=hoisted:** pnpm en Windows + Node 24 no enlaza symlinks correctamente con el linker por defecto. Se usa `node-linker=hoisted` en `.npmrc` para forzar instalación plana (estilo npm). No afecta el lockfile ni CI.
- **output: standalone:** `next.config.js` usa `output: "standalone"` para que Railway pueda servir la app sin el monorepo completo.
- **onlyBuiltDependencies:** configurado para Prisma, esbuild y unrs-resolver.
- **API-Football directo:** se usa api-football.com con cuenta hablaplay@gmail.com (plan básico). Header `x-apisports-key`, NO RapidAPI.
- **Landing page en Sprint 0:** se adelantó la landing page (originalmente Sprint 1) porque el mockup ya estaba aprobado y era necesario para verificar el deploy a Railway.
- **Dockerfile sobre Railpack:** Railpack (builder default de Railway) no infiere pnpm correctamente en monorepos. Se fuerza Dockerfile via `railway.toml` con `builder = "DOCKERFILE"`.

### Pendiente del Sprint 0
- Contrato con Culqi → pendiente aprobación RUC SAC; sandbox disponible para desarrollo

---

## 16. DISEÑO UI — MAPA DE PANTALLAS Y COMPONENTES

> Basado en el mockup interactivo aprobado (`docs/habla-mockup-completo.html`).
> Referencia estática accesible en producción: `/mockup.html`.
> Colores de marca: Azul `#0052CC`, Navy `#001050`, Dorado `#FFB800`, Blanco `#FFFFFF`.
> Fuentes: Barlow Condensed (títulos, scores, números) + DM Sans (cuerpo, botones).

### Fuentes — integración con Next.js

Las fuentes se importan via `next/font/google` en `apps/web/app/layout.tsx`:
- **Barlow Condensed** → variable CSS `--font-barlow` → clase Tailwind `font-display`
- **DM Sans** → variable CSS `--font-dm-sans` → clase Tailwind `font-body`

### Paleta de colores

Definidos en dos lugares (deben estar sincronizados):
1. **CSS variables** en `apps/web/app/globals.css` — para uso directo en CSS
2. **Tailwind theme** en `apps/web/tailwind.config.js` — con prefijo `brand-*` para clases utilitarias

```css
/* globals.css — variables CSS */
--blue-dark:  #001050   /* fondo principal */
--blue-mid:   #0038B8   /* gradientes */
--blue-main:  #0052CC   /* color primario */
--blue-light: #1A6EFF   /* hover states */
--blue-pale:  #0A2080   /* surface/cards */
--gold:       #FFB800   /* acento principal, CTAs, precios */
--gold-light: #FFD060   /* hover del gold */
--white:      #FFFFFF
--text:       #EEF2FF   /* texto principal */
--muted:      #7B93D0   /* texto secundario */
--surface:    #001570   /* superficie base */
--card:       #0A2080   /* cards */
--card2:      #0D2898   /* headers de cards */
--border:     #1A3AA0   /* bordes */
--live:       #FF3D3D   /* indicador en vivo */
--green:      #00D68F   /* estado finalizado/éxito */
```

```
/* tailwind.config.js — clases Tailwind equivalentes */
bg-brand-blue-dark   text-brand-gold      border-brand-border
bg-brand-blue-main   text-brand-muted     bg-brand-card
bg-brand-surface     text-brand-text      bg-brand-card2
bg-brand-live        text-brand-green     bg-brand-gold
/* etc. — prefijo brand-{nombre-variable} */
```

### Pantallas principales

#### A. Home / Lista de torneos (`/torneos`)
- **Tabs:** En vivo | Abiertos | Próximos | Finalizados
- **Tab "En vivo":** Hero card del partido con score en tiempo real + ranking en vivo (top 5)
- **Tab "Abiertos":** Lista de TorneoCards con filtros por liga
- **Tab "Próximos":** Cards con countdown al cierre + "Próximamente"
- **Tab "Finalizados":** Cards con score final y ganador del torneo
- **Acceso:** Público, sin login

#### B. Combinada / Ticket (`/torneo/:id/combinada`)
- **Header:** Nombre del partido, liga, pozo, entrada, premio estimado 1er lugar
- **5 predicciones en tarjetas independientes:**
  1. Resultado → 3 botones: Local / Empate / Visita
  2. BTTS → 2 botones: Sí / No
  3. Más de 2.5 goles → 2 botones: Sí / No
  4. Tarjeta roja → 2 botones: Sí / No
  5. Marcador exacto → picker numérico (+/− por equipo)
- **Panel de puntos en tiempo real:** muestra puntos posibles conforme se selecciona cada predicción. Parte de 8 pts (marcador) y suma hasta 21.
- **Validación:** si el usuario intenta enviar sin completar todas, resalta en rojo las faltantes.
- **Submit:** botón "¡Inscribir Combinada!" → descuenta Lukas → pantalla de éxito
- **Acceso:** Requiere login. Si usuario no está logueado, muestra modal de login. Tras login, regresa automáticamente a esta pantalla con el partido pre-cargado.

#### C. Modal de Login/Registro
- Se activa SOLO al intentar inscribirse a un torneo o acceder a Wallet/Perfil
- Muestra el partido y pozo del torneo que activó el modal (contexto motivacional)
- Opciones: Google OAuth | Registro con email
- Tras registro: 500 Lukas de bienvenida (BONUS) + continúa hacia la combinada pendiente

#### D. Pantalla de éxito post-combinada
- Confirma las 5 predicciones enviadas
- Muestra puntos posibles máximos
- CTA: "Enviar otra combinada diferente" | "Ver ranking en vivo"

#### E. Ranking en vivo (`/torneo/:id/ranking`)
- Tabla con posición, avatar, nombre, puntos actuales
- Se actualiza en tiempo real vía WebSocket
- Visible sin login

#### F. Wallet (`/wallet`) — requiere login
- Balance actual en Lukas
- Botón "Comprar Lukas" → flujo Culqi
- Historial de transacciones con tipo, monto, fecha

#### G. Tienda (`/tienda`)
- Catálogo de premios con precio en Lukas
- Ver sin login, canjear requiere login

#### H. Admin Panel (`/admin`)
- Solo rol ADMIN
- Crear torneo: seleccionar partido de API-Football, tipo, precio de entrada
- Ver métricas: torneos activos, inscritos, pozo total, ingresos rake

### Componentes clave (Next.js)

> ✅ = implementado, ⬚ = pendiente

```
components/
├── torneo/
│   ⬚ TorneoCard.tsx            ← Card con equipos, pozo, entrada, botón Jugar
│   ⬚ TorneoHeroEnVivo.tsx      ← Hero card grande para partido en vivo con score
│   ⬚ TorneoTabs.tsx            ← Tabs Abiertos/En Vivo/Próximos/Finalizados
│   ⬚ TorneoFiltros.tsx         ← Chips de liga para filtrar
├── ticket/
│   ⬚ FormularioCombinadaPrediccion.tsx  ← Las 5 predicciones completas
│   ⬚ PredResultado.tsx         ← Pregunta 1: Local/Empate/Visita
│   ⬚ PredBooleana.tsx          ← Reutilizable para BTTS, +2.5, tarjeta roja
│   ⬚ PredMarcadorExacto.tsx    ← Picker numérico por equipo
│   ⬚ PuntosPreview.tsx         ← Panel de puntos en tiempo real
│   ⬚ TicketExito.tsx           ← Pantalla de confirmación
├── ranking/
│   ⬚ RankingEnVivo.tsx         ← Tabla actualizada por WebSocket
├── wallet/
│   ⬚ BalanceLukas.tsx
│   ⬚ ComprarLukas.tsx          ← Integra Culqi.js
│   ⬚ HistorialTransacciones.tsx
├── auth/
│   ✅ ModalLoginInscripcion.tsx ← Modal contextual con info del torneo (Sprint 1)
│   ✅ CerrarSesionBoton.tsx    ← Client component que llama signOut() (Sprint 1)
├── home/
│   ✅ HomeContent.tsx           ← Client component con tabs/mock data, extraído de page.tsx (Sprint 1)
└── layout/
    ✅ NavBar.tsx                ← Server Component: balance + avatar si hay sesión / "Entrar" si no (Sprint 1)
    ✅ UserMenu.tsx              ← Client component del avatar con menú desplegable (Sprint 1)
    ✅ BottomNav.tsx             ← 5 tabs de navegación inferior (Sprint 0)
```

**Nota:** En Sprint 0, los componentes HeroLive, RankingWidget, MatchCard, Tabs y FilterChips
están definidos inline en `HomeContent.tsx` con datos mock. Se extraerán a archivos separados
en los sprints correspondientes cuando se conecten a datos reales.

---

## 17. CONTRATOS DE API — ENDPOINTS REST

> Base URL desarrollo: `http://localhost:3001/api/v1`
> Todos los endpoints protegidos requieren header: `Authorization: Bearer <jwt>`

### Torneos

```
GET  /torneos                    → lista de torneos (público)
     Query params: estado=ABIERTO|EN_JUEGO|FINALIZADO|CERRADO, liga=string
     Response: { torneos: TorneoConPartido[] }

GET  /torneos/:id                → detalle de un torneo (público)
     Response: { torneo: TorneoConPartido, misPosicion?: number }

POST /torneos/:id/inscribir      → inscribir usuario (requiere auth)
     Body: { ticketData: TicketInput }
     Response: { ticket: Ticket, nuevoBalance: number }
     Errores: 400 TORNEO_CERRADO | 400 BALANCE_INSUFICIENTE | 400 TICKET_DUPLICADO | 400 MAX_TICKETS
```

### Tickets / Combinadas

```
POST /tickets                    → crear ticket (requiere auth)
     Body: {
       torneoId: string,
       predResultado: 'LOCAL' | 'EMPATE' | 'VISITA',
       predBtts: boolean,
       predMas25: boolean,
       predTarjetaRoja: boolean,
       predMarcadorLocal: number,    // 0-9
       predMarcadorVisita: number    // 0-9
     }
     Response: { ticket: Ticket, nuevoBalance: number }

GET  /tickets/mis-tickets        → tickets del usuario autenticado (requiere auth)
     Query params: torneoId?, page?
     Response: { tickets: TicketConPuntos[] }
```

### Ranking

```
GET  /torneos/:id/ranking        → ranking actual de un torneo (público)
     Query params: page=1, limit=50
     Response: { ranking: RankingRow[], miPosicion?: number, totalInscritos: number }
```

### Lukas / Wallet

```
GET  /lukas/balance              → balance actual (requiere auth)
     Response: { balance: number }

GET  /lukas/historial            → historial de transacciones (requiere auth)
     Query params: page=1, limit=20
     Response: { transacciones: TransaccionLukas[], total: number }

POST /lukas/comprar              → iniciar compra de Lukas con Culqi (requiere auth)
     Body: { monto: number, culqiToken: string }
     Response: { transaccion: TransaccionLukas, nuevoBalance: number }
```

### Partidos

```
GET  /partidos                   → lista de partidos disponibles (público)
     Query params: fecha=YYYY-MM-DD, estado=PROGRAMADO|EN_VIVO|FINALIZADO
     Response: { partidos: Partido[] }

GET  /partidos/:id               → detalle de partido con estado en vivo (público)
     Response: { partido: Partido, eventoReciente?: EventoPartido }
```

### Auth

```
POST /auth/registro              → registro con email (sin OAuth)
     Body: { email, nombre, password, fechaNac }
     Response: { usuario: Usuario, token: string, lukasBonus: 500 }

POST /auth/login                 → login con email
     Body: { email, password }
     Response: { usuario: Usuario, token: string }

GET  /auth/me                    → usuario actual (requiere auth)
     Response: { usuario: Usuario }
```

### Premios / Tienda

```
GET  /premios                    → catálogo de premios (público)
     Response: { premios: Premio[] }

POST /premios/:id/canjear        → canjear premio (requiere auth)
     Body: { direccion?: { nombre, direccion, ciudad, telefono } }
     Response: { canje: Canje, nuevoBalance: number }
```

### Admin

```
POST /admin/torneos              → crear torneo (requiere auth + rol ADMIN)
     Body: { partidoId, tipo, entradaLukas, nombre }
     Response: { torneo: Torneo }

GET  /admin/metricas             → métricas generales (requiere auth + rol ADMIN)
     Response: { torneosActivos, inscritosHoy, pozosTotal, rakeTotal }

GET  /admin/canjes               → lista de canjes pendientes (requiere auth + rol ADMIN)
PATCH /admin/canjes/:id          → actualizar estado de canje
```

---

## 18. EVENTOS WEBSOCKET (Socket.io)

> El cliente se conecta a `ws://localhost:3001` con el JWT en el query param: `?token=<jwt>`
> Las salas se unen por torneoId.

### Cliente → Servidor

```typescript
// Unirse al ranking en vivo de un torneo
socket.emit('join:torneo', { torneoId: string })

// Salir del ranking
socket.emit('leave:torneo', { torneoId: string })
```

### Servidor → Cliente

```typescript
// Ranking actualizado (se emite cada vez que hay un evento de partido)
socket.on('ranking:update', (data: {
  torneoId: string,
  ranking: Array<{
    posicion: number,
    usuarioId: string,
    nombre: string,
    puntosTotal: number,
    ticketId: string
  }>,
  totalInscritos: number,
  minutoParto: number
}) => { /* re-renderizar ranking */ })

// Evento de partido (gol, tarjeta, fin)
socket.on('partido:evento', (data: {
  torneoId: string,
  tipo: 'GOL' | 'TARJETA_AMARILLA' | 'TARJETA_ROJA' | 'FIN_PARTIDO',
  equipo: 'LOCAL' | 'VISITA',
  minuto: number,
  marcadorLocal: number,
  marcadorVisita: number
}) => { /* mostrar notificación en UI */ })

// Torneo cerrado (5 min antes del partido)
socket.on('torneo:cerrado', (data: { torneoId: string }) => {
  /* deshabilitar botón de inscripción */
})

// Torneo finalizado con distribución de premios
socket.on('torneo:finalizado', (data: {
  torneoId: string,
  ganadores: Array<{ posicion: number, usuarioId: string, premioLukas: number }>
}) => { /* mostrar pantalla de resultados */ })
```

---

## 19. INTEGRACIÓN API-FOOTBALL (api-football.com)

> **IMPORTANTE:** La cuenta es de api-football.com directo (hablaplay@gmail.com), NO de RapidAPI.
> El header de autenticación es diferente.

### Headers correctos para todas las llamadas

```typescript
// apps/api/src/modules/partidos/partidos.service.ts
const headers = {
  'x-apisports-key': process.env.API_FOOTBALL_KEY,
  // NO usar X-RapidAPI-Key ni X-RapidAPI-Host
}
```

### Endpoints que se usan

```typescript
// Partidos del día
GET https://v3.football.api-sports.io/fixtures?date=YYYY-MM-DD&timezone=America/Lima

// Eventos en vivo de un partido (para el poller cada 30s)
GET https://v3.football.api-sports.io/fixtures/events?fixture={fixtureId}

// Estado en vivo de un partido
GET https://v3.football.api-sports.io/fixtures?id={fixtureId}&live=all
```

### Mapper de eventos API → eventos internos

```typescript
// apps/api/src/modules/partidos/partidos.mapper.ts
// Mapear type+detail de la API a nuestros tipos internos:

// Gol:
// type: 'Goal', detail: 'Normal Goal' | 'Penalty' | 'Own Goal'
// → EventoPartido: tipo='GOL', equipo según 'team.id'

// Tarjeta roja:
// type: 'Card', detail: 'Red Card' | 'Second Yellow Card'
// → EventoPartido: tipo='TARJETA_ROJA'

// Fin del partido:
// fixture.status.short: 'FT' (Full Time) | 'AET' (After Extra Time) | 'PEN'
// → EventoPartido: tipo='FIN_PARTIDO'
```

### Motor de puntuación (puntuacion.service.ts)

```typescript
// Lógica exacta de cálculo de puntos por ticket
function calcularPuntos(ticket: Ticket, partido: Partido): PuntosDesglosados {
  return {
    puntosResultado: calcResultado(ticket.predResultado, partido),  // 3 o 0
    puntosBtts:      calcBtts(ticket.predBtts, partido),            // 2 o 0
    puntosMas25:     calcMas25(ticket.predMas25, partido),          // 2 o 0
    puntosTarjeta:   calcTarjeta(ticket.predTarjetaRoja, partido),  // 6 o 0
    puntosMarcador:  calcMarcador(ticket, partido),                 // 8 o 0
    // Total: máximo 21 puntos
  }
}
```

---

## 20. FLUJO DE PAGO CULQI

> Culqi sandbox disponible para desarrollo. Claves de producción requieren aprobación RUC SAC.
> El código no cambia entre sandbox y producción — solo las variables de entorno.

### Flujo completo

```
1. Frontend: Usuario hace clic en "Comprar X Lukas"
   ↓
2. Frontend: Carga Culqi.js desde CDN + configura con CULQI_PUBLIC_KEY
   ↓
3. Frontend: Abre el checkout de Culqi (modal nativo de Culqi)
   Usuario ingresa datos de tarjeta
   ↓
4. Culqi: Genera token de cargo (culqiToken) y lo devuelve al frontend
   ↓
5. Frontend: Envía POST /api/v1/lukas/comprar con { monto, culqiToken }
   ↓
6. Backend (pagos.service.ts): 
   a. Llama a Culqi API con el token para ejecutar el cargo
   b. Si éxito → acredita Lukas al usuario (TransaccionLukas tipo COMPRA)
   c. Si falla → responde con error, no acredita nada
   ↓
7. Culqi: También envía webhook POST /api/webhooks/culqi (confirmación asíncrona)
   Backend verifica firma CULQI_WEBHOOK_SECRET y registra el pago
   ↓
8. Frontend: Muestra nuevo balance de Lukas
```

### Datos de prueba (sandbox Culqi)
```
Tarjeta aprobada:  4111 1111 1111 1111  CVV: 123  Vence: 09/25
Tarjeta rechazada: 4000 0000 0000 0002
```

---

## 21. CONFIGURACIÓN NEXTAUTH v5 (beta) — Implementado Sprint 1

> next-auth versión 5.0.0-beta.30 — la API difiere de v4.
> MVP: solo magic link via Resend. Google OAuth se agrega post-lanzamiento.

### Configuración actual (apps/web/lib/auth.ts)

```typescript
import NextAuth from 'next-auth'
import Resend from 'next-auth/providers/resend'
import { HablaPrismaAdapter } from '@/lib/auth-adapter'
import { crearOEncontrarUsuario, obtenerBalance } from '@/lib/usuarios'

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Railway corre detrás de proxy; sin trustHost NextAuth rechaza con UntrustedHost
  trustHost: true,
  adapter: HablaPrismaAdapter(),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: 'Habla! <equipo@hablaplay.com>',
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false
      await crearOEncontrarUsuario({
        email: user.email,
        nombre: user.name ?? user.email.split('@')[0],
      })
      return true
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const usuario = await crearOEncontrarUsuario({
          email: user.email,
          nombre: user.name ?? user.email.split('@')[0],
        })
        token.usuarioId = usuario.id
        token.rol = usuario.rol
      }
      return token
    },
    async session({ session, token }) {
      if (token.usuarioId && session.user) {
        session.user.id = token.usuarioId as string
        session.user.rol = (token.rol as 'JUGADOR' | 'ADMIN') ?? 'JUGADOR'
        session.user.balanceLukas = await obtenerBalance(token.usuarioId as string)
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/login',
    verifyRequest: '/auth/verificar',
    error: '/auth/error',
  },
})

// apps/web/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

### Custom Prisma Adapter (apps/web/lib/auth-adapter.ts)

El adapter oficial `@auth/prisma-adapter` espera un modelo `User` con campo `name`. Nuestro
modelo se llama `Usuario` con campo `nombre`. En vez de renombrar todo el schema, creamos un
adapter custom que mapea internamente. Solo implementa lo necesario para magic link + JWT session:

- `createUser` → crea `Usuario` + transacción atómica con 500 Lukas bonus
- `getUser`, `getUserByEmail`, `getUserByAccount`, `updateUser`
- `linkAccount` (para cuando se agregue OAuth post-MVP)
- `createVerificationToken`, `useVerificationToken` (para magic link)

### Tablas NextAuth en Prisma

Migración `20260416120000_add_auth_tables` agrega:
- `auth_accounts` — para OAuth providers (Google futuro)
- `auth_sessions` — no usado con JWT pero requerido por el adapter contract
- `auth_verification_tokens` — tokens del magic link
- Campos `emailVerified: DateTime?` e `image: String?` en `usuarios`

### Middleware de rutas protegidas

```typescript
// apps/web/middleware.ts
import { auth } from '@/lib/auth'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isProtected = req.nextUrl.pathname.startsWith('/wallet') ||
                      req.nextUrl.pathname.startsWith('/perfil') ||
                      req.nextUrl.pathname.startsWith('/admin')

  if (isProtected && !isLoggedIn) {
    // Guardar URL de destino para redirigir tras login
    return Response.redirect(new URL(`/auth/login?callbackUrl=${req.nextUrl.pathname}`, req.url))
  }
  // /torneos y /torneo/:id son públicas — NO redirigir
})

export const config = {
  matcher: ['/wallet/:path*', '/perfil/:path*', '/admin/:path*'],
}
```

---

## 22. CLIENTE WEBSOCKET (FRONTEND)

```typescript
// apps/web/lib/socket-client.ts
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(token?: string): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
      auth: { token },
      transports: ['websocket'],
    })
  }
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
```

```typescript
// apps/web/hooks/useRankingEnVivo.ts
import { useEffect, useState } from 'react'
import { getSocket } from '@/lib/socket-client'
import { useSession } from 'next-auth/react'

export function useRankingEnVivo(torneoId: string) {
  const { data: session } = useSession()
  const [ranking, setRanking] = useState<RankingRow[]>([])
  const [evento, setEvento] = useState<EventoPartido | null>(null)

  useEffect(() => {
    const socket = getSocket(session?.accessToken)
    socket.emit('join:torneo', { torneoId })

    socket.on('ranking:update', (data) => {
      setRanking(data.ranking)
    })

    socket.on('partido:evento', (data) => {
      setEvento(data)
      // Limpiar el evento después de 5 segundos (para notificación flotante)
      setTimeout(() => setEvento(null), 5000)
    })

    return () => {
      socket.emit('leave:torneo', { torneoId })
      socket.off('ranking:update')
      socket.off('partido:evento')
    }
  }, [torneoId, session])

  return { ranking, evento }
}
```

---

## 23. CLIENTE API (FRONTEND)

```typescript
// apps/web/lib/api-client.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL + '/api/v1'

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const error = await res.json()
    throw new ApiError(error.code, error.message, res.status)
  }

  return res.json()
}

// Métodos tipados para cada módulo
export const api = {
  torneos: {
    listar: (params?: { estado?: string; liga?: string }) =>
      apiFetch<{ torneos: TorneoConPartido[] }>(`/torneos?${new URLSearchParams(params)}`),
    detalle: (id: string) =>
      apiFetch<{ torneo: TorneoConPartido }>(`/torneos/${id}`),
  },
  tickets: {
    crear: (data: TicketInput, token: string) =>
      apiFetch<{ ticket: Ticket; nuevoBalance: number }>('/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      }, token),
    misList: (token: string) =>
      apiFetch<{ tickets: TicketConPuntos[] }>('/tickets/mis-tickets', {}, token),
  },
  lukas: {
    balance: (token: string) =>
      apiFetch<{ balance: number }>('/lukas/balance', {}, token),
    comprar: (data: { monto: number; culqiToken: string }, token: string) =>
      apiFetch<{ transaccion: TransaccionLukas; nuevoBalance: number }>(
        '/lukas/comprar', { method: 'POST', body: JSON.stringify(data) }, token
      ),
  },
  ranking: {
    get: (torneoId: string) =>
      apiFetch<{ ranking: RankingRow[]; totalInscritos: number }>(`/torneos/${torneoId}/ranking`),
  },
}
```

---

## 24. STORE GLOBAL (ZUSTAND)

```typescript
// apps/web/stores/lukas.store.ts
import { create } from 'zustand'

interface LukasStore {
  balance: number
  setBalance: (balance: number) => void
  decrementar: (monto: number) => void
  incrementar: (monto: number) => void
}

export const useLukasStore = create<LukasStore>((set) => ({
  balance: 0,
  setBalance: (balance) => set({ balance }),
  decrementar: (monto) => set((state) => ({ balance: state.balance - monto })),
  incrementar: (monto) => set((state) => ({ balance: state.balance + monto })),
}))
```

```typescript
// apps/web/stores/auth.store.ts
// Complementa NextAuth — guarda estado derivado del usuario
import { create } from 'zustand'

interface AuthStore {
  pendingTorneoId: string | null  // Torneo que activó el modal de login
  setPendingTorneoId: (id: string | null) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  pendingTorneoId: null,
  setPendingTorneoId: (id) => set({ pendingTorneoId: id }),
}))
```

---

## 25. TIPOS COMPARTIDOS (packages/shared)

```typescript
// packages/shared/src/types/api.types.ts

export interface TorneoConPartido {
  id: string
  nombre: string
  tipo: 'EXPRESS' | 'ESTANDAR' | 'PREMIUM' | 'GRAN_TORNEO'
  entradaLukas: number
  estado: 'ABIERTO' | 'CERRADO' | 'EN_JUEGO' | 'FINALIZADO' | 'CANCELADO'
  totalInscritos: number
  pozoBruto: number
  pozoNeto: number
  cierreAt: string  // ISO 8601
  partido: {
    id: string
    equipoLocal: string
    equipoVisita: string
    liga: string
    fechaInicio: string
    estado: 'PROGRAMADO' | 'EN_VIVO' | 'FINALIZADO' | 'CANCELADO'
    golesLocal: number | null
    golesVisita: number | null
  }
}

export interface TicketInput {
  torneoId: string
  predResultado: 'LOCAL' | 'EMPATE' | 'VISITA'
  predBtts: boolean
  predMas25: boolean
  predTarjetaRoja: boolean
  predMarcadorLocal: number    // 0-9
  predMarcadorVisita: number   // 0-9
}

export interface RankingRow {
  posicion: number
  usuarioId: string
  nombre: string
  puntosTotal: number
  ticketId: string
  esYo?: boolean  // Frontend marca la fila propia
}
```

---

## 26. SEED DE BASE DE DATOS

```typescript
// packages/db/prisma/seed.ts
// Datos iniciales para desarrollo y demo

const seed = async () => {
  // 1. Usuario admin
  await prisma.usuario.upsert({
    where: { email: 'hablaplay@gmail.com' },
    update: {},
    create: {
      email: 'hablaplay@gmail.com',
      nombre: 'Admin Habla',
      rol: 'ADMIN',
      verificado: true,
      balanceLukas: 10000,
    },
  })

  // 2. Premios de demo para la tienda
  await prisma.premio.createMany({
    data: [
      { nombre: 'Camiseta de fútbol', descripcion: 'Camiseta oficial de tu equipo favorito', costeLukas: 5000, stock: 10 },
      { nombre: 'Gift Card S/50', descripcion: 'Gift card canjeable en tiendas asociadas', costeLukas: 4500, stock: 50 },
      { nombre: 'Entrada al estadio', descripcion: 'Entrada para 1 partido de Liga 1', costeLukas: 1200, stock: 20 },
    ],
    skipDuplicates: true,
  })

  // 3. Partido de demo para desarrollo
  await prisma.partido.upsert({
    where: { externalId: 'demo-001' },
    update: {},
    create: {
      externalId: 'demo-001',
      liga: 'Liga 1 Perú',
      equipoLocal: 'Alianza Lima',
      equipoVisita: 'Universitario',
      fechaInicio: new Date(Date.now() + 2 * 60 * 60 * 1000), // en 2 horas
      estado: 'PROGRAMADO',
    },
  })
}
```

---

## 27. TESTING — CASOS CRÍTICOS A CUBRIR

### Reglas de negocio (tests unitarios en packages/shared y apps/api)

```typescript
// Motor de puntuación — todas las combinaciones
describe('calcularPuntos', () => {
  test('acierta los 5 → 21 puntos')
  test('solo marcador exacto → 8 puntos')
  test('solo resultado → 3 puntos')
  test('falla todo → 0 puntos')
  test('tarjeta roja sí cuando hubo → 6 puntos')
  test('tarjeta roja sí cuando NO hubo → 0 puntos')
})

// Wallet — transacciones atómicas
describe('lukas.service', () => {
  test('balance insuficiente → lanza error, no descuenta')
  test('inscripción exitosa → descuenta exactamente entradaLukas')
  test('doble inscripción con ticket idéntico → lanza TICKET_DUPLICADO')
  test('inscripción tras cierre → lanza TORNEO_CERRADO')
})

// Distribución de premios
describe('distribuirPremios', () => {
  test('100 jugadores × S/10 → rake S/120, pozo neto S/880')
  test('1er lugar recibe 35% del pozo neto')
  test('empate de puntos → desempate por marcador exacto')
})
```

### Tests de integración (Sprint 7)
- Flujo completo: registro → compra Lukas → inscripción → partido finaliza → premios acreditados
- Test de carga: 500 usuarios simultáneos en el mismo torneo durante un partido en vivo
- WebSocket: ranking se actualiza en < 2s tras evento de gol

---

## 28. CHECKLIST DE VERIFICACIÓN POR SPRINT

### Sprint 1 — Auth ✅ Completado 17 Abr
- [~] Google OAuth — pospuesto a post-MVP
- [x] Magic link por email funciona end-to-end (Resend con dominio hablaplay.com verificado)
- [x] Nuevo usuario recibe 500 Lukas bonus automáticamente (verificado en BD: tabla `usuarios` + `transacciones_lukas`)
- [x] Middleware protege /wallet, /perfil, /admin; /admin además requiere rol ADMIN
- [x] Rutas públicas (/, /torneos, /torneo/:id, /tienda) no redirigen
- [x] `trustHost: true` resuelve el error UntrustedHost de Railway proxy
- [x] NavBar dinámico: balance + avatar cuando hay sesión, botón Entrar cuando no
- [x] Páginas auth (/auth/login, /auth/verificar, /auth/error) con estilos de marca
- [ ] `pendingTorneoId` redirige al torneo correcto tras login — pendiente de Sprint 3 cuando se inscriba a torneos

### Sprint 2 — Lukas / Pagos
- [ ] Culqi checkout abre con CULQI_PUBLIC_KEY de sandbox
- [ ] Tarjeta aprobada (4111...) → Lukas se acreditan
- [ ] Tarjeta rechazada → error claro, sin acreditación
- [ ] Webhook de Culqi verificado con CULQI_WEBHOOK_SECRET
- [ ] Balance visible en NavBar en tiempo real

### Sprint 3 — Torneos
- [ ] Admin puede crear torneo desde /admin/torneos
- [ ] Torneo se cierra automáticamente 5 min antes del partido (job)
- [ ] Usuario sin balance suficiente ve error claro
- [ ] Torneo con 1 inscrito se cancela y reembolsa

### Sprint 4 — Tickets / Combinada
- [ ] Las 5 predicciones son obligatorias (validación frontend + backend)
- [ ] Marcador exacto permite 0-9 por equipo
- [ ] Ticket duplicado rechazado (mismo usuario, mismas 5 predicciones)
- [ ] Máximo 10 tickets por usuario por torneo
- [ ] Panel de puntos muestra correctamente pts posibles en tiempo real

### Sprint 5 — API-Football + Ranking
- [ ] Header `x-apisports-key` (no X-RapidAPI-Key)
- [ ] Poller corre cada 30s sin memory leaks
- [ ] Gol detectado → puntos recalculados → ranking emitido por WS en < 2s
- [ ] Tarjeta roja detectada correctamente (Red Card + Second Yellow)
- [ ] FIN_PARTIDO detectado → dispara distribución de premios

### Sprint 6 — Premios y Cierre
- [ ] Premios acreditados automáticamente tras FIN_PARTIDO
- [ ] Distribución 35/20/12/33% correcta al centavo de Luka
- [ ] Email de resultado enviado (Resend)
- [ ] Tienda muestra premios con stock > 0

### Sprint 7 — QA
- [ ] Test de carga: 500 WS simultáneos sin caída
- [ ] Prisma Studio muestra datos correctos tras flujo completo
- [ ] Sentry captura errores correctamente
- [ ] Railway auto-scale funciona bajo carga

---

## 29. ESTADO DEL SPRINT 1 (completado 17 Abr 2026)

### Lo que se construyó

**Backend / datos (Server-side en apps/web — el backend Fastify se levanta en Sprint 2):**
- `apps/web/lib/usuarios.ts` — funciones con Prisma directo: `encontrarUsuarioPorEmail`, `crearOEncontrarUsuario` (transacción atómica que crea `Usuario` + `TransaccionLukas` BONUS de 500 Lukas sin vencimiento), `obtenerBalance`
- `apps/web/lib/auth-adapter.ts` — custom Prisma adapter para NextAuth que mapea `Usuario/nombre` al contrato estándar `User/name`, sin renombrar el modelo del dominio
- `apps/web/types/next-auth.d.ts` — extiende la `Session` de NextAuth con `id`, `balanceLukas`, `rol`
- `packages/db/prisma/migrations/20260416120000_add_auth_tables/migration.sql` — agrega 3 tablas (`auth_accounts`, `auth_sessions`, `auth_verification_tokens`) + 2 columnas en `usuarios` (`emailVerified`, `image`)

**Auth / NextAuth v5:**
- `apps/web/lib/auth.ts` — configuración completa: provider Resend único, HablaPrismaAdapter, session JWT, callbacks `signIn/jwt/session`, `trustHost: true`, páginas custom
- `apps/web/app/api/auth/[...nextauth]/route.ts` — exporta los handlers GET/POST

**Middleware:**
- `apps/web/middleware.ts` — protege `/wallet`, `/perfil`, `/admin`. Admin además requiere `rol === 'ADMIN'`. Redirige a `/auth/login?callbackUrl=...` preservando destino

**Páginas de auth (bajo `/auth/*`, NO route group `(auth)`):**
- `apps/web/app/auth/layout.tsx` — layout standalone con fondo azul oscuro, sin NavBar/BottomNav
- `apps/web/app/auth/login/page.tsx` — form con Server Action que llama `signIn('resend', { email, redirectTo })`
- `apps/web/app/auth/verificar/page.tsx` — pantalla "¡Revisa tu correo!"
- `apps/web/app/auth/error/page.tsx` — mensajes de error en español según `searchParams.error`

**Componentes:**
- `apps/web/components/layout/NavBar.tsx` — async Server Component que lee sesión y renderiza balance + avatar si hay usuario, "Entrar" si no
- `apps/web/components/layout/UserMenu.tsx` — Client Component del dropdown del avatar (perfil, wallet, cerrar sesión)
- `apps/web/components/auth/ModalLoginInscripcion.tsx` — modal contextual para flujo de inscripción a torneos sin login (listo para usar en Sprint 3)
- `apps/web/components/auth/CerrarSesionBoton.tsx` — Client Component que llama `signOut({ callbackUrl: '/' })`
- `apps/web/components/home/HomeContent.tsx` — extraído del antiguo `page.tsx` para que la home sea Server Component y el NavBar pueda leer la sesión

**Páginas protegidas:**
- `apps/web/app/(main)/wallet/page.tsx` — Server Component con balance actual + placeholder para Culqi (Sprint 2)
- `apps/web/app/(main)/perfil/page.tsx` — Server Component con avatar, datos, balance, botón cerrar sesión

**Stores Zustand:**
- `apps/web/stores/lukas.store.ts` — balance con setters (`setBalance`, `decrementar`, `incrementar`)
- `apps/web/stores/auth.store.ts` — `pendingTorneoId` para el flujo de inscripción sin login

### Deploy pipeline (Dockerfile + CI)

El Dockerfile corre `prisma migrate deploy` automáticamente al arrancar el container, de modo
que cualquier migración pendiente se aplica sola. El flujo completo del Dockerfile:

1. **Stage `deps`:** `pnpm install --frozen-lockfile` — el postinstall de `packages/db` dispara `prisma generate` automáticamente
2. **Stage `builder`:** `COPY --from=deps /app ./` (trae TODO, incluyendo node_modules distribuidos) + `COPY . .` (trae source, node_modules preservado por `.dockerignore`) → `prisma generate` → `next build`
3. **Stage `runner`:** solo standalone + prisma CLI + schema. CMD: `npx prisma migrate deploy && node apps/web/server.js`

**CI:** `.github/workflows/deploy.yml` solo valida `pnpm build`. El deploy real lo hace Railway
por webhook GitHub→Railway (auto-deploy al push a `main`). Se eliminó el step `Deploy to Railway`
del workflow porque usaba un secret `RAILWAY_SERVICE_ID` que nunca existió y siempre falló.

### Infraestructura externa configurada

- **Dominio:** `hablaplay.com` comprado en Cloudflare Registrar (~$10 USD/año, WHOIS privacy activo)
- **Resend:** dominio `hablaplay.com` verificado via autoconfigure con Cloudflare (SPF + DKIM + MX creados automáticamente)
- **Remitente de emails:** `Habla! <equipo@hablaplay.com>`
- **Railway variables de entorno necesarias para el servicio web:**
  - `DATABASE_URL` → `${{ Postgres.DATABASE_URL }}` (referencia explícita al servicio Postgres; Railway NO la inyecta automáticamente entre servicios)
  - `NEXTAUTH_URL` → `https://habla-app-production.up.railway.app` (sin `/` final)
  - `NEXTAUTH_SECRET` → secret generado aleatoriamente
  - `RESEND_API_KEY` → API key de Resend
  - `HOSTNAME=0.0.0.0` (ya existía desde Sprint 0)

### Fixes aplicados durante el deploy

Cinco fixes consecutivos para hacer que Railway levantara la app correctamente:

1. **`postinstall: prisma generate` en `packages/db/package.json`** — CI fallaba con "Module '@habla/db' has no exported member 'Usuario'" porque Prisma Client no se generaba automáticamente al instalar. Ahora cualquier `pnpm install` dispara el generate
2. **Eliminar step `Deploy to Railway` del workflow** — fallaba por falta de secret `RAILWAY_SERVICE_ID` sin relación con el código. Railway deploya por webhook
3. **`@habla/db` agregado a `transpilePackages`** en `next.config.js` — junto con `@habla/shared` y `@habla/ui`. Next.js no resolvía TypeScript crudo de workspace packages sin esto
4. **Dockerfile `COPY --from=deps /app ./`** en vez de solo `/app/node_modules` — con `pnpm 10 + node-linker=hoisted` los workspace packages viven en `apps/web/node_modules/@habla/*`, NO en el root `node_modules/`. La copia selectiva los perdía
5. **`trustHost: true`** en la config de NextAuth — Railway actúa como proxy. NextAuth v5 por defecto rechaza con `UntrustedHost` si no se marca explícitamente

### Decisiones técnicas tomadas

- **Protocolo workspace explícito (`workspace:*`):** pnpm 10 no resuelve bien `"@habla/db": "*"` — lo trata como package público de npm y falla con 404. Todas las referencias cross-workspace deben usar `workspace:*`
- **Custom adapter en lugar de `@auth/prisma-adapter`:** se escribió `HablaPrismaAdapter` para mapear el modelo `Usuario` (con campo `nombre`) al contrato que espera NextAuth (modelo `User` con campo `name`). Alternativa era renombrar todo el schema pero impactaba demasiadas relaciones. El adapter custom solo implementa lo necesario para magic link + JWT session
- **JWT session strategy:** evita roundtrips a BD en cada request. El balance de Lukas se lee en el callback `session()` desde BD para mantenerlo al día (esto es aceptable porque son pocos requests de sesión)
- **`/auth/*` como path real, NO route group `(auth)`:** el prompt original pedía route group pero el NextAuth config y el middleware apuntaban a URLs `/auth/login`, `/auth/verificar`, `/auth/error`. Se unificó por coherencia — los route groups (con paréntesis) no contribuyen al URL
- **`DATABASE_URL` debe configurarse explícitamente en Railway:** inicialmente se asumió que Railway la inyectaba automáticamente, pero solo existe en el servicio Postgres. Hay que crearla en el servicio web como referencia `${{ Postgres.DATABASE_URL }}`

### Verificación end-to-end

Test exitoso el 17 Abr:
1. Usuario ingresa a `/` → ve NavBar con "Entrar" (no logueado)
2. Click "Entrar" → `/auth/login` → escribe email → submit
3. Redirige a `/auth/verificar` → inbox recibe email desde `equipo@hablaplay.com`
4. Click en el link → login completo, redirige a `/`
5. NavBar muestra "🪙 500 Lukas" + avatar con iniciales
6. **En la BD (Railway Postgres):**
   - Tabla `usuarios`: fila nueva con email, nombre (antes del `@`), balanceLukas=500, rol='JUGADOR', emailVerified fecha
   - Tabla `transacciones_lukas`: fila con tipo=BONUS, monto=500, descripcion='Bonus de bienvenida', venceEn=null
   - Tabla `auth_verification_tokens`: el token se consumió al hacer click (delete ocurre en `useVerificationToken`)

### Commits principales del Sprint 1

- `feat(sprint-1): auth magic link (Resend) + middleware + NavBar dinamica` — implementación base
- `fix(ci): generar Prisma Client en postinstall`
- `chore(ci): eliminar step de deploy a Railway redundante`
- `fix(build): agregar @habla/db a transpilePackages de Next.js`
- `fix(docker): copiar todos los node_modules distribuidos al builder`
- `fix(auth): trustHost en NextAuth para Railway proxy`
- `fix(auth): enviar magic link desde equipo@hablaplay.com`

### Pendiente del Sprint 1 (no bloqueante)

- Conectar `pendingTorneoId` del `auth.store.ts` con el modal de inscripción — se activará en Sprint 3 cuando existan torneos reales
- Agregar Google OAuth como segundo provider — pospuesto a post-MVP por decisión de producto
- URL propia (`app.hablaplay.com` apuntando a Railway via CNAME) — opcional, el dominio ya es tuyo pero por ahora usamos `habla-app-production.up.railway.app`

### Arranque del Sprint 2

Antes del Sprint 2 (módulo Lukas + Culqi), el PO debe preparar:
1. **Culqi sandbox keys** en Railway:
   - `CULQI_PUBLIC_KEY` (pk_test_...)
   - `CULQI_SECRET_KEY` (sk_test_...)
   - `CULQI_WEBHOOK_SECRET`
   - URL de webhook a configurar en Culqi dashboard: `https://habla-app-production.up.railway.app/api/webhooks/culqi`
2. **Decisión de packs de Lukas:** precios base (ej. S/10 = 10 Lukas, S/50 = 55 Lukas con bonus, S/100 = 120 Lukas)
3. Verificación del deploy de Sprint 1 en producción (✅ hecho 17 Abr)
