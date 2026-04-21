# CLAUDE.md — Habla! App

> Este archivo es el cerebro del proyecto. Léelo completo antes de tocar cualquier código.
> Última actualización: 21 de Abril 2026 (Hotfix #9 — cierre de brechas entre lo documentado y lo desplegado. Bug #24: `/tienda` en prod mostraba "No hay premios en esta categoría" porque el seed de `packages/db/prisma/seed.ts` nunca corrió contra Railway — fix con catálogo compartido en `packages/db/src/catalog.ts` + service `sembrarCatalogoPremios` idempotente (findFirst+update/create, nunca `deleteMany`) + endpoint admin `POST /api/v1/admin/seed/premios` con GET status + UI en `/admin` (`AdminSeedPremiosPanel`). Bug #25: `/perfil` invisible en la navegación mobile — fix reemplazando "Wallet" por "Perfil" como 5° item del BottomNav (Wallet sigue accesible en 1 tap desde `BalanceBadge` del header, siempre visible). 759 tests passing + 7 skipped (+47 vs baseline 712). `tsc --noEmit` limpio, `pnpm lint` sin warnings.)

---

## 1. QUÉ ES HABLA!

WebApp de torneos de predicciones deportivas orientada al mercado peruano. Los usuarios compran **Lukas** (moneda virtual in-app, 1 Luka = S/ 1) para inscribirse en torneos sobre partidos de fútbol reales. Gana quien más puntos acumule con sus predicciones. Los premios se pagan en Lukas canjeables por productos físicos o digitales en la tienda integrada.

**Posicionamiento clave:** No es una apuesta — los Lukas no se retiran como efectivo. Es un torneo de habilidad, como un torneo de ajedrez o póker de destreza.

**Fecha límite inamovible:** 11 de junio de 2026 — Día 1 del Mundial FIFA 2026.

---

## 2. MECÁNICA DEL JUEGO

### Flujo central del usuario
1. Usuario compra Lukas con soles peruanos (Culqi / Yape)
2. Usuario navega los torneos disponibles y elige uno
3. Usuario paga entrada en Lukas y arma su combinada de 5 predicciones
4. El torneo cierra 5 minutos antes del partido — las predicciones quedan selladas
5. Durante el partido, los puntos se calculan automáticamente en vivo
6. El ranking se actualiza en tiempo real mientras ocurren los eventos
7. Al terminar el partido, los Lukas del pozo neto se distribuyen automáticamente entre el top 10
8. El ganador canjea sus Lukas por premios reales en la tienda

### Puntuación por ticket (máximo 21 puntos)
| # | Predicción | Puntos | Dificultad |
|---|-----------|--------|------------|
| 1 | Resultado: Local / Empate / Visita | 3 pts | Baja |
| 2 | Ambos equipos anotan (BTTS) | 2 pts | Baja-Media |
| 3 | Más de 2.5 goles | 2 pts | Media |
| 4 | Habrá tarjeta roja | 6 pts | Alta |
| 5 | Marcador exacto | 8 pts | Muy alta |

Un jugador puede enviar múltiples tickets no idénticos para el mismo torneo — máximo 10 en MVP.

### Modelo económico
- **Rake:** 12% del pozo bruto → ingreso principal de la plataforma (sin cambios)
- **Distribución del pozo neto (Hotfix #6 — reemplaza la curva vieja 35/20/12/33%):**
  - **Paga el 10% de inscritos**, con cortes especiales para torneos chicos:
    - 2-9 inscritos → 1 pagado
    - 10-19 → 2 pagados · 20-29 → 3 · 30-49 → 5 · 50-99 → 10
    - 100+ → `round(N × 0.10)`
  - **Curva top-heavy:** el 1° recibe exactamente **45%** del pozo neto. El 55% restante se reparte entre el resto de pagados con decaimiento geométrico (`r = 1 - 2.8/M`), calibrado para que la suma sea exacta.
  - **Tablas fijas para M≤5:** M=1 [1.00], M=2 [0.65, 0.35], M=3 [0.50, 0.30, 0.20], M=5 [0.40, 0.25, 0.18, 0.10, 0.07].
  - **Empates (regla única, sin desempates):** tickets con puntaje idéntico reparten equitativamente los premios de las posiciones que ocupan como grupo. Si el grupo se extiende más allá de M, todos cobran igual su parte del pool acotado a M. El orden de inscripción se usa solo como tiebreaker cosmético estable de UI — **no afecta premios**.
  - **Implementación:** `lib/utils/premios-distribucion.ts:distribuirPremios()` — función pura. `ranking.service.ts` y `torneos.service.ts:finalizarTorneo()` delegan al helper.
- **Margen en premios físicos:** ~30%
- Los Lukas **comprados** vencen a los 12 meses; los **ganados** no vencen

### Tipos de torneo y entradas
| Tipo | Entrada | Partido típico |
|------|---------|----------------|
| Express | S/ 3–5 | Liga 1, torneos rápidos |
| Estándar | S/ 10–20 | Champions, Copa Libertadores |
| Premium | S/ 30–50 | Clásicos, partidos del Mundial |
| Gran Torneo | S/ 100 | Final del Mundial |

---

## 3. STACK TECNOLÓGICO

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Frontend | Next.js 14 (React) | SSR + PWA, sin app store |
| Backend API | Node.js + Fastify | Alta performance, tiempo real |
| Base de datos | PostgreSQL 16 | Transacciones atómicas de Lukas |
| Cache / Tiempo real | Redis 7 | Ranking en vivo, sesiones |
| ORM | Prisma | Schema, migraciones, type-safety |
| WebSockets | Socket.io (sobre Fastify) | Ranking actualizado en vivo |
| Auth | NextAuth.js v5 (beta.30) | MVP: solo magic link via Resend |
| Pagos | Culqi + Yape API | Pasarelas peruanas |
| API deportiva | api-football.com | Cuenta hablaplay@gmail.com · Header `x-apisports-key` |
| Email | Resend | Dominio hablaplay.com verificado |
| SMS | Twilio | Alertas de torneo, verificación teléfono |
| Hosting | Railway | Auto-scaling, deploy desde GitHub |
| CDN / DNS | Cloudflare | DDoS protection, edge caching |
| Monitoreo | Sentry + Grafana | Errores + dashboards de uso |
| Monorepo | pnpm 10 + Turborepo | `.npmrc` con `node-linker=hoisted` |
| CI/CD | GitHub Actions + Railway | Auto-deploy a main |
| CSS | Tailwind CSS 3.4 | Colores marca con prefijo `brand-*` |

---

## 4. ESTRUCTURA DEL MONOREPO

```
habla-app/
├── CLAUDE.md
├── .npmrc                       ← node-linker=hoisted (Windows + Node 24)
├── Dockerfile                   ← Multi-stage build para Railway
├── railway.toml                 ← builder = "DOCKERFILE"
├── .dockerignore
├── docker-compose.yml
├── .env.example
├── pnpm-workspace.yaml
├── turbo.json
│
├── apps/
│   ├── web/                     ← Next.js 14 (Frontend)
│   │   ├── app/
│   │   │   ├── (main)/
│   │   │   │   ├── page.tsx              ← Landing/home
│   │   │   │   ├── matches/              ← Lista de torneos
│   │   │   │   ├── live-match/           ← Partidos en vivo (dedicado)
│   │   │   │   ├── torneo/[id]/          ← Detalle de torneo
│   │   │   │   ├── mis-combinadas/       ← Tickets del usuario
│   │   │   │   ├── wallet/               ← Billetera
│   │   │   │   ├── tienda/               ← Catálogo de premios
│   │   │   │   ├── perfil/               ← Gestión de cuenta
│   │   │   │   ├── como-jugar/
│   │   │   │   └── faq/
│   │   │   ├── auth/                     ← login, verificar, error
│   │   │   ├── admin/                    ← Panel admin (rol ADMIN)
│   │   │   └── api/
│   │   │       ├── auth/[...nextauth]/
│   │   │       └── webhooks/culqi/
│   │   ├── components/
│   │   │   ├── layout/          ← NavBar, BottomNav, UserMenu
│   │   │   ├── matches/         ← MatchCard, FilterChips, MatchGroup
│   │   │   ├── live/            ← LiveHero, RankingTable, StatsView, EventsView, LiveSwitcher
│   │   │   ├── combo/           ← ComboModal, PredCard, ScorePicker
│   │   │   ├── tickets/         ← TicketCard, StatsPill, MatchTabs
│   │   │   ├── wallet/          ← BalanceHero, PackCard, TxList
│   │   │   ├── tienda/          ← PrizeCardV2, FeaturedPrize, CatFilters
│   │   │   ├── perfil/          ← ProfileHero, VerifRow, ToggleRow, LimitRow
│   │   │   └── ui/              ← Toast, Modal, Alert, Button, Chip
│   │   ├── lib/                 ← auth, api-client, socket-client, usuarios
│   │   ├── hooks/               ← useRanking, useBalance, useToggle
│   │   └── stores/              ← Zustand: lukas, auth, notifications
│   │
│   └── api/                     ← Node.js + Fastify (Backend)
│       ├── src/
│       │   ├── server.ts
│       │   ├── plugins/         ← auth, cors, rate-limit, redis, socket
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
│       │   │   ├── canjes/
│       │   │   ├── pagos/        ← Culqi
│       │   │   ├── notificaciones/
│       │   │   ├── verificacion/
│       │   │   ├── limites/
│       │   │   └── admin/
│       │   └── jobs/
│       │       ├── cerrar-torneos.job.ts
│       │       ├── distribuir-premios.job.ts
│       │       ├── poller-partidos.job.ts
│       │       └── vencer-lukas.job.ts
│
├── packages/
│   ├── db/                      ← Prisma schema, migraciones, seed
│   ├── shared/                  ← Tipos, constantes, utils
│   └── ui/                      ← Componentes compartidos
│
└── docs/
    ├── arquitectura.md
    ├── api.md
    └── deploy.md
```

---

## 5. MODELO DE DATOS (Prisma Schema)

```prisma
// packages/db/prisma/schema.prisma

model Usuario {
  id              String    @id @default(cuid())
  email           String    @unique
  emailVerified   DateTime?
  nombre          String
  username        String    @unique                  // @handle para ranking
  telefono        String?
  telefonoVerif   Boolean   @default(false)
  dniVerif        Boolean   @default(false)          // para canjes >S/500
  fechaNac        DateTime?
  ubicacion       String?
  image           String?
  rol             Rol       @default(JUGADOR)
  balanceLukas    Int       @default(0)
  creadoEn        DateTime  @default(now())

  tickets         Ticket[]
  transacciones   TransaccionLukas[]
  canjes          Canje[]
  preferencias    PreferenciasNotif?
  limites         LimitesJuego?

  @@map("usuarios")
}

enum Rol { JUGADOR ADMIN }

model Partido {
  id              String        @id @default(cuid())
  externalId      String        @unique             // ID de api-football.com
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
  round           String?                            // "Fecha 34", "Cuartos de final", "Fase de grupos · J1"
  venue           String?                            // "Goodison Park, Liverpool"
  eventos         EventoPartido[]
  torneos         Torneo[]
  creadoEn        DateTime      @default(now())

  @@map("partidos")
}

enum EstadoPartido { PROGRAMADO EN_VIVO FINALIZADO CANCELADO }

model EventoPartido {
  id          String   @id @default(cuid())
  partidoId   String
  partido     Partido  @relation(fields: [partidoId], references: [id])
  tipo        String                                 // GOL, TARJETA_AMARILLA, TARJETA_ROJA, FIN_PARTIDO, SUSTITUCION
  minuto      Int
  equipo      String                                 // LOCAL o VISITA
  jugador     String?
  detalle     String?
  creadoEn    DateTime @default(now())

  @@map("eventos_partido")
}

model Torneo {
  id             String        @id @default(cuid())
  nombre         String
  tipo           TipoTorneo
  entradaLukas   Int
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
  monto       Int                                    // Positivo ingreso, negativo egreso
  descripcion String
  refId       String?                                // torneoId, canjeId, culqiTxId
  venceEn     DateTime?                              // Solo COMPRA vence a 12 meses
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
  REEMBOLSO
}

model Premio {
  id                String          @id @default(cuid())
  nombre            String
  descripcion       String
  costeLukas        Int
  stock             Int             @default(0)
  imagen            String?                               // emoji fallback o URL
  categoria         CategoriaPremio @default(GIFT)
  badge             BadgePremio?                          // POPULAR | NUEVO | LIMITADO
  featured          Boolean         @default(false)       // hero de /tienda
  requiereDireccion Boolean         @default(false)
  valorSoles        Int?                                  // audit interno
  activo            Boolean         @default(true)
  canjes            Canje[]
  creadoEn          DateTime        @default(now())

  @@index([activo, categoria])
  @@map("premios")
}

enum CategoriaPremio { ENTRADA CAMISETA GIFT TECH EXPERIENCIA }
enum BadgePremio    { POPULAR NUEVO LIMITADO }

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

model PreferenciasNotif {
  usuarioId           String   @id
  usuario             Usuario  @relation(fields: [usuarioId], references: [id])
  notifInicioTorneo   Boolean  @default(true)
  notifResultados     Boolean  @default(true)
  notifPremios        Boolean  @default(true)
  notifSugerencias    Boolean  @default(true)
  notifCierreTorneo   Boolean  @default(true)
  notifPromos         Boolean  @default(false)
  emailSemanal        Boolean  @default(false)

  @@map("preferencias_notif")
}

model LimitesJuego {
  usuarioId            String    @id
  usuario              Usuario   @relation(fields: [usuarioId], references: [id])
  limiteMensualCompra  Int       @default(300)
  limiteDiarioTickets  Int       @default(10)
  autoExclusionHasta   DateTime?
  actualizadoEn        DateTime  @default(now()) @updatedAt

  @@map("limites_juego")
}

model VerificacionTelefono {
  usuarioId  String   @id
  usuario    Usuario  @relation(fields: [usuarioId], references: [id])
  telefono   String
  codigo     String                                  // SHA-256 del código
  intentos   Int      @default(0)                    // máx 3
  expiraEn   DateTime                                // TTL 10 min
  confirmado Boolean  @default(false)
  creadoEn   DateTime @default(now())

  @@map("verificacion_telefono")
}

model VerificacionDni {
  id            String         @id @default(cuid())
  usuarioId     String         @unique
  usuario       Usuario        @relation(fields: [usuarioId], references: [id])
  dniNumero     String
  imagenUrl     String                               // /uploads/dni/<hex>.{jpg|png}
  estado        EstadoVerifDni @default(PENDIENTE)
  motivoRechazo String?
  revisadoEn    DateTime?
  creadoEn      DateTime       @default(now())

  @@map("verificacion_dni")
}

enum EstadoVerifDni { PENDIENTE APROBADO RECHAZADO }

model SolicitudEliminacion {
  id           String    @id @default(cuid())
  usuarioId    String
  usuario      Usuario   @relation(fields: [usuarioId], references: [id])
  token        String    @unique                    // crypto.randomBytes(32).hex
  expiraEn     DateTime                              // TTL 48h
  confirmadaEn DateTime?
  creadoEn     DateTime  @default(now())

  @@map("solicitudes_eliminacion")
}
```

**Usuario extendido (Sub-Sprint 7):** el model `Usuario` agrega `username: String? @unique` (para @handle), `telefonoVerif: Boolean`, `dniVerif: Boolean`, `ubicacion: String?`, `deletedAt: DateTime?` (soft delete). Las relaciones `preferenciasNotif`, `limitesJuego`, `verifTelefono`, `verifDni`, `solicitudesElim[]` son opcionales para compat con usuarios legacy.

---

## 6. REGLAS DE NEGOCIO CRÍTICAS

### Lukas
- **1 Luka = S/ 1**. `balanceLukas` en unidades enteras, nunca centavos.
- Todo movimiento es transacción atómica. Si falla cualquier paso, se revierte todo.
- El balance nunca puede ser negativo. Verificar ANTES de descontar.
- Los Lukas de COMPRA vencen a 12 meses. Los ganados (PREMIO_TORNEO, BONUS) NO vencen.
- Los Lukas **NO son retirables como efectivo** bajo ninguna circunstancia.
- Bonus de bienvenida: **500 Lukas** (tipo BONUS, sin vencimiento).
- **Packs de compra con bonus:** 20 (+0), 50 (+5), 100 (+15), 250 (+50).

### Torneos y Tickets
- Cierre de inscripciones: **exactamente 5 minutos antes del inicio** del partido. Automático e irreversible.
- Dos tickets del mismo usuario en el mismo torneo no pueden tener las 5 predicciones idénticas (constraint en BD).
- Máximo **10 tickets** por usuario por torneo.
- Predicciones enviadas son **inmutables**.
- Torneo con <2 inscritos al cierre → se cancela y reembolsa la entrada.

### Puntuación y ranking
- Puntos se calculan exclusivamente de eventos de **api-football.com**. Cero intervención manual.
- Si la API falla, los puntos quedan en "pendiente" y se calculan retroactivamente al restaurarse.
- **Motor proyectivo (Hotfix #6):** TODOS los campos (resultado, BTTS, +2.5, tarjeta roja, marcador exacto) se proyectan en vivo como "si terminara ahora". El marcador exacto suma/resta en cada gol (antes quedaba en 0 durante EN_VIVO).
- **Desempate: eliminado** (Hotfix #6). Tickets con mismos puntos reciben el mismo premio — ver §2 "Distribución".
- Rake exactamente 12% del pozo bruto, al entero de Luka.
- **Distribución (Hotfix #6):** paga el 10% de inscritos con curva top-heavy (45% al 1°, 55% restante decayendo). Ver detalles en §2.
- Del **puesto M+1 en adelante no reciben premio** (M = `calcularPagados(totalInscritos)`).

### Juego responsable
- **Edad mínima: 18 años** — verificación obligatoria al registro.
- **Límite mensual de compra**: bloqueante. Por defecto S/ 300/mes.
- **Límite diario de tickets**: bloqueante. Por defecto 10/día.
- **Auto-exclusión temporal**: 7, 30 o 90 días. Bloquea login y acciones.
- Mostrar siempre rake y distribución del pozo antes de cada inscripción.

### Navegación
- Cualquier usuario puede navegar sin estar logueado: ver torneos, ranking en vivo, tienda.
- Login se solicita solo al intentar: inscribirse, canjear, acceder a wallet o perfil.
- Tras login, el flujo continúa al destino original (`pendingTorneoId`, `callbackUrl`).

### Seguridad
- Rate limiting: 60 requests/min por IP.
- Verificación email obligatoria para comprar Lukas.
- Predicciones bloqueadas con timestamp al envío.

---

## 7. ENTORNO Y COMANDOS

### Variables de entorno (.env.example)
```bash
# BD
DATABASE_URL=postgresql://habla:habla@localhost:5432/habladb
REDIS_URL=redis://localhost:6379

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# API Deportiva (NO usar RapidAPI)
API_FOOTBALL_KEY=
API_FOOTBALL_HOST=v3.football.api-sports.io

# Pagos Culqi (sandbox primero)
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
SENTRY_DSN=
```

### Notas críticas Railway
- `DATABASE_URL` NO se hereda entre servicios. Crear explícitamente con `${{ Postgres.DATABASE_URL }}`.
- `NEXTAUTH_URL` sin `/` final. `HOSTNAME=0.0.0.0` obligatorio.
- `trustHost: true` en la config de NextAuth para Railway proxy.

### Comandos principales
```bash
pnpm install
docker-compose up -d
pnpm --filter @habla/db db:migrate
pnpm --filter @habla/db db:seed
pnpm dev          # web :3000, api :3001
pnpm test
pnpm build
pnpm lint
```

---

## 8. ESTADO ACTUAL — QUÉ ESTÁ HECHO

### ✅ Sprint 0 (11-15 Abr) — Fundamentos
Monorepo pnpm 10 + Turborepo, Docker Compose con Postgres 16 y Redis 7, Prisma con schema inicial, CI/CD con GitHub Actions, deploy a Railway con Dockerfile multi-stage, landing page pública con tabs, NavBar, BottomNav, paleta de colores de marca en Tailwind, fuentes Barlow Condensed + DM Sans. URL producción: `https://habla-app-production.up.railway.app`.

### ✅ Sprint 1 (18-17 Abr) — Auth + base de cuentas
NextAuth v5 con magic link vía Resend (dominio hablaplay.com verificado), custom Prisma adapter que mapea `Usuario/nombre` al contrato de NextAuth, middleware de rutas protegidas (`/wallet`, `/perfil`, `/admin`), bonus de bienvenida de 500 Lukas automático al registrarse, NavBar dinámico con balance + avatar cuando hay sesión, páginas `/auth/login`, `/auth/verificar`, `/auth/error` con estilos de marca. Migración `20260416120000_add_auth_tables` agregó `auth_accounts`, `auth_sessions`, `auth_verification_tokens`.

### 🎨 Mockup — Diseño UI aprobado
Mockup interactivo completo en `/mockup.html` y en `docs/habla-mockup-completo.html`. Cubre todas las páginas del MVP con estilos finales, paleta de marca extendida (urgencias, acentos por tipo de torneo, dark surfaces), componentes resueltos y flujos navegables. **Este mockup es la fuente de verdad del diseño** — cada sprint debe replicar lo que se ve ahí, no improvisar.

### ✅ Fase 2 (18 Abr) — Reescritura frontend Sprint 0-1 desde mockup v5
Todos los componentes visuales de Sprint 0-1 fueron reescritos desde cero usando `docs/habla-mockup-completo.html` como fuente de verdad. Se crearon primitivos UI (`Button`, `Chip`, `Alert`, `Toast`, `Modal` en `components/ui/`), `NavBar` + `NavLinks` + `BottomNav` + `UserMenu` del mockup 1:1, y un `MatchCard` con 4 tiers de urgencia. La landing `/` se compone de `MatchesPageContent` que trae listado + sidebar sticky (3 widgets: En vivo ahora / Top del día / Tu balance — auth-aware). Tokens legacy eliminados; cero hex hardcodeados fuera de `tailwind.config.ts` y `globals.css`.

### ✅ Sub-Sprint 3 (18 Abr) — Torneos + Partidos + Admin
Módulos `torneos` y `partidos` con CRUD, inscripción atómica y cancelación automática. Integración api-football vía `x-apisports-key`. Cron **in-process** (vive dentro del proceso Next.js vía `apps/web/instrumentation.ts` con `setInterval`; corre cada minuto sin dependencias externas) más el endpoint `/api/cron/cerrar-torneos` opcional para trigger manual/externo. Páginas `/matches` (mismo content que `/`, sidebar sticky, urgency calculada), `/torneo/:id` (detalle con reglas + distribución del pozo + CTA según estado), `/admin` (panel importar partidos + crear torneos).

### ✅ Sub-Sprint 3.5 (18 Abr) — Auto-import de partidos y torneos
El admin ya no tiene que tocar el panel para traer partidos. Tres jobs nuevos corren en el mismo cron in-process de `apps/web/instrumentation.ts`:

1. **Refresh de temporadas** — al arranque y cada 24h, `refreshAllSeasons()` (en `lib/services/seasons.cache.ts`) resuelve la temporada activa de cada liga whitelisteada llamando `/leagues?id=X&current=true` en api-football. El cache vive en memoria; la temporada **nunca** está hardcodeada por año.
2. **Import inicial** — 30s después del boot del server corre `importarPartidosTodasLasLigas()` (en `lib/services/partidos-import.service.ts`), que recorre `LIGAS_ACTIVAS` (`lib/config/ligas.ts`) y por cada liga trae fixtures de `hoy → hoy+14d`, los upsertea por `externalId` y **crea un torneo por cada partido nuevo** con tipo + entrada tomados de `LigaConfig`.
3. **Import periódico** — cada 6h el mismo job corre de nuevo; actualiza fecha/estado/marcador de los partidos existentes y crea torneos sólo para los partidos nuevos (idempotente: si un partido ya tiene torneo, no se duplica).

Ligas whitelisteadas (editables en `apps/web/lib/config/ligas.ts`): Liga 1 Perú (EXPRESS, 5 Lukas), Champions (ESTANDAR, 10), Libertadores (ESTANDAR, 10), Premier (EXPRESS, 5), La Liga (EXPRESS, 5), Mundial 2026 (PREMIUM, 30).

El endpoint `POST /api/v1/admin/partidos/importar` sigue existiendo como botón de panic desde `/admin`, pero ya no recibe `fecha`: dispara el mismo job y devuelve `ImportLigaResult[]` con 4 contadores por liga (partidosCreados, partidosActualizados, torneosCreados, errores) + la season resuelta. El panel muestra la tabla por liga tras cada refresh.

### ✅ Fase 3 (18-19 Abr) — UX de /matches
Migración Prisma `add_round_venue_to_partidos` agrega `round` y `venue` a `Partido`. El poller los llena al importar (mapper `round-mapper.ts` traduce inglés→español y ejecuta en `fixtureToPartidoInput`). Filtros funcionales en `/matches` con estado en URL (`?liga=&dia=`): chip activo dorado para liga, chip azul-dark para día, counts dinámicos. **Default sin filtros:** se muestran todos los torneos `ABIERTO` de la ventana (14 días) ordenados por `partido.fechaInicio ASC`; chip "Todos" aparece primero y activo. Click en "Hoy"/"Mañana"/día individual agrega `?dia=YYYY-MM-DD`, click en "Todos" lo quita. Zona horaria normalizada a `America/Lima` con fallback al browser (`getUserTimezone`). **Filtro de día scrolleable (19 Abr):** el chip row se generaba recortado a 7 días y dejaba fuera torneos reales de la ventana; ahora genera 1 chip por cada día con ≥1 torneo dentro de los 14 días y el row scrollea horizontalmente (`scroll-snap-type: x proximity`, scroll-smooth, spacer al final). Los días del mes actual muestran formato corto (`Lun 20`), los de otro mes incluyen mes abreviado (`Sáb 28 abr`, `Mié 1 ene`) para desambiguar — helper `formatDayChip` en `lib/utils/datetime.ts`. Gradientes laterales + flechas redondas `‹` / `›` aparecen según `canScrollLeft/Right` (hook `useScrollIndicators` en `hooks/useScrollIndicators.ts`); flechas ocultas en mobile vía `[@media(hover:none)]`. Navegación por teclado con ← → / Home / End + roving tabindex (container `role="toolbar"`). MatchCard rediseñada (~150px, 55% más compacta): accent bar lateral coloreado por liga, avatares hash-color con iniciales (`team-colors.ts`), stats en grid `1fr/1.7fr/1fr` con pozo dorado featured, CTA lateral 110px con SVG diana 22×22 y flecha. Responsive <640px el CTA pasa a fila inferior full-width. Empty state cubre las 4 combinaciones de `(liga, día)` con mensaje y CTAs específicos. Helpers: `lib/utils/datetime.ts`, `lib/utils/round-mapper.ts`, `lib/utils/team-colors.ts`. Endpoint `GET /api/v1/torneos` acepta `?desde=&hasta=` (ISO 8601 UTC) para filtro por rango de `partido.fechaInicio`.

### ✅ Sub-Sprint 4 (19 Abr) — Combinadas
Módulo `tickets` (`apps/web/lib/services/tickets.service.ts`) con `crear`, `listarMisTickets`, `calcularStats`. Validaciones: torneo ABIERTO + `cierreAt>now`, balance suficiente, unique-constraint compuesto de predicciones (captura `P2002` → `TICKET_DUPLICADO` 409), máximo 10 tickets/torneo, límite diario de tickets (contando últimas 24h, default 10 — el Sub-Sprint 7 leerá `LimitesJuego`). Todo el flujo atómico en `prisma.$transaction`: descuento Lukas + update torneo (pozoBruto, totalInscritos) + create `Ticket` + `TransaccionLukas ENTRADA_TORNEO`; rollback total si algún paso falla. **Reemplazo de placeholder:** si el usuario tiene un `Ticket` con las predicciones default del Sub-Sprint 3 (`LOCAL / 0-0 / todo false`), la primera `crear()` lo ACTUALIZA en vez de crear uno nuevo y NO re-descuenta la entrada (ya se cobró al inscribirse). A partir del segundo ticket, cada uno descuenta `entradaLukas` y debe tener predicciones distintas a todos los previos. Endpoints `POST /api/v1/tickets`, `GET /api/v1/tickets/mis-tickets?estado=ACTIVOS|GANADOS|HISTORIAL&page=&limit=`, `GET /api/v1/tickets/stats`. Modal centrado `ComboModal` (`components/combo/`): header `bg-hero-blue` con shimmer dorado, 4 metas live (entrada/pozo/1er premio/cierre con countdown cada 1s), body con 5 `PredCard` + `ScorePicker` para marcador exacto (±, rango 0-9), footer con preview de puntos máx (cálculo client-side) y balance después, botón primario disabled hasta completar las 5 preds. Lanzable desde `/matches` (via CTA "Crear combinada" en `/torneo/:id`), `/mis-combinadas` (botón "+ Otra combinada") y `/live-match` (ComboLauncher con session guard + fetch del torneo + resolución de placeholder). Página `/mis-combinadas` con `StatsPill` × 5 (jugadas/ganadas/acierto%/neto/mejor puesto), tabs Activas/Ganadas/Historial (URL-state `?tab=`), `MatchGroup` por partido con variantes live/scheduled/won/neutral y `TicketCard` con 3 estilos (in-top dorado, out/pending azul-left-border, winner dorado-lleno). Chips resueltos por el helper puro `tickets/adapter.ts:resolvePrediccionesChips` (pending/correct/wrong según snapshot del partido). CTA del detalle de torneo en estado ABIERTO reemplazado de `InscribirButton` → `ComboLauncher` (con `label="✏️ Editar mi combinada"` si hay placeholder).

### ✅ Sub-Sprint 5 (19 Abr) — Motor de puntuación + Ranking en vivo
**Schema:** migración `20260419120000_add_eventos_partido` agrega `EventoPartido` (tipo / minuto / equipo / jugador / detalle) con unique natural key `(partidoId, tipo, minuto, equipo, COALESCE(jugador,''))` para upsert idempotente del poller y foreign key con `onDelete: Cascade` desde `Partido`. **WebSockets:** custom server en `apps/web/server.ts` monta `Socket.io` sobre el mismo HTTP server que Next 14 (se removió `output: "standalone"` en `next.config.js`; `tsx` reemplaza `node server.js` en dev y prod, Dockerfile actualizado para correr `tsx apps/web/server.ts`). Handshake autentica con JWT HS256 de 5 min emitido por `GET /api/v1/realtime/token` (firmado con `AUTH_SECRET` vía `jose`), expuesto en `lib/realtime/socket-auth.ts`. Rooms por `torneo:{id}`. Eventos cliente→server: `join:torneo` / `leave:torneo`. Server→cliente: `ranking:update`, `partido:evento`, `torneo:cerrado`, `torneo:finalizado` (tipos compartidos en `lib/realtime/events.ts`). Cliente con ref-counting (`lib/realtime/socket-client.ts`) — varios componentes piden el mismo torneoId sin dup-joins y el último `leave` cierra el room. **Motor puro:** `puntuacion.service.ts:calcularPuntosTicket(ticket, snapshot)` aplica la tabla de §2 (3/2/2/6/8 = 21). Semántica en vivo: resultado 1X2 y marcador live se proyectan según `Partido.goles*` actuales (el ranking refleja "si terminara ahora"); BTTS y +2.5 se adjudican parcialmente (ej. 1-1 ya confirma BTTS=true); tarjeta roja se confirma true al instante y false sólo al `FINALIZADO`; marcador exacto sólo se adjudica al `FINALIZADO` (puede mutar hasta el pitazo). `recalcularTorneo(torneoId)` re-puntúa todos los tickets con diffs (sólo escribe los que cambiaron) y pushea el score al sorted set Redis `torneo:{id}:ranking` (TTL 48h). **Ranking:** `ranking.service.ts:listarRanking` ordena por `puntosTotal DESC → marcador acertado → tarjeta acertada → creadoEn ASC`, calcula `premioEstimado` según distribución 35/20/12/33% (4°-10° dividido en 7) con `pozoNeto` real o `pozoBruto×0.88` si el torneo aún está ABIERTO; devuelve `miPosicion` cuando el caller pasa `usuarioId`. `finalizarTorneo()` (llamado por el poller en FIN_PARTIDO) fija `posicionFinal` + `premioLukas` en cada ticket y cambia el torneo a FINALIZADO (la distribución real de Lukas y emails queda para Sub-Sprint 6). **Poller:** `poller-partidos.job.ts` corre cada 30s en `instrumentation.ts` junto al resto del cron in-process: filtra `estado=EN_VIVO OR (estado=PROGRAMADO AND fechaInicio<=now+15min)`, por partido hace `GET /fixtures?id=X` + `GET /fixtures/events?fixture=X`, upsertea `Partido.estado/goles/flags/huboTarjetaRoja` + inserta eventos nuevos (dedupe por natural key), recalcula todos los torneos ligados + emite `partido:evento` por cada evento nuevo + `ranking:update` si hubo cambio relevante + `torneo:finalizado` si pasó a FT. Cuando el partido arranca (PROGRAMADO→EN_VIVO), los torneos CERRADO pasan a EN_JUEGO automáticamente. Manejo de 429 con backoff exponencial (cap 5 min, reset al siguiente tick sin errores). **Endpoints nuevos:** `GET /api/v1/torneos/:id/ranking?page=&limit=` (devuelve `miPosicion` si hay sesión), `GET /api/v1/partidos/:id/eventos`, `GET /api/v1/partidos/:id/stats` (fetch en vivo de `/fixtures/statistics` con cache in-memory 15s), `GET /api/v1/live/matches`, `GET /api/v1/realtime/token`. Stats mapeadas a 7 métricas estándar por lado (posesión, tiros, tiros al arco, tarjetas, córners, faltas, offsides, pases) por `eventos.mapper.ts:parsePorcentaje/parseEntero`. **UI:** `/live-match` nuevo (server component thin + client `LiveMatchView` que orquesta WS, tabs, switcher) con `LiveSwitcher` (hasta 6 partidos), `LiveHero` (bg-stadium, score dorado 56px, 4 stats + timeline inline), `MiTicketCard` (card dorada con chips por estado), tabs `RankingTable` (top 10 + línea de corte + botón expand), `StatsView` (barras graduadas, refresh 30s), `EventsView` (timeline con íconos por tipo). Sidebar sticky de `/matches` ya consume `prisma.partido` + `listarRanking(top 1)` real (adiós mock); widget Live linkea `/live-match?torneoId=`. Hooks `useRankingEnVivo` y `useEventosPartido` gestionan fetch inicial + suscripción WS + reconexión auto + cleanup con ref-counting. **Redis:** `ioredis` opcional — si `REDIS_URL` no está seteada, el ranking degrada a lectura directa desde BD (el sistema sigue funcionando, sólo pierde el cache sub-ms). **Tests:** 54 unit tests en `apps/web/tests/` cubriendo motor de puntuación (matriz de 5 predicciones × 4 estados de partido), distribución de premios, desempate, mapper de eventos, validación Zod y adapter de chips. Integration suite con `describe.runIf(DATABASE_URL)` para los 5 casos de error del flujo `POST /tickets`. Script k6 `tests/load/ranking-500-users.js` simula 500 VUs sobre el mismo torneo 10 min con threshold `p95<500ms` para ms entre emisión del server y recepción del cliente.

### 🔧 Hotfix 19 Abr — NavBar visible + CTA "Crear combinada" inline + limpieza de copy
Dos bugs que aparecieron en producción tras el deploy de Sub-Sprints 4+5, resueltos sin tocar otros sistemas.

**Bug #1 — NavLinks invisibles en estado default.** Los links inactivos del header se veían como texto transparente sobre navy. Root cause doble: el mockup define `.nav-link{color:var(--dark-muted)}` (#7B93D0) que sobre `bg-dark-surface` (#001050) da contraste ~1.5:1 (por debajo de WCAG AA 4.5:1), y en el config actual los tokens nested `text-dark-text` / `text-dark-muted` NO se generan como utilities porque `textColor.dark: "#001050"` (string flat en `tailwind.config.ts`) colisiona con la expansión de `colors.dark.*`. Fix: `NavLinks.tsx` usa `text-white/80 hover:text-white` (tokens built-in de Tailwind) — da 11.4:1 sobre navy (AAA) y no depende del namespace roto. El BottomNav mobile vive sobre fondo light y no tenía el bug. Constantes `NAV_LINK_INACTIVE_CLASSES` / `NAV_LINK_ACTIVE_CLASSES` exportadas + `data-testid="nav-link-<slug>"` para el test `tests/nav-links.classes.test.ts` que previene regresiones (4 aserciones: tiene `text-white/80`, no tiene `text-dark-muted`, mantiene `hover:text-white`, estado activo conserva gold tokens). La deuda del config (nested tokens rotos) queda documentada en CLAUDE.md §14 y se fixea en un PR dedicado — el scope de este hotfix era visual, no design system.

**Bug #2 — CTA "Crear combinada" del MatchCard navegaba a /torneo/:id en vez de abrir el modal.** En el wiring original del Sub-Sprint 4, el CTA lateral seguía siendo un `<Link>` a `/torneo/:id` (pre-existente de Fase 3) y sólo el CTA grande del detalle usaba `ComboLauncher`. Fix en 4 piezas: (1) `apps/web/components/combo/combo-info.mapper.ts` extrae el mapper puro `buildComboTorneoInfo(payload) → ComboTorneoInfo` (testeado en `tests/combo-info.mapper.test.ts` con 7 casos: null data, mapping base, fallback `pozoBruto×0.88` cuando pozoNeto=0, pozoNeto real cuando >0, placeholder detection, redondeo `Math.floor`). (2) `apps/web/hooks/useComboOpener.ts` centraliza el state machine del fetch + modal (open/loading/error/torneoInfo); lo consumen los 3 launchers. ComboLauncher se refactoreó para usarlo — 40 líneas menos, misma API externa. (3) `components/matches/MatchCardCTA.tsx` (client component nuevo): con sesión renderiza `<button>` que abre el modal inline; sin sesión renderiza `<Link>` a `/auth/login?callbackUrl=<basePath>?openCombo=<torneoId>`. Constante `MATCH_CARD_CTA_CLASSES` exportada para testear el layering z-index. (4) `components/combo/AutoOpenComboFromQuery.tsx` (client): montado en `MatchesPageContent`, detecta `?openCombo=<id>` post-login, dispara el fetch + abre el modal automáticamente; al cerrar limpia el query param con `router.replace` preservando `?liga=` y `?dia=`. El ref counter interno evita re-disparo en hot reload. MatchCard ahora envuelve accent + body en un `<Link>` sibling del CTA (dos anchors hermanos, nada nested) — click en el body navega a `/torneo/:id`, click en el CTA abre modal. `MatchesPageContent` y `HomePage` pasan `basePath="/matches"` o `basePath="/"` para que el `callbackUrl` regrese al origen.

**Cleanup de copy interno en UI pública.** Grep de `Sub-Sprint|placeholder|próximamente|WIP` devolvió 3 hits en copy visible: (a) `app/(main)/torneo/[id]/page.tsx` — removí "El Sub-Sprint 4 habilita el formulario; por ahora la inscripción crea un ticket placeholder." del bloque Reglas de puntaje, queda "Arma tu combinada de 5 predicciones — máximo 21 puntos." (b) `app/(main)/wallet/page.tsx` — "Próximamente: Compra de Lukas · En el Sub-Sprint 2 habilitamos…" → "Compra de Lukas · Estamos terminando la integración con Culqi…". (c) `app/(main)/perfil/page.tsx` — similar reemplazo en el bloque de gestión. Los comentarios `//` internos con referencias a "Sub-Sprint X" quedaron intactos (son documentación del código, no UI).

**Smoke verificado en preview local** (http://localhost:3000 con Docker Compose + 3 torneos seed): NavBar desktop 1400×900 muestra los 5 links `rgba(255,255,255,0.8)` + activo dorado `rgb(255,184,0)`; CTA del primer MatchCard sin sesión → `/auth/login?callbackUrl=%2Fmatches%3FopenCombo%3Dsmoke_torneo_smoke_1` (callbackUrl correcto); body link del card → `/torneo/smoke_torneo_smoke_1`; `/torneo/:id` sin copy obsoleta; `/wallet` redirige a login como esperado; `/live-match`, `/tienda`, `/` sin regresiones. Tests: 66 pasan + 4 integration skipped por `DATABASE_URL`.

### 🔧 Hotfix #2 19 Abr — Lukas store hidratado, /live-match ve partidos no transicionados, /mis-combinadas protegida + force-dynamic
Tres bugs reportados en smoke testing post-Sub-Sprints 4+5 que el hotfix anterior no contemplaba. Cada uno tiene root cause distinto pero todos se manifestaban en el mismo flow real del usuario (loggearse → inscribirse → editar combinada → ir a tickets → ver partido en vivo).

**Bug #1 — Footer del ComboModal mostraba "Balance después: -5".** Root cause confirmado leyendo `apps/web/stores/lukas.store.ts`: el store inicializa `balance: 0` y NO hay hidratación inicial desde la sesión NextAuth. El NavBar (Server Component) leía `session.user.balanceLukas` directo y mostraba bien — el ComboModal (Client Component) leía `useLukasStore((s) => s.balance)` y veía `0` hasta que el usuario hacía la primera mutación (post-submit). `balanceDespues = 0 - entradaLukas = -5` para usuarios sin tickets previos en el torneo (placeholder=false). Adicional: el modal nunca validaba balance insuficiente antes de submit — el botón quedaba clickeable y el backend rechazaba con `BalanceInsuficiente` 400, dando UX pésimo. Fix en 4 piezas: (1) `apps/web/components/auth/LukasBalanceHydrator.tsx` (nuevo, client) — recibe `initialBalance: number | null` y hace `setBalance` en su primer effect (un solo render por mount, no-op si null). (2) `app/(main)/layout.tsx` se vuelve `async` y llama `auth()` para pasar `initialBalance={session?.user?.balanceLukas ?? null}` al hydrator. Esto garantiza que el store esté sincronizado con la sesión ANTES de que cualquier ComboModal pueda abrirse en cualquier ruta del grupo `(main)`. (3) `apps/web/components/combo/combo-info.mapper.ts` agrega la función pura `computeComboFooterState({balance, entradaLukas, tienePlaceholder}) → {costoLukas, balanceDespues, displayBalanceDespues, balanceInsuficiente, ctaMode}`. `displayBalanceDespues = Math.max(0, balanceDespues)` garantiza que la UI nunca muestre negativo. `balanceInsuficiente = !tienePlaceholder && balance < entradaLukas` activa el modo "comprar". (4) `ComboModal.tsx` consume el helper, muestra `displayBalanceDespues` en el footer y reemplaza el botón "Inscribir" por un `<Link href="/wallet">🪙 Comprar Lukas</Link>` con mensaje "Te faltan X 🪙" cuando `balanceInsuficiente`. El `handleSubmit` añade defensa redundante: si por race se llama con `balanceInsuficiente`, no avanza. Tests: 7 casos puros en `tests/combo-info.mapper.test.ts` cubriendo los edge cases a)-i) del PO + 10 estructurales en `tests/lukas-store.hydration.test.ts` que validan que el hydrator es client component, recibe `initialBalance`, llama `setBalance` en `useEffect`, e ignora `null` sin tocar el store; más assert sobre `(main)/layout.tsx` que verifica `await auth()` + monta el hydrator.

**Bug #2 — /live-match decía "no hay partidos en vivo" aunque la sidebar de /matches sí los mostraba.** Root cause confirmado leyendo `apps/web/app/(main)/live-match/page.tsx:24-31`: el query Prisma tenía `where: { OR: [...], torneos: { some: { estado: { in: ["EN_JUEGO","FINALIZADO","CERRADO"] } } } }`. El `torneos.some` es filtro EXISTENCIAL — descarta el partido entero si ningún torneo está en esos estados. Caso real: el cron in-process de cierre corre cada 60s y puede llegar tarde a transicionar `ABIERTO→CERRADO` cuando el partido ya arrancó (`PROGRAMADO→EN_VIVO` se hace en el poller cada 30s). Mientras los torneos quedan en `ABIERTO`, el partido EN_VIVO desaparece de /live-match aunque la sidebar (que no usa `some`) sí lo muestra. Fix: extraer la query a un helper compartido `apps/web/lib/services/live-matches.service.ts` que: (a) `obtenerLiveMatches()` filtra solo por `partido.estado in ["EN_VIVO","FINALIZADO"]`, sin filtro existencial sobre torneos, y excluye torneos `CANCELADO` via `include.torneos.where`; (b) `elegirTorneoPrincipal(torneos)` ordena por estado (EN_JUEGO > CERRADO > FINALIZADO > ABIERTO) y dentro del mismo estado por `pozoBruto DESC` — así un partido cuyo torneo aún está ABIERTO igual elige uno y se rendera con ranking (que `listarRanking` calcula bien aún para torneos ABIERTOS, devolviendo tickets con `puntosTotal=0`). Migré los 3 consumers para usar el mismo helper: `app/(main)/live-match/page.tsx` (server page), `app/api/v1/live/matches/route.ts` (endpoint público), `components/matches/MatchesSidebar.tsx` (widget). El tipo `LiveMatchTab.torneoEstado` en `LiveMatchView.tsx` se extendió para aceptar `"ABIERTO"`. Tests: 8 unit en `tests/live-matches.service.test.ts` cubriendo prioridad por estado, prioridad por pozoBruto, exclusión de CANCELADO, y un `BUG REPRO` que asserta que con todos los torneos ABIERTOS igual elige uno; más 1 integration con `describe.runIf(DATABASE_URL)` que siembra un partido `EN_VIVO` con torneo `ABIERTO` y verifica que `obtenerLiveMatches` lo devuelve (escenario exacto del bug). Smoke en navegador: con seed manual `UPDATE partidos SET estado='EN_VIVO' WHERE externalId='smoke_3'` (torneo asociado quedó en `ABIERTO`), `/live-match` ahora muestra el partido Liverpool 1-0 Arsenal, 42 jugadores, pozo neto 184 🪙, 1er premio 64 🪙 — antes del fix mostraba el empty state.

**Bug #3 — /mis-combinadas y modales redirigían a /auth/login pese a sesión vigente.** Tres root causes acumulados, todos confirmados en el código: (a) `apps/web/middleware.ts` solo cubría `/wallet`, `/perfil`, `/admin` — `/mis-combinadas` no estaba en el matcher, así que la página redirigía a login internamente via `auth()` en el RSC. Esto dejaba al usuario en una ventana donde la primera renderización podía evaluar `auth()` con un cookie aún no propagado (Next.js 14 + NextAuth v5 beta.30) y mandarlo a login. Refresh re-evaluaba con cookie ya disponible y volvía la sesión. (b) Las páginas autenticadas no tenían `export const dynamic = "force-dynamic"`, así que Next.js podía cachear el RSC con la primera evaluación (anónima) y servirlo a navegaciones posteriores autenticadas. (c) Hooks `useEventosPartido.ts:41`, `useRankingEnVivo.ts:55` y `components/live/StatsView.tsx:34` hacían `fetch()` sin `credentials: 'include'` — el default `same-origin` del browser SÍ envía cookies same-origin, pero ser explícito elimina cualquier ambigüedad por service workers, polyfills o tests con mocks. Adicional: el `session` callback en `auth.ts` llamaba `await obtenerBalance(token.usuarioId)` sin try/catch — si Prisma fallaba (latencia, transient error), el callback throwaba y NextAuth devolvía `null`, causando que el usuario "perdiera" la sesión hasta el próximo request. Fix en 5 piezas: (1) `middleware.ts` agrega `/mis-combinadas/:path*` al matcher (junto a `/wallet`, `/perfil`, `/admin`). Exporta también `PROTECTED_MATCHERS` para test de regresión — la lista en `config.matcher` se duplica como literal porque Next.js no soporta spread (`[...PROTECTED_MATCHERS]`) en config (parser estático), y el test antidrift verifica que ambas listas contienen los paths críticos. (2) `force-dynamic` agregado a `app/(main)/mis-combinadas/page.tsx` y `app/(main)/wallet/page.tsx`. (3) `apps/web/lib/api-client.ts` (refactor del placeholder existente) — exporta `authedFetch(url, init?)` que pasa `credentials: 'include'` por defecto, respetando override del caller. Convención: TODO fetch client-side a `/api/v1/*` debe pasarlo, vigilada por test de regresión que escanea el AST de los 8 archivos consumers. (4) Migración de TODOS los fetches a `authedFetch`: `ComboModal.tsx`, `useComboOpener.ts`, `useEventosPartido.ts`, `useRankingEnVivo.ts`, `StatsView.tsx`, `socket-client.ts`, `InscribirButton.tsx`, `AdminTorneosPanel.tsx` (3 calls). Cero `fetch("/api/v1/...")` directos quedaron en client code. (5) `auth.ts` envuelve `obtenerBalance` en `try/catch` — si falla, defaultea a `0` y loggea el error en lugar de romper la sesión. Tests: 17 en `tests/auth-protection.test.ts` cubriendo el matcher, anti-drift entre `PROTECTED_MATCHERS` y `config.matcher`, `authedFetch` pasa credentials por defecto y respeta override, preserva method/headers/body, los 8 consumers no tienen `fetch("/api/v1` directo, y `force-dynamic` está exportado en /mis-combinadas y /wallet. Smoke en navegador: GET `/mis-combinadas` sin sesión → redirige a `/auth/login?callbackUrl=%2Fmis-combinadas` (middleware), confirmando que la página ya NO depende del `auth()` interno + no se cachea entre sesiones distintas.

**Convención agregada — `authedFetch` único punto de entrada al backend.** Todos los hooks/components client-side que hagan `fetch("/api/v1/...")` (público o privado) deben usar `authedFetch` desde `apps/web/lib/api-client.ts`. Ventajas: una sola línea dicta la política de cookies (`credentials: 'include'`), los tests de regresión escanean el AST y revientan ante cualquier `fetch("/api/v1` directo, y queda un punto único para agregar futuro retry/backoff/auth-header sin tocar 8+ call sites. Si aparece un endpoint nuevo bajo `/api/v1/*`, su consumer client debe pasar por `authedFetch` — el test `convención: client-side fetches a /api/v1/* usan authedFetch` se actualiza agregando el archivo a `ARCHIVOS_VIGILADOS`.

**Smoke verificado en preview local** (Docker Compose con Postgres + Redis): el warning de Next.js sobre el spread en `middleware.config.matcher` desapareció (lista hardcodeada), `/` renderiza con sidebar (sin sesión: 1 torneo abierto Liverpool vs Arsenal, "no hay partidos en vivo ahora mismo" porque seed start con todos PROGRAMADOS), `/mis-combinadas` redirige correctamente a `/auth/login?callbackUrl=%2Fmis-combinadas` (middleware), `/live-match` con seed `UPDATE partidos SET estado='EN_VIVO'` muestra el partido aunque su torneo siga ABIERTO (Bug #2 verificado end-to-end), reverted seed antes de cerrar. **Tests: 110 passing + 2 skipped (los `describe.skipIf(hasDb)` cuando hay DB activa) en 11 archivos. TypeScript strict pasa en `tsc --noEmit`. ESLint sin warnings.**

### 🔧 Hotfix #3 19 Abr — ComboModal portal + /live-match tolera partidos sin torneo activo
Post-merge del Hotfix #2 el PO reportó dos problemas nuevos en prod (`habla-app-production.up.railway.app`). El primero afectaba el flow happy del MVP; el segundo lo detectamos al leer código y aparecía en partidos específicos del fixture en vivo.

**Bug #4 — "el modal aparece por momentos y la página se congela".** Usuario loggeado con 500 Lukas hacía click en "Crear combinada" del MatchCard y el overlay del modal aparecía DENTRO del `<article>` del card, superpuesto al contenido de la grilla en lugar de como overlay centrado sobre todo el viewport. Root cause confirmado leyendo el DOM: `components/combo/MatchCardCTA.tsx` montaba `<ComboModal />` como sibling del `<button>` dentro del fragment del MatchCard. El `<article>` del card aplica `transform: translate-y-px` en hover (shadow animation) y otros descendientes tienen `animate-scale-in` — cualquiera crea un nuevo containing block para `position: fixed`. Spec CSS: un descendant con `transform` establece un stacking context y ancla a sus descendientes fixed al ancestor en vez de al viewport (`https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/The_stacking_context`). El modal quedaba "trapped" dentro del card, con `inset: 0` referenciando las dimensiones del card (~150px) en lugar del viewport. Resultado visual: las PredCards del modal se pintaban superpuestas a otras cards, sin backdrop blur, sin centrado — el usuario percibía "flicker + congelamiento". Fix: `components/ui/Modal.tsx` ahora renderiza el overlay via `createPortal(overlay, document.body)`. El overlay queda como child directo del `<body>`, fuera de cualquier stacking context. Se agregó `useState(false)` + `useEffect(() => setMounted(true), [])` como guard contra SSR (React hydration mismatch si `document` no existe server-side), y `document.body.style.overflow = "hidden"` mientras el modal está abierto para bloquear scroll de fondo. Cambio: ~20 líneas netas en `Modal.tsx`. Sin esto, cualquier modal del proyecto (combinada, futuros canjes en tienda, confirmaciones) hereda el mismo bug. Tests: 6 estructurales en `tests/modal-portal.test.ts` (importa createPortal, usa `createPortal(overlay, document.body)`, mounted guard, body overflow lock, role dialog, stopPropagation) — son unit tests de AST porque vitest corre en environment `node` sin jsdom; no renderizan, pero documentan el contrato y revientan si alguien revierte el fix.

**Bug #5 — `/live-match` volvía a decir "no hay partidos" aunque la sidebar mostrara Manchester City vs Arsenal 0-0.** Leyendo `/api/v1/live/matches` en prod devolvía `torneos: []` para ese partido. Root cause confirmado: tras el Hotfix #2 el helper `obtenerLiveMatches` filtraba el `include.torneos.where` por `estado !== CANCELADO`, pero los 3 torneos de ese partido se habían cancelado el 18/04 por `<2 inscritos` al cierre (regla de §6 CLAUDE.md). Resultado: `partido.torneos` llegaba vacío, `elegirTorneoPrincipal([])` retornaba `null`, y la página filtraba ese partido con `partidosConTorneos = liveMatchesRaw.filter((p) => elegirTorneoPrincipal(p.torneos) !== null)` → empty state global. El usuario veía el empty state completo de `/live-match` aunque hubiera otros partidos EN_VIVO válidos (si los hubiera). Fix en 3 piezas: (1) `lib/services/live-matches.service.ts:obtenerLiveMatches` ahora INCLUYE TODOS los torneos en el `include.torneos` (incluso CANCELADO) — el caller decide qué hacer con ellos. `elegirTorneoPrincipal` sigue filtrando CANCELADO al elegir el principal, pero devuelve `null` si todos lo están. (2) `app/(main)/live-match/page.tsx` ya NO filtra partidos sin torneo principal; construye `tabs` con `torneoId: string | null` y prioriza los tabs con torneo activo al resolver el default (`tabs.findIndex(t => t.torneoId !== null)`). Acepta `?partidoId=<id>` en query param para deep-linking a un partido sin torneo. (3) `components/live/LiveMatchView.tsx`: `LiveMatchTab.torneoId` ahora es `string | null`, `LiveMatchTab.torneoEstado` incluye `null`. El componente usa `tabKey(tab)` (`torneoId ?? "partido:<id>"`) como identificador interno del switcher. Si `activeTorneoId === null`, el tab Ranking renderiza `<SinTorneoActivo />` (card con "🏟️ Este partido no tiene torneo activo — todos los torneos se cancelaron antes del cierre; el marcador y los eventos siguen en vivo"). El Hero + Stats + Events siguen funcionando porque `useEventosPartido(null, partidoId)` hace fetch del partidoId aunque no haya WS subscription. Tests: 1 unit nuevo en `live-matches.service.test.ts` (`HOTFIX #3 BUG REPRO: todos los torneos CANCELADO → retorna null`). Limpieza adicional: `ESTADOS_TORNEO_NO_CANCELADO` ya no se exporta (era usado solo por el helper interno).

**Smoke verificado en preview local**: `/` renderiza "Partidos de hoy" sin regresiones; tests 117 passing + 2 skipped (modal-portal + live-matches service agregaron +6 respecto al Hotfix #2); typecheck + lint verde. El bug del modal no se puede reproducir end-to-end sin sesión (magic link Resend requiere email real), por eso los 6 tests estructurales de `modal-portal.test.ts` son la barrera de regresión: si alguien quita el `createPortal`, el AST match reventa antes de merge.

### 🔧 Hotfix #4 19 Abr — 6 bugs post Hotfix #3 (ComboModal feedback, balance sync, /live-match refactor)
Post-merge del Hotfix #3 el PO reportó 6 bugs más en el flujo del MVP. 3 afectaban el happy path de la inscripción (#6 falta feedback, #7 balance desincronizado), 1 revertía una decisión del Hotfix #3 (#8), y 3 limpiaban UX de `/live-match` (#9 minuto "?", #10 switcher mezcla live + finalizados, #11 falta filtro por liga).

**Bug #6 — ComboModal sin feedback post-submit.** El modal cerraba sin confirmar al usuario y no tenía estados visibles para casuísticas secundarias (balance insuficiente con CTA a wallet, torneo cerrado, error de red, loading). Fix: nuevo tipo discriminado `ComboModalStatus = 'idle' | 'submitting' | 'success' | 'insufficient-balance' | 'tournament-closed' | 'error'` con helper puro `computeComboModalUIState(opts)` que deriva título + copy + icono + tono + CTAs por estado. El status `success` muestra un panel con detalles del ticket creado (id, predicciones como chips, entrada pagada, puntos máx, balance después) + CTAs "Ver mis combinadas" / "Crear otra" (reset del form). `statusFromBackendError` mapea códigos del backend (`BALANCE_INSUFICIENTE` → insufficient-balance, `TORNEO_CERRADO` → tournament-closed). El body/footer del modal cambia según el status; el helper `computeComboFooterState` del Hotfix #2 sigue cubriendo sólo la lógica de balance-display — son ejes independientes. Tests antidrift: `tests/combo-modal-statuses.test.ts` (25 casos) + AST-level sobre `ComboModal.tsx` (imports del helper, setStatus por rama, data-testids de cada CTA).

**Bug #7 — Balance global no se sincroniza tras inscripción.** El PO reportó 3 manifestaciones: (a) header seguía mostrando 500 tras descontar 5; (b) `/mis-combinadas` mostraba "Balance" en `-5` — era el `stats.neto` (lifetime P/L) con label engañoso; (c) segundo ComboModal calculaba "Balance después" desde valores viejos. Root cause: los consumers de UI leían de `session.user.balanceLukas` (SSR-only) en lugar del `useLukasStore`. El ComboModal ya llamaba `setBalance(nuevoBalance)` post-POST (Sub-Sprint 4) pero los consumers server-side no escuchaban. Fix en 3 piezas: (1) `components/layout/BalanceBadge.tsx` (nuevo, client) — lee del store, acepta `initialBalance` del SSR con pattern `mounted ? storeBalance : initialBalance` para evitar flicker pre-hydration, reemplaza el chip inline del NavBar. (2) `components/tickets/BalancePill.tsx` (nuevo, client) — mismo pattern, reemplaza el `StatsPill` de "Balance neto" por "Balance" con balance absoluto del store. (3) Convención nueva en §14: tras toda mutación de Lukas el endpoint devuelve `nuevoBalance` y el cliente llama `setBalance`; prohibido derivar balance client-side restando transacciones. Tests: `tests/balance-sync.test.ts` — 3 casos del store + 18 AST-level sobre BalanceBadge/BalancePill/NavBar/page/ComboModal.

**Bug #8 — Revert: `/live-match` NO debe tolerar partidos sin torneo activo.** El Hotfix #3 había decidido mostrar partidos EN_VIVO cuyos torneos estaban todos CANCELADO (regla: `<2 inscritos` al cierre → cancelar), renderizando el hero + eventos + stats con un cartel "🏟️ Este partido no tiene torneo activo". El PO revisó en uso real y la decisión quedó del lado opuesto — mostrar el partido sin poder competir confundía al usuario. Fix: `obtenerLiveMatches` vuelve a filtrar por `torneos.some(estado != CANCELADO)`, los partidos sin torneo navegable quedan fuera. El `include.torneos.where` excluye CANCELADO (el caller solo ve jugables). Se preserva la tolerancia del Hotfix #2 al jitter del cron (el filtro no chequea estados específicos del torneo). Side-effects: `LiveMatchTab.torneoId: string` no-nullable, componente `<SinTorneoActivo>` eliminado, `tabKey()` sintético retirado. Convención en §14 reemplazada — la anterior "/live-match tolera partidos sin torneo activo" se reescribió como "`/live-match` excluye partidos sin torneo jugable". Tests: `tests/live-matches.service.test.ts` — 1 nuevo caso "BUG #8 REPRO: partido EN_VIVO con todos los torneos CANCELADO NO aparece" + assertion de que `include.torneos` nunca devuelve CANCELADO al caller.

**Bug #9 — Minuto del partido muestra "?".** El LiveHero renderizaba `⏱ {minuto ?? "?"}'` y mostraba literalmente "?" cuando el poller no había entregado un número (primer render pre-WS, halftime con `status.elapsed=null`, prórroga sin elapsed). Fix en 4 piezas: (1) `lib/utils/minuto-label.ts:formatMinutoLabel({statusShort, elapsed})` — mapper puro que traduce todos los codes de api-football (HT→"ENT", FT→"FIN", ET→"Prór. {n}'", P→"Penales", AET→"FIN (prór.)", PEN→"FIN (pen.)", etc.); fallback "—" (nunca "?"). (2) `lib/services/live-partido-status.cache.ts` — Map in-memory con TTL 10 min, keyed por partidoId. El poller llama `setLiveStatus(partidoId, statusShort, elapsed)` en cada tick. (3) `RankingUpdatePayload` extendido con `minutoLabel: string | null` (aditivo, preserva `minutoPartido` numérico); `emitirRankingUpdate(torneoId, { partidoId })` lee del cache antes de emitir. (4) UI: `LiveHero.minutoLabel: string | null` (renombrada de `minuto: number | null`), usa `renderMinutoLabel()` para garantizar "—" en null; SSR precarga el label desde el cache por tab. Decisión de NO persistir en BD — cache in-memory es suficiente para MVP (primeros 30s post-restart muestran "—", aceptable). Tests: `tests/minuto-label.test.ts` (26 casos) + `tests/live-partido-status.cache.test.ts` (8 casos) + `tests/live-hero-minute.test.ts` (16 AST-level antidrift).

**Bug #10 — Switcher de `/live-match` mezclaba EN_VIVO + FINALIZADOS.** El PO pidió separarlos para claridad. Fix: el switcher (`LiveSwitcher`) ahora lista solo partidos EN_VIVO; los FINALIZADOS de las últimas 24h van en una sección aparte abajo (`LiveFinalizedSection`, nueva) con grid responsive de cards (2-3 cols desktop, 1 mobile). Cada card muestra score final + equipos con colores hash + liga + hora Lima + pozo + ganador y premio si ya se distribuyó, y linkea a `/live-match?torneoId=<id>` que rendera el hero post-partido. Nuevo helper `obtenerFinalizedMatches({sinceHours: 24, limit: 10})` en el service. La sección de finalizados NO se filtra por liga (Bug #11 aplica solo al switcher) por decisión del PO — extensible si aparece demanda. Tests incluidos en `tests/live-match-page.test.ts`.

**Bug #11 — Filter chips por liga en `/live-match`.** En días pesados (Mundial, fecha doble) el switcher llegaba a 6+ tabs. Fix: fila de filter chips arriba del switcher con lista dinámica (solo ligas con ≥1 partido EN_VIVO actual). `hooks/useLigaFilter.ts` (nuevo) maneja `?liga=<slug>` con el mismo pattern URL que `/matches`. `components/live/LiveLeagueFilter.tsx` (nuevo) usa el primitivo `Chip` del design system. `lib/config/liga-slugs.ts` agrega `ligaToSlug()` inverso de `slugToLiga` para mapear `partido.liga` → slug. El filter solo afecta al switcher; si el `?torneoId=` activo queda fuera del filtro, la page auto-selecciona el primer torneo visible. El empty state del switcher cambia de copy según `filtroActivo` (invita a quitar el filtro si aplica). Hook separado de `useMatchesFilters` (que incluye eje `dia`) — coexisten hasta que aparezca un caso fuerte de consolidación. Tests: 36 casos en `tests/live-match-page.test.ts` cubriendo ligaToSlug, wiring de page, LiveLeagueFilter, useLigaFilter, LiveFinalizedSection y el service.

**Smoke esperado en preview local:** 267 tests passing + 7 skipped (Prisma integration) en 19 archivos; typecheck sin errores. El flow completo (login magic-link → inscripción → balance sync → ver partido en vivo con minuto label correcto + switcher solo live + finalizados abajo + liga filter chips) requiere cuenta real con Resend para verificar end-to-end; los tests AST-level son la barrera antidrift hasta el smoke de Sub-Sprint 8.

### 🔧 Hotfix #5 19 Abr — 5 fixes post Hotfix #4 (live badge, torneo detail redesign, balance sync, matches title, live finalizados detail)
Smoke testing post Hotfix #4 dejó 5 reportes del PO. 1 bug visual chico del header (#12 badge "En vivo" con "2" hardcodeado), 1 rediseño grande de `/torneo/:id` (#13), 1 manifestación extra de desincronización de balance en dos widgets que el Hotfix #4 no había tocado (#14), 1 copy hardcoded del h1 de `/matches` (#15), y 1 enriquecimiento de la sección de finalizados de `/live-match` (#16). Los dos grandes (Bugs #13 y #16) redefinen páginas completas, el resto son cambios acotados pero importantes por UX.

**Bug #12 — Badge "🔴 En vivo" renderiza null cuando no hay partidos.** El NavBar mostraba `LIVE_COUNT_PLACEHOLDER = 2` desde el Sub-Sprint 0, un valor hardcoded que quedó vigente hasta este hotfix. Aunque no hubiera partidos EN_VIVO reales, el usuario veía un globo rojo con "2". Fix en 5 piezas: (1) `live-matches.service.ts:contarLiveMatches()` (nuevo) — query barata `prisma.partido.count` con el mismo filtro que `obtenerLiveMatches` (EN_VIVO + `torneos.some(estado != CANCELADO)`, preservando la regla del Bug #8). (2) `GET /api/v1/live/count` endpoint público que devuelve `{ count }` solamente — sin JOIN al ranking ni al pozo. (3) `hooks/useLiveMatchesCount.ts` consume el endpoint cada 30s con `authedFetch` (§14) + hidrata con `initialCount` del SSR para evitar flicker. (4) `components/layout/LiveCountBadge.tsx` (nuevo, client, 2 variants `desktop|mobile`) — regla dura: `if (count <= 0) return null`. Nunca rendera un dot ni el número "0" ni un círculo gris. Overlap "9+" para counts altos. (5) `(main)/layout.tsx` llama `contarLiveMatches()` una sola vez y pasa `initialLiveCount` como prop tanto al `NavBar` (desktop) como al `BottomNav` (mobile, nuevo — antes solo tenía el emoji sin badge). El `NavLinks` y el `BottomNav` consumen el `LiveCountBadge` como hijo condicional. Tests: 17 AST en `tests/live-count-badge.test.ts` cubriendo el hook, endpoint, variants, regla `count <= 0`, wiring del layout → navs, y la absencia del `LIVE_COUNT_PLACEHOLDER` literal en código activo.

**Bug #13 — Rediseño de `/torneo/:id` como pantalla motivacional.** La versión vieja era mínima (breadcrumb + hero azul con status + 3 BigStats con "Pozo bruto", "Rake (12%)", "Pozo neto estimado" + reglas + CTA). El PO pidió convertirla en la pantalla que motive al usuario a inscribirse: ver quiénes ya están compitiendo y el pozo armado, sin exponer términos de casino. Fix extensivo:

- **Pozo con label único "Pozo":** el hero muestra UN solo número grande — el pozo neto real (o `pozoBruto × 0.88` fallback si sigue ABIERTO y el neto aún es 0). PROHIBIDO exponer "Pozo neto", "Pozo bruto", "Rake" en copy visible al jugador. La distribución se presenta en Lukas absolutos por posición (35/20/12% al top 3 + 33% dividido en 7 para 4°-10°), sin mostrar porcentajes.
- **Back button prominente** (`components/torneos/BackButton.tsx`, client) con `router.back()` + fallback `/matches` — intenta volver al contexto exacto si hay historial.
- **Match header con colores de equipo** — reusa `getTeamColor` + `getTeamInitials` para los avatares hash-color, muestra liga + round + venue + kickoff en hora Lima vía `formatKickoff`, status badge por estado del torneo.
- **Stats pills motivacionales** (4 pills): jugadores inscritos, tickets enviados, estado (cierre/en vivo/finalizado), 1er premio dorado.
- **Lista de inscritos** (`components/torneos/InscritosList.tsx`, server) con @handle + nivel 🥉/🥈/🥇/👑 (calculado con `lib/utils/nivel.ts:calcularNivel` sobre el total de torneos jugados por el usuario) + cantidad de tickets. **Privacidad competitiva:** antes del cierre del torneo, el service `listarInscritos` oculta las predicciones (predicciones: null) para evitar copia; post-cierre muestra las 5 chips + puntos. Paginación 20 por página con botón "Ver todos".
- **CTA estelar** (`components/torneos/TorneoStickyCTA.tsx`, client) — sticky al bottom del viewport en mobile (arriba del BottomNav), inline en desktop (también dentro del contenido principal). Delega a `ComboLauncher` (hook `useComboOpener`) — convención §14 "todos los launchers comparten el mismo hook". Cambia por estado: ABIERTO + no inscrito → "🎯 Crear combinada"; ABIERTO + placeholder → "Editar mi combinada"; ABIERTO + >0 tickets → "+ Otra combinada"; ABIERTO + 10 tickets → disabled "Máximo alcanzado"; <15 min al cierre → variant `urgent` con "🔥"; CERRADO/EN_JUEGO → link `Ver ranking en vivo →` a `/live-match?torneoId=`; FINALIZADO → link `Ver resultado final →`; CANCELADO → card informativa con mensaje de reembolso.
- **Sidebar sticky en desktop con reglas de puntaje** (card compacta con las 5 predicciones + puntos) — en mobile se muestra arriba del inscritos como accordion-in-card.

Backend: `torneos.service.ts:listarInscritos(torneoId, { page, limit })` nuevo que agrupa tickets por usuarioId, cuenta torneos jugados por usuario (query extra para el cálculo de nivel), y oculta predicciones si el torneo está ABIERTO. Helper puro `lib/utils/torneo-detail-view.ts:buildTorneoDetailViewModel(input)` deriva `pozoMostrado`, `premios`, `estadoResuelto` (con tolerancia al jitter del cron), `mostrarPredicciones` y `cta` — testeado sin jsdom con matriz de 9 casos. Helper `lib/utils/nivel.ts` expone `calcularNivel(torneosJugados)`, `siguienteNivel(actual)`, `faltanParaSiguiente(n)` — 15 tests de bordes (0/10/11/50/51/200/201 + fallbacks).

Tests: 40 en `tests/torneo-detail-view.test.ts` (view-model + AST page/CTA/inscritos/back) + 15 en `tests/nivel.test.ts` = 55 casos nuevos. AST revisa que la copy NO incluya "Pozo bruto"/"Pozo neto"/"Rake" como strings literales, que el CTA delegue al `ComboLauncher` (sin fetch duplicado), que `listarInscritos` oculte predicciones cuando ABIERTO.

**Bug #14 — Balance sync extendido a sidebar widget + wallet hero.** El Hotfix #4 migró `BalanceBadge` (header) y `BalancePill` (/mis-combinadas) al store con patrón `mounted ? storeBalance : initialBalance`. Post-hotfix el PO detectó dos consumers más que aún leían SSR-only y quedaban stale tras inscripción:

- **(a)** ComboModal "Balance después" — verificado que ya consume `useLukasStore((s) => s.balance)` con `[balance, torneo]` en las deps del `useMemo`. Agregado test específico: `balance=495` del store + `costo=5` → `displayBalanceDespues=490` (no 495). Preservamos la lógica de `computeComboFooterState` sin cambios funcionales.
- **(b)** Widget "🪙 Tu balance" del sidebar de `/matches` — antes `MatchesSidebar` era Server Component con `LoggedBalance` inline leyendo `session.user.balanceLukas`. Tras inscripción el store se actualizaba pero el widget seguía mostrando el valor SSR. Fix: `components/matches/SidebarBalanceWidget.tsx` (nuevo, client) replica el patrón de `BalanceBadge`/`BalancePill`; `MatchesSidebar` pasa `initialBalance={session?.user?.balanceLukas ?? null}` y deja de renderizar el balance inline.
- **(c)** Hero de `/wallet` con el monto gigante de 64px — mismo problema. Fix: `components/wallet/WalletBalanceHero.tsx` (nuevo, client) con mounted-guard. La page de /wallet sigue siendo server (lee `session.user.balanceLukas` como `initialBalance`), pero el hero se suscribe al store.

Convención nueva en §14: **todo componente UI que muestre balance de Lukas debe leer de `useLukasStore` con el pattern mounted-guard**, nunca `session.user.balanceLukas` directo en Client Components. Test de regresión estructural en `tests/balance-sync.hotfix5.test.ts` que escanea `components/**` + `app/**` y reventa si aparece un `session(?).user(?).balanceLukas` fuera de una whitelist de 4 archivos (layout + 3 páginas RSC que legítimamente leen para pasar como prop). Los 4 archivos se validan también por el lado positivo (sanity: sí deben contener la referencia). Comentarios `//` se stripean antes de escanear para no caer en documentación histórica del bug.

Tests: 28 casos nuevos (3 del store + 4 de mapper del footer + 10 AST de `SidebarBalanceWidget`/`WalletBalanceHero`/wallet/page + 11 de regresión estructural).

**Bug #15 — Título h1 de `/matches` deriva de filtros.** Antes el h1 decía literal "Partidos de hoy" aunque el usuario estuviera filtrando por "Champions · Mañana". Fix con helper puro `lib/utils/matches-page-title.ts:buildMatchesPageTitle({liga, dia, now, tz})` que devuelve:
- Sin filtros: "Todos los torneos"
- Solo liga: "Torneos de Liga 1 Perú" (nombre canónico del `LIGA_SLUGS`)
- Solo día (hoy/mañana): "Torneos de hoy" / "Torneos de mañana"
- Solo día (otro): "Torneos del Mié 22" (mismo mes) / "Torneos del Vie 1 may" (otro mes) — reusa `formatDayChip`
- Liga + día: "Torneos de Champions League · Mañana" / "Torneos de Premier League · Mié 22"

`MatchesPageContent` llama `buildMatchesPageTitle({ liga: ligaSlug ?? null, dia: dia ?? null })` y rendera el resultado como `{pageTitle}`. Fallback defensivo: slugs desconocidos caen a "Todos los torneos" en vez de reventar. Tests: 16 casos en `tests/matches-page-title.test.ts` cubriendo matriz de filtros × días, invalid slug, invalid dayKey; más AST sobre MatchesPageContent que verifica que el h1 referencia `{pageTitle}` y no el literal viejo.

**Bug #16 — Sección de finalizados en `/live-match` + banda motivacional post-partido.** El Hotfix #4 ya separó live (switcher) de finalizados (sección). El Hotfix #5 enriquece:
- **Cards de finalizados con 5 mini-chips del ganador:** `FinalizedMatchCard.ganador` ahora incluye `{ nombre, puntos, premioLukas, chips: Array<{label, estado}> }`. Las chips se derivan en el server con `components/live/finalized-winner-chips.ts:buildFinalizedWinnerChips(row, equipoLocal, equipoVisita)` — helper puro que mapea `RankingRow` (predicciones + puntosDetalle) a los 5 chips con `correct`/`wrong` (sin pending, porque el torneo está finalizado). La UI rendera cada card con hero score + nombre del ganador + mini-chips usando tokens `pred-correct-bg`/`pred-wrong-bg`. Fallback si no hay ganador: "Sin ganadores registrados".
- **Banda motivacional "🎯 El próximo torneo te espera":** `components/live/LiveFinalizedBanner.tsx` (nuevo) se rendera al final de `LiveMatchView` cuando `active.estado === "FINALIZADO"`. Props: `proximoTorneoId: string | null` del servidor (busca el torneo ABIERTO más cercano a cerrar via `listarTorneos({estado:"ABIERTO", limit:1})`). Si hay, linkea a `/torneo/:id` con CTA "Ir al próximo torneo →"; si no, cae a `/matches` con "Ver torneos abiertos →". El banner NO aparece para tabs en vivo (no competir con el ranking live).
- **Empty state "no EN_VIVO + hay finalizados":** ya existía como `EmptyLiveWithFinalized` — ahora recibe `proximoTorneoId` y lo propaga. El usuario que llega a /live-match sin partidos en vivo ve inmediatamente la sección motivacional de finalizados como contenido principal.

Tests: 25 casos en `tests/live-finalized-detail.test.ts` cubriendo `buildFinalizedWinnerChips` (7 casos: todos correctos/fallados, nombre corto, 1X2 local/empate/visita, etc.), AST de `LiveFinalizedSection` (nuevo shape de `ganador` + chips con tokens), AST de `LiveFinalizedBanner` (props + copy + tokens), AST de `LiveMatchView` (banner condicional por estado), AST de `/live-match/page.tsx` (listarRanking + buildFinalizedWinnerChips + proximoTorneoId pipeline).

**Smoke esperado:** `pnpm test` 391 passing + 7 skipped (integration Prisma) en 24 archivos; `pnpm exec tsc --noEmit` limpio; `pnpm lint` sin warnings. Preview verificado con tests AST-level como barrera antidrift — el flow end-to-end requiere Docker Compose + seed + cuenta real con Resend, se deja para Sub-Sprint 8 QA.

### 🔧 Hotfix #6 19 Abr — Nueva distribución de premios + 4 fixes de /live-match
Smoke testing post Hotfix #5 dejó un pedido de cambio de reglas de negocio (distribución de premios) + 4 fixes de `/live-match` identificados por el PO. Trabajo dividido en 5 ítems independientes pero liberados en un mismo PR.

**Ítem 1 — Nueva distribución de premios (reemplaza 35/20/12/33%).** La curva vieja premiaba a los top 10 de cualquier torneo con la misma estructura. Con torneos chicos (ej. 12 inscritos) regalaba premios simbólicos a los 4°-10° mientras que el 1° y 2° se llevaban poco proporcionalmente. Nueva regla:

- **Paga el 10% de inscritos** (redondeado al entero más cercano), con cortes especiales para torneos chicos: N 2-9 → 1, 10-19 → 2, 20-29 → 3, 30-49 → 5, 50-99 → 10, 100+ → `round(N*0.10)`.
- **Curva top-heavy:** el 1° se lleva exactamente **45%** del pozo neto. El 55% restante se reparte con decaimiento geométrico (`r = 1 - 2.8/M`). Para M≤5 usamos tablas fijas: [1.0], [0.65, 0.35], [0.5, 0.3, 0.2], [0.4, 0.25, 0.18, 0.10, 0.07].
- **Empates (regla única, sin más desempates):** tickets empatados en puntaje reparten equitativamente la suma de los premios de las posiciones que ocupan como grupo. Si el grupo se extiende más allá de M (ej. 1 puntero + 15 empatados en 2° con M=10), todos cobran — reparten `sum(shares[2..M])/15`. La regla previa de desempate "marcador exacto → tarjeta roja → orden inscripción" quedó **eliminada por completo**.
- **Redondeo:** `Math.floor` sobre cada share; el residual por redondeo se suma al 1° lugar para que `sum(premios) === pozoNeto` exacto. Decisión conservadora para la plataforma (usuarios reciben centésimas menos), documentada.

**Archivos nuevos:** `lib/utils/premios-distribucion.ts` (helper puro con `calcularPagados`, `calcularShares`, `distribuirPremios`, `premioEstimadoSinEmpate`), `components/matches/PrizeRulesCard.tsx` (widget "🏆 Cómo se pagan los premios" agregado al sidebar de `/matches` entre "Top del día" y "Tu balance"), `lib/utils/premio-motivacional.ts` (helper puro `buildMotivationalCopy` que deriva copy + emoji + tono para la fila del usuario en el ranking en vivo).

**Archivos modificados:** `ranking.service.ts` (usa `distribuirPremios` en `listarRanking` + `finalizarTorneo`; elimina `compararParaDesempate` con secondary sort; solo ordena por `puntosTotal DESC, creadoEn ASC` cosmético; expone `pagados` en el resultado), `torneos.service.ts` (renombra `DISTRIB_PREMIOS` a `DISTRIB_PREMIOS_DESCRIPTOR` — descriptor serializable para audit del JSON field `Torneo.distribPremios`; la computación real vive en el helper), `components/live/RankingTable.tsx` (pasa `pagados` + renderea copy motivacional en fila propia del usuario con 4 estados: único ganador / empate / cerca / lejos), `components/tickets/MatchGroup.tsx` + `LiveMatchView.tsx` (migran a `premioEstimadoSinEmpate`), `lib/utils/torneo-detail-view.ts` (el view-model de `/torneo/:id` ahora devuelve un array `Array<{posicion, lukas}>` de tamaño M en lugar de los 4 buckets fijos), `app/(main)/torneo/[id]/page.tsx` (renderiza top 10 posiciones con sus shares específicos y texto "Pagan los primeros M puestos"), `components/combo/premios.ts` (reemplaza `DISTRIB_PREMIOS_FE` por `PREMIO_PRIMER_LUGAR_PCT = 0.45` para el estimado del header del ComboModal), `hooks/useRankingEnVivo.ts` + `lib/realtime/events.ts` + `lib/realtime/emitters.ts` (añaden `pagados` al payload `ranking:update`).

**Ítem 2 — Eventos anulados se borran de la timeline.** El poller hacía solo `INSERT` idempotente de eventos; cuando un gol se anulaba por VAR o una roja se revocaba, el evento quedaba huérfano en BD y la timeline del `/live-match` lo seguía mostrando. Fix: el poller ahora hace **DELETE + INSERT** — sincroniza el set de eventos de BD con lo que reporta el API. Si API y BD discrepan, gana API (siempre que el fetch fue exitoso; si falla, no se toca BD). Side-effects: se emite nuevo evento WS `partido:evento-invalidado { torneoId, partidoId, naturalKey }` que el hook `useEventosPartido` consume para remover la fila sin esperar refresh. El evento sintético `FIN_PARTIDO` se preserva en el sync (lo creamos localmente, no viene del API). El flag `huboTarjetaRoja` también revierte a `false` si el API ya no reporta roja (protege al motor de puntuación de sumar 6 pts de más post-revocación).

**Ítem 3 — Minuto del partido ya no cae a "—" durante HT largos.** El cache in-memory `live-partido-status` tenía TTL 10 min — si pasaba un HT con ceremonia + otro tiempo sin eventos, el snapshot caducaba y el LiveHero mostraba "—". Fix en 3 piezas: (1) TTL extendido a 30 min (cubre HT + prórroga). (2) Endpoint `GET /api/v1/torneos/:id/ranking` ahora devuelve `minutoLabel` + `minutoPartido` leídos del cache. (3) Hook `useRankingEnVivo` agrega polling de fallback cada 45s — si el WS se silencia (proxy cierra, reconexión larga), el REST mantiene el LiveHero fresco. `applySnapshot` preserva el `minutoLabel` previo si el REST devuelve `null` (no borra un label que ya teníamos por respuesta tardía del cache).

**Ítem 4 — Motor de puntuación proyecta todos los campos en vivo.** Bug reportado: partido 0-0 minuto 3, ticket con "Empate / No / No / No / 0-0" mostraba 3 pts cuando debían ser 21. Root cause: la semántica del Sub-Sprint 5 dejaba marcador exacto en 0 durante EN_VIVO, y tarjeta roja "No" quedaba pendiente cuando `huboTarjetaRoja === null`. Fix: TODOS los campos proyectan en vivo como "si terminara ahora". BTTS/+2.5 adjudican desde el minuto 1 como proyección; marcador exacto también; tarjeta roja "No" recibe los 6 pts mientras `huboTarjetaRoja !== true`. La volatilidad es esperada — el ranking refleja la pregunta "¿quién gana si terminara ahora?" y el copy motivacional del Ítem 1 lo comunica al usuario. Reversal explícito del Sub-Sprint 5: antes la decisión era "marcador sólo al FT porque sus 8 pts son volátiles"; el PO prefirió la claridad cognitiva de ver TODO proyectado sobre el riesgo de volatilidad.

**Ítem 5 — Countdown de MatchCard actualiza en vivo.** `formatCountdown` se rendereaba server-side y quedaba pegado al valor del SSR hasta refresh manual. Fix: `components/matches/CountdownLabel.tsx` (client, nuevo) envuelve el texto y usa `useEffect + setInterval(1s)` para re-renderizar cada segundo. El color del chip (urgencia crit/high/med/low) se mantiene server-side por simplicidad — si el usuario cruza un umbral, el color no se actualiza hasta el próximo refresh (aceptable para MVP; el bug del PO era solo el label). Decisión de performance: un interval por instancia (opción b del brief). Si el test de carga del Sprint 8 muestra problemas con 20+ cards, migrar a store Zustand compartido.

**Convenciones agregadas a §14:** (a) "Distribución de premios se calcula siempre vía `distribuirPremios` — prohibido hardcodear porcentajes"; (b) "Motor de puntuación proyecta todos los campos en vivo incluyendo marcador exacto (reversal Sub-Sprint 5)"; (c) "Poller sincroniza eventos (delete+insert) — nunca solo insert".

**Smoke esperado en preview local:** tests nuevos cubren la nueva distribución (8 casos en `premios-distribucion.test.ts`: cortes M, shares float, residual, 3-way tie, tail overflow, entry < share, 200 inscritos), motor proyectivo (3 casos nuevos en `puntuacion.service.test.ts` incluyendo regresión 21-pts-con-0-0), sincronización del poller (9 casos AST en `poller-sync-eventos.test.ts`), fallback REST del minuto (8 casos en `live-minuto-fallback.test.ts`), countdown label (7 casos en `countdown-label.test.ts`), copy motivacional (10 casos en `premio-motivacional.test.ts`). Los tests viejos que asumían la distribución 35/20/12 fueron actualizados (ranking.desempate.test.ts rediseñado; torneo-detail-view.test.ts actualizado; combo-info.mapper.test.ts con nuevos valores 45% en lugar de 35%).

### 🔧 Hotfix #7 19 Abr — finalizarTorneo acredita saldos + reconciliación + fixes de cache
Smoke testing post-deploy del Hotfix #6 (en producción) dejó 5 reportes críticos del PO que apuntan a un bug de MVP que se arrastraba desde el Sub-Sprint 5 + algunos fixes cortos que terminaron de redondear la experiencia post-partido.

**Bug #17 — Widget "🔴 En vivo ahora" de /matches y /live-match se queda congelado con datos viejos.** El PO reportó que tras el fin de un partido en vivo, el widget del sidebar y la pestaña "En vivo" seguían mostrando el partido terminado como live, y no aparecía el nuevo partido de la misma liga que acababa de entrar en vivo (con combinadas válidas). Root cause: las rutas `/` (landing) y `/matches` NO tenían `export const dynamic = "force-dynamic"`. Next.js cacheaba el RSC entre requests. `/live-match` sí lo tenía (desde el Sub-Sprint 5) por eso la página de live se refrescaba, pero la inconsistencia entre vistas confundía. Fix: agregar `force-dynamic` a `/matches/page.tsx` y `/page.tsx`. Razón: mismo patrón que el Bug #3 del Hotfix #2 aplicó a `/mis-combinadas` y `/wallet` — toda página que dependa de estado en vivo (lista de torneos ABIERTOS, partidos EN_VIVO del widget) debe re-renderizarse en cada request, no cachearse.

**Bug #18 — `finalizarTorneo` NO acreditaba los Lukas a los ganadores.** Bug crítico que se arrastraba desde el Sub-Sprint 5: la función solo seteaba `Ticket.posicionFinal` + `Ticket.premioLukas` pero NUNCA incrementaba `Usuario.balanceLukas` ni creaba una `TransaccionLukas` con tipo `PREMIO_TORNEO`. La doc del Sub-Sprint 5 decía "la distribución real de Lukas y emails queda para Sub-Sprint 6", pero el MVP lo necesita ahora porque los torneos ya están finalizando en producción y el ganador nunca veía sus premios en el wallet. Fix: dentro de `prisma.$transaction`, para cada ticket con `premioLukas > 0` se ejecuta (a) `Usuario.balanceLukas += premioLukas`, (b) `TransaccionLukas { tipo: PREMIO_TORNEO, monto: premioLukas, refId: torneoId, descripcion: "Premio Nº puesto" }`, (c) `Ticket.premioLukas` + `Ticket.posicionFinal`. Todo atómico — si falla algún paso, NI los premios se acreditan NI el torneo se marca como FINALIZADO, la próxima corrida del poller reintenta. Los Lukas ganados NO vencen (§6), por eso no se setea `venceEn`.

**Bug #19 — `finalizarTorneo` NO recalculaba puntos antes de distribuir.** Si el último `recalcularTorneo` del poller ocurrió ANTES de que el snapshot del partido fuera completamente FINALIZADO (caso típico: el poller recalcula con estado=EN_VIVO + últimos goles, luego el mismo tick detecta FT y llama `finalizarTorneo`), los puntos en los tickets pueden estar "stale" respecto al estado final (ej. `btts=null` durante EN_VIVO que se resuelve solo cuando `partido.btts` se persiste al FT). Fix: `finalizarTorneo` ahora llama `await recalcularTorneo(torneoId)` como PRIMERA acción, antes de `distribuirPremios`. Garantiza que los puntos usados para distribuir son los del snapshot final vigente. Es un no-op si el poller ya recalculó (función pura, mismos inputs → mismos outputs). Protege también cuando `finalizarTorneo` se llama desde un admin endpoint o reintento manual.

**Bug #20 — Endpoint admin `POST /api/v1/admin/torneos/:id/reconciliar` para reparar torneos finalizados antes del Hotfix #7.** El partido Alianza Atlético vs Sport Boys (reportado explícitamente por el PO) ya había finalizado sin crédito a los ganadores porque finalizó antes del deploy del Hotfix #7 Bug #18. Fix: nueva función `reconciliarTorneoFinalizado(torneoId)` + endpoint ADMIN que la expone. Procedimiento: (1) valida torneo.estado === FINALIZADO; (2) recalcula puntos con motor actual (Hotfix #6 proyectivo); (3) recomputa distribución con curva top-heavy; (4) lee todas las `TransaccionLukas` PREMIO_TORNEO existentes para el torneo y suma por usuario; (5) por cada ticket, `delta = expected - yaAcreditado`; si delta > 0, acredita el delta + crea transacción de ajuste con descripción "Ajuste premio Nº puesto"; (6) actualiza `Ticket.posicionFinal` + `Ticket.premioLukas`. Idempotente: correrlo dos veces seguidas sólo ajusta deltas > 0. La segunda corrida tiene `yaAcreditado === expected` → no-op. El endpoint es ADMIN-only y sirve como herramienta manual hasta que el MVP agote los torneos pre-Hotfix #7. Alternativa descartada: migración masiva al deploy — arriesgaba tocar torneos en estado transitorio (EN_JUEGO al momento de la migración). El endpoint por-torneo permite revisar case-by-case.

**Bug #21 — Copy del widget "🏆 Cómo se pagan los premios" simplificado.** El PO revisó el texto en el sidebar de `/matches` y consideró que la frase "se reparten los premios de las posiciones que ocupan" enredaba la explicación. Fix: reemplazado por "En caso de empate, el premio se reparte en partes iguales entre los jugadores empatados." Copy más simple sin terminología técnica. El helper `distribuirPremios` sigue aplicando la regla completa (suma de shares del grupo empatado, dividido entre miembros) — lo que cambió es la comunicación al jugador.

**Tests nuevos (18 casos AST en `finalizar-torneo-credito.test.ts`):**
- finalizarTorneo crea TransaccionLukas PREMIO_TORNEO con monto correcto.
- finalizarTorneo incrementa balanceLukas del ganador.
- Todo el flujo de credit + update + torneo FINALIZADO en prisma.$transaction.
- finalizarTorneo importa + llama recalcularTorneo ANTES de distribuirPremios.
- Idempotencia: early-return con `alreadyFinalized: true` si ya estaba FINALIZADO.
- `reconciliarTorneoFinalizado` exportada + rechaza torneos NO-FINALIZADOS.
- Lee TransaccionLukas previas filtradas por tipo + refId para no doble-acreditar.
- Solo acredita cuando delta > 0.
- Route handler admin delega al service + exige rol ADMIN.
- `/matches` y `/` exportan `force-dynamic`.
- `PrizeRulesCard` sin "las posiciones que ocupan" + con "partes iguales".

**Smoke esperado:** `pnpm test` 481 passing + 7 skipped (Prisma integration) en 30 archivos; `pnpm exec tsc --noEmit` limpio; `pnpm lint` sin warnings. El smoke end-to-end del credit (comprar Lukas → inscribirse → jugar → ganar → ver balance actualizado) requiere Docker Compose + seed + poller real, se deja para Sub-Sprint 8 QA. Para corregir el torneo reportado (Alianza Atlético vs Sport Boys), el admin debe hacer: `POST /api/v1/admin/torneos/<id>/reconciliar` con sesión ADMIN — el endpoint recalcula puntos, re-distribuye premios con la nueva regla, acredita los Lukas a los ganadores y deja logs estructurados en Pino.

### 🔧 Hotfix #8 19 Abr — Reloj local del minuto en vivo + auto-reconciliación de premios no acreditados
Smoke testing en prod (`habla-app-production.up.railway.app`) post-deploy del Hotfix #7 dejó 2 reportes críticos del PO. El primero (#22) era un defecto de UX del `/live-match` arrastrado desde Sub-Sprint 5 — el minuto del partido no avanzaba en tiempo real. El segundo (#23) era una regresión silenciosa del credit flow del Hotfix #7 — 2 torneos FINALIZADOS quedaron sin que sus ganadores recibieran el premio en `balanceLukas` aunque `Ticket.premioLukas` estaba correcto.

**Bug #22 — `⏱ —` congelado o pegado al último valor del poller en `/live-match`.** El PO reportó: partido Cienciano vs UCV Moquegua en vivo, ~10 minutos jugados, el hero mostraba `⏱ —` al entrar a la página y no cambiaba, a pesar de que el evento "34' Y. Zapata" se veía en la timeline (o sea, el poller SÍ estaba trayendo datos). Root cause: el poller escribe al cache in-memory cada 30s, y el `LiveHero` renderizaba `minutoLabel` server-rendered que se refrescaba solo cuando llegaba un WS o el polling REST de 45s. Entre ticks, el minuto quedaba pegado. Peor: si el proceso de Railway había reiniciado hace poco y el cache estaba vacío antes del primer tick del poller, el `minutoLabel` era `null` → `renderMinutoLabel` devolvía `"—"` por hasta 30s.

Hice un primer intento (versión original del Hotfix #8) con `snapshotUpdatedAt` como ancla del reloj local. El PO revisó y pidió simplificar: *"No hay información del API que podamos tomar como el inicio del partido y desde ahí hacer que el timer siga sin parar hasta que el mismo API informe que ya se cerró el primer tiempo...? Siento que quizás estamos complejizando esto"*. Tenía razón — `Partido.fechaInicio` ya está persistido en BD desde el import del fixture, es estable, y no depende del cache in-memory. Rehice el fix con esta ancla.

**Fix refactorizado en 6 piezas:**

- **Pieza 1 — Hook `useMinutoEnVivo` anclado a `fechaInicio`.** Nuevo archivo `apps/web/hooks/useMinutoEnVivo.ts` con la función pura `computeMinutoLabel(input)` + el hook. Recibe `{ fechaInicio, statusShort, elapsed }`. Lógica por fase:
  - **1H** → ancla a `fechaInicio`. Minuto = `max(1, min(45, floor((now - fechaInicio)/60000) + 1))`. Si el server reporta `elapsed`, toma el `max(elapsed, mFromKickoff)` — así soporta partidos que arrancan tarde (la heurística puede sub-contar y el server corrige). Si el server reporta `elapsed > 45` (descuento largo del PT), respeta el server sin clampear.
  - **2H / ET** → el descanso del HT es variable (10-25 min), no podemos derivar del kickoff. Acá el `elapsed` del server es el ancla; el hook tracker un `useRef<number>` (`elapsedAnchorAt`) que se actualiza cuando cambia `elapsed` o `statusShort`, y proyecta `elapsed + floor((now - elapsedAnchorAt)/60000)` con cap 90/120. Si el server reporta `elapsed` ya sobre el cap, respeta server.
  - **HT / FT / AET / PEN / NS / SUSP / ABD / CANC / AWD / WO / PST / INT / BT / TBD / P** → delega al mapper `formatMinutoLabel` sin correr interval (estado fijo, sin gasto de CPU).
  - **Sin statusShort (cache vacío)** → heurística basada solo en `fechaInicio`: `<0 min → "Por empezar"`, `0-45 → "{n}'"`, `45-60 → "ENT"`, `60-105 → "{n-15}'"` (asumiendo HT estándar de 15 min), `>105 → "—"`. Es un estimado que se corrige en cuanto llegue el primer tick del poller (≤30s post-boot).
- **Pieza 2 — `fechaInicio` agregado al `LiveMatchTab`.** El SSR de `/live-match` lo serializa como ISO string desde `Partido.fechaInicio` (ya disponible en `PartidoLive`). Está en el payload desde el primer render — no depende del cache.
- **Pieza 3 — `RankingUpdatePayload` y endpoints extendidos solo con `statusShort`.** Descartamos el `snapshotUpdatedAt` del intento inicial — ya no lo necesitamos. El WS trae `statusShort` para que el hook sepa la fase activa; `elapsed` ya estaba en el payload (como `minutoPartido`). El endpoint `GET /api/v1/live/matches` incluye `fechaInicio: p.fechaInicio.toISOString()` para que el sidebar widget (cuando lo migremos al hook) también tenga ancla propia.
- **Pieza 4 — `emitirRankingUpdate` lee `statusShort` del cache** (solo ese campo — `updatedAt` ya no se expone al cliente).
- **Pieza 5 — `useRankingEnVivo` expone `statusShort`.** Preserva null entre polls REST (mismo pattern de `minutoLabel` del Hotfix #6 Ítem 3); el WS pisa crudos siempre.
- **Pieza 6 — `LiveHero` es client component** (`"use client"`). Recibe `{ fechaInicio, statusShort, elapsed }` y delega al hook. `LiveMatchView` propaga `fechaInicio={active.fechaInicio}` (estable, no cambia durante el partido), `statusShort={live.statusShort ?? active.statusShort}`, `elapsed={live.minutoPartido ?? active.elapsed}`.

**Ventajas del refactor vs. el primer intento:**
- **Cache vacío post-restart ya no muestra "—":** el hook proyecta desde `fechaInicio` (persistido en BD) usando la heurística; el usuario ve un minuto razonable hasta que llegue el primer tick del poller.
- **Menos campos en el payload del WS:** `snapshotUpdatedAt` descartado; solo `statusShort` agregado (aditivo).
- **Robusto a clock skew:** `fechaInicio` es un timestamp fijo; el reloj local no acumula error entre snapshots.
- **Código más pequeño:** ~30 líneas menos en `useMinutoEnVivo.ts` respecto al primer intento, y sin el campo `updatedAt` cruzando 3 archivos (payload, endpoints, tab).

**Alternativa descartada:** subir la frecuencia del poller a 10s para "suavizar" el label. No lo fuimos a implementar — consume cuota de api-football y no resuelve el cache vacío post-restart. El reloj local (1 `setInterval(1s)` por `LiveHero` activo — máximo 1 por página) es la solución correcta.

**Trade-off conocido:** si el partido arranca DEMORADO (kickoff real ≠ `fechaInicio` programado) Y el cache del poller aún está vacío, la heurística del 1H sobre-cuenta el minuto hasta que llegue el primer tick del poller con `elapsed` real del API. En cuanto el server reporta `elapsed`, el reloj se realinea (server-anclado, no heurístico). Es una ventana de ≤30s post-boot — aceptable.

### Ítem 3 post Hotfix #8 — Corrección del desfase del reloj (server GANA sobre heurística)

Post-merge del refactor del Hotfix #8, el PO reportó: partido real minuto 54, hero muestra 59'. Desfase de +5 min constante. Root cause: la fórmula intermedia `max(elapsed, mFromKickoff)` en la rama 1H pisaba el server con la heurística cuando la heurística adelantaba — justo el bug opuesto al que pretendía resolver (la intención original era "proteger contra partidos que arrancan TARDE", pero si el `fechaInicio` programado es antes del kickoff real, la heurística sobre-cuenta y el `max` la prefiere). El PO hizo notar que el fix debía ser más simple: el server DA la verdad, punto.

**Fix:** regla unificada para 1H/2H/ET. Cuando `elapsed !== null` (server reportó), proyectamos desde ese valor usando `elapsedAnchorAt` (mismo patrón que ya usaba 2H/ET). Cuando `elapsed === null` (cache vacío pre-poller), caemos a heurística de `fechaInicio` SOLO en 1H; en 2H/ET sin elapsed el mapper devuelve "2T" / "Prórroga" (no podemos derivar del kickoff porque el HT es variable). El `cap` por status ahora solo significa "no extender localmente más allá del cap" — si el server ya reporta `elapsed >= cap`, respetamos el server tal cual (p.ej. 1H con `elapsed=48` por descuento largo → mostramos 48', no proyectamos a 49).

### Ítem 4 post Hotfix #8 — Anclaje server-side del reloj vía `elapsedAgeMs` (eliminación de la heurística)

Post-merge del Ítem 3, el PO reportó un bug más sutil: **el reloj se veía adelantado +5 min los primeros momentos tras abrir la pestaña, luego se sincronizaba, y al salir/volver volvía a desfasear**. Este patrón era distinto al bug del Ítem 3 (ese era desfase CONSTANTE por el `max`), este es desfase TRANSITORIO al montar.

**Root cause profundo:** el cliente inicializaba `elapsedAnchorAt = Date.now()` al montar, asumiendo que el `elapsed` del SSR era fresquito. Pero:
- El SSR lee el cache in-memory (`getLiveStatus`), que puede tener un snap de hace varios minutos si el poller no ha refrescado (Railway auto-scaling con instancias nuevas, rate-limit 429 del API, o el partido no está en el set activo del poller de esta instancia).
- El cliente no sabía cuánto tiempo había pasado desde que el server capturó el `elapsed`.
- Inicializaba "asumiendo que es nuevo" → mostraba `elapsed` + `0 min` = valor del cache (sin compensar el tiempo que el cache ya lleva).
- Cuando el cache no tenía snap (primer render post-boot del proceso), el Ítem 3 caía a heurística de `fechaInicio` con HT fijo de 15 min → desfase crónico (+5 en partidos con HT real diferente o kickoff demorado).
- Al llegar el primer WS (~5s-30s), el payload traía elapsed fresco y el reloj re-anclaba. De ahí el "se sincroniza después de un par de minutos".
- Al remontar (volver a la pestaña), el ciclo se repetía.

**Fix (3 piezas):**

1. **Payload del server incluye `elapsedAgeMs: number | null`.** En `emitirRankingUpdate` y en ambos endpoints REST (`/api/v1/torneos/:id/ranking`, `/api/v1/live/matches`) + en el SSR de `/live-match` (`buildLiveTabs`, `tryBuildFinalizedTab`), el server calcula `elapsedAgeMs = Date.now() - snapshot.updatedAt`. Como lo calcula con SU propio reloj (mismo reloj que escribió `updatedAt`), es **inmune a clock skew** entre server y cliente. El cliente no hace cálculos ambiguos de timestamps — solo resta una duración.

2. **Cliente ancla correctamente.** El hook `useMinutoEnVivo` hace `elapsedAnchorAt = Date.now() - elapsedAgeMs` al montar y al cambiar cualquier input del server (nuevo WS o nuevo SSR tras remount). El reloj local proyecta `elapsed + floor((now - elapsedAnchorAt)/60000)` desde el momento real de captura del snap. Si el snap tenía 5 min de edad cuando el server lo emitió, el cliente lo sabe y proyecta los 5 min correctamente.

3. **Heurística de `fechaInicio` ELIMINADA del hook.** Si `statusShort === null` (cache totalmente frío), el hook devuelve `"—"` honesto. No más adivinanzas basadas en kickoff + HT fijo. Durante los ≤30s hasta el primer tick del poller, el usuario ve "—" en vez de un valor incorrecto. La prop `fechaInicio` se removió del `LiveHero` (ya no aporta). El `LiveMatchTab` sigue teniendo `fechaInicio` disponible para metadata general del partido pero el hook del reloj no la usa.

**Caso del bug del PO resuelto:** partido real minuto 59, cache del server tiene snap con `elapsed=54, updatedAt=hace 5 min`. Server emite `elapsedAgeMs=300000`. Cliente calcula `elapsedAnchorAt = Date.now() - 300000` → proyecta `54 + 5 = 59'`. Alineado con el reloj real. Al remontar, el nuevo SSR vuelve a calcular `elapsedAgeMs` al momento del nuevo render → cliente re-ancla correctamente.

**Beneficio colateral:** el reloj del server es la **única fuente de verdad**. Clock skew en el cliente (típico en mobile con clock sincronizado por NTP flojo) ya no afecta — solo se usa `Date.now()` local para medir deltas cortos entre el mount y renders siguientes.

**Tests nuevos (73 casos en `tests/use-minuto-en-vivo.test.ts`):**
- `BUG REPRO del PO`: elapsed=54 con age=5min → 59' (el caso exacto reportado).
- Comportamiento comparativo: `sin elapsedAgeMs (anchor=now) produce resultado sin proyección` — documenta el bug que existía antes del Ítem 4.
- Matriz completa: 1H/2H/ET con distintos elapsed y deltas, estados fijos (HT/FT/AET/PEN/NS/SUSP), sin datos del server (statusShort null → "—", elapsed null pero status válido → mapper fallback "1T"/"2T"/"Prórroga").
- AST del hook: acepta `elapsedAgeMs`, **NO** acepta `fechaInicio`, anchora con `Date.now() - elapsedAgeMs`, resetea ancla al cambiar `elapsedAgeMs`, usa `setInterval(1000)` + cleanup.
- Wiring: `RankingUpdatePayload` con `elapsedAgeMs`, `emitirRankingUpdate` calcula age en el emit, ambos endpoints REST la devuelven, SSR de `/live-match` la asigna, `LiveHero` la recibe, `LiveMatchView` la propaga, `useRankingEnVivo` la expone y pisa crudo al llegar WS. Total: **554 passing + 7 skipped**.

**Bug #23 — 2 torneos FINALIZADOS no acreditaron Lukas a sus ganadores.** Síntoma: `Ticket.premioLukas` estaba bien seteado (ej. ganador con 84 Lukas), pero `Usuario.balanceLukas` no cambió y no había `TransaccionLukas` con `tipo: PREMIO_TORNEO, refId: torneoId`. El Hotfix #7 supuestamente arreglaba esto. Investigación: el early-return por idempotencia (`{ alreadyFinalized: true }`) es INCONDICIONAL — si un torneo llegó a estado FINALIZADO por cualquier camino sin acreditar (finalizó antes del deploy del Hotfix #7; o el `prisma.$transaction` tuvo una race condition y marcó FINALIZADO sin completar el credit block), la próxima corrida del poller entra al guard, ve `estado === "FINALIZADO"` y retorna sin verificar nada. Queda en estado zombie: FINALIZADO permanente sin crédito, y la única reparación era el endpoint admin manual `POST /api/v1/admin/torneos/:id/reconciliar`.

**Root cause confirmada con grep y análisis estático del código:** no hay otro path que escriba `estado: "FINALIZADO"` aparte de `finalizarTorneo` (línea 366 de `ranking.service.ts`). No existe admin UI ni endpoint que fuerce manualmente FINALIZADO. La transacción de `finalizarTorneo` escribe `Torneo.estado = FINALIZADO` como último paso, así que si la transacción falla NI los premios se acreditan NI el torneo se marca — pero si el proceso crashea DESPUÉS del commit de la transacción y ANTES del log, la corrida siguiente ve `alreadyFinalized` aunque el credit haya sido exitoso (esto es safe, no duplica). El caso real son torneos pre-Hotfix #7 que finalizaron con el código viejo y nunca se acreditó crédito — para los cuales el endpoint admin existe. El PO pidió que no dependamos de intervención manual: el sistema debe auto-repararse.

**Fix — guard defensivo con auto-reconcile.** El early-return ahora hace una consulta de lectura (no muta) para verificar si el crédito está completo. Si no lo está, dispara `reconciliarTorneoFinalizado` internamente (idempotente — solo acredita deltas > 0). En 3 piezas:

- **Pieza 1 — Helper puro `detectarCreditoIncompleto(torneoId)`.** Exportado desde `ranking.service.ts`. Lee en paralelo (a) `prisma.ticket.findMany({ where: { torneoId, premioLukas: { gt: 0 } } })` y (b) `prisma.transaccionLukas.findMany({ where: { tipo: "PREMIO_TORNEO", refId: torneoId } })`. Suma ambos y calcula `deltaPendiente = totalPremiosEsperado - totalPremiosAcreditado`. Devuelve `null` cuando no hay tickets premiados o cuando delta ≤ 0; devuelve `{stats: {ticketsPremiados, totalPremiosEsperado, totalPremiosAcreditado, deltaPendiente}}` cuando detecta faltante.
- **Pieza 2 — `finalizarTorneo` consulta el helper ANTES del early-return.** Si `detectarCreditoIncompleto` devuelve algo, loggea `logger.warn` con contexto completo + dispara `await reconciliarTorneoFinalizado(torneoId)` dentro de un `try/catch`. El catch loggea `logger.error` pero NO re-throwea: el poller no debe fallar el tick entero por un guard defensivo. Al terminar el auto-reconcile (exitoso o no), retorna `{ alreadyFinalized: true }` como antes — la promesa externa del API no cambia.
- **Pieza 3 — Logs estructurados.** `logger.warn({ torneoId, ticketsPremiados, totalPremiosEsperado, totalPremiosAcreditado, deltaPendiente }, "finalizarTorneo: torneo FINALIZADO sin crédito completo — auto-reconciliando")` cuando detecta. `logger.info({ torneoId, ticketsAjustados, totalDeltaAcreditado }, "finalizarTorneo: auto-reconcile completado")` al terminar exitoso. `logger.error({ err, torneoId }, "finalizarTorneo: auto-reconcile falló")` si el catch dispara. Esto da visibilidad en Sentry + Grafana sobre qué torneos se autocorregirían y cuántos Lukas se acreditaron post-hoc.

**Idempotencia al cuadrado:** la segunda corrida de `finalizarTorneo` sobre un torneo ya auto-reparado encuentra `deltaPendiente === 0` y cae al early-return simple (sin warn ni reconcile). Correr el poller 1000 veces sobre el mismo torneo no duplica crédito — el helper del reconcile (`delta > 0 ?`) ya lo garantizaba desde el Hotfix #7.

**Cobertura del fix:**
- Los 2 torneos reportados por el PO se van a auto-reparar en la próxima corrida del poller (que los vuelve a tocar como parte del ciclo normal — si están vinculados a un partido FINALIZADO siguen siendo visitados cada 30s por el poller hasta que el partido pase del set en vivo, y el poller igual llama `finalizarTorneo` por esa transición). Alternativa: el admin puede correr el endpoint manual y forzarlo al instante.
- Cualquier regresión futura del credit block queda cubierta — si un bug causa que un torneo llegue a FINALIZADO sin crédito completo, el próximo intento del poller lo repara. La única intervención admin queda para casos fuera del ciclo normal del poller (ej. cancelaciones retroactivas).

**Alternativa descartada (recuperación por migración masiva al deploy):** un script que encuentre todos los torneos FINALIZADOS con crédito incompleto y los repare al deploy. Se descartó — arriesgaba tocar torneos en estado transitorio (EN_JUEGO al momento de la migración que pasaría a FINALIZADO por el poller mientras corremos el fix), y no ofrece cobertura para regresiones futuras. El guard en `finalizarTorneo` es un mecanismo vivo que repara en el momento.

**Tests agregados:**
- `tests/use-minuto-en-vivo.test.ts` (66 casos): matriz de `computeMinutoLabel` puro — 1H ancla a fechaInicio (con/sin elapsed server, 30s → minuto 1, pre-kickoff → "1'", 60min → clamp 45, descuento server > 45 → respeta, ISO vs Date, partido arrancó tarde); 2H ancla a elapsed (hace 60s → +1, cap 90, descuento > 90 → respeta, sin elapsed → "2T"); ET (prórroga 95' → "Prór. 96", sin elapsed → "Prórroga"); estados fijos (HT/FT/AET/PEN/NS/SUSP); heurística sin statusShort ("Por empezar" / "1T{n}" / "ENT" / "2T{n}" / "—"). AST sobre el hook (use client, interval 1s, cleanup, exporta `computeMinutoLabel`, `STATUSES_AVANZANDO` + `CAP_POR_STATUS`, useRef del ancla, acepta fechaInicio no snapshotUpdatedAt). Wiring end-to-end (`RankingUpdatePayload` con statusShort sí / snapshotUpdatedAt NO; endpoints REST con statusShort sí / snapshotUpdatedAt NO; `/api/v1/live/matches` incluye fechaInicio serializada; `LiveHero` con los 3 nuevos props; `LiveMatchView` propaga fechaInicio; SSR de page asigna fechaInicio + statusShort + elapsed; `useRankingEnVivo.RankingSnapshot` incluye statusShort; applySnapshot preserva statusShort null).
- `tests/finalizar-torneo-auto-reconcile.test.ts` (15 casos): guard invoca `detectarCreditoIncompleto`, loggea WARN al detectar incompleto, dispara reconciliación dentro de try/catch, devuelve `alreadyFinalized: true` igual; el helper lee tickets con `premioLukas > 0`, consulta `TransaccionLukas` con `tipo=PREMIO_TORNEO + refId=torneoId`, compara esperado vs acreditado, devuelve null en casos sin ganadores o delta ≤ 0, devuelve stats completas cuando detecta delta > 0; no regresión del Hotfix #7 (`finalizarTorneo` sigue llamando `recalcularTorneo` antes, sigue acreditando dentro de `$transaction`).
- Actualizado `tests/live-hero-minute.test.ts` para reflejar que el LiveHero ya no recibe `minutoLabel` directo como prop — recibe `{fechaInicio, statusShort, elapsed}` y el hook deriva el label.

**Smoke esperado:** `pnpm test` 569 passing + 7 skipped (Prisma integration) en 32 archivos; `pnpm exec tsc --noEmit` limpio; `pnpm lint` sin warnings. El smoke end-to-end del reloj requiere Docker Compose + seed + poller real (hay que ver literalmente el contador avanzar). El smoke end-to-end del auto-reconcile requiere crear un torneo FINALIZADO con `Ticket.premioLukas > 0` pero sin `TransaccionLukas PREMIO_TORNEO` y disparar el poller — se deja para QA de Sub-Sprint 8.

### ✅ Sub-Sprint 6 (20 Abr) — Tienda + Canjes + Emails

Sub-Sprint 6 cerró todo lo que faltaba de la mecánica de premios post-torneo: catálogo de premios reales, flujo de canje atómico, admin de gestión, y templates de email transaccionales wireados a los eventos clave del sistema (ganar premio, solicitar canje, envío, entrega, torneo cancelado). El Hotfix #7 ya había dejado listo el crédito automático de Lukas al finalizar torneos — el SS6 completa el loop del MVP: el usuario gana, recibe un email, entra a `/tienda`, canjea su premio, ve su progreso en `/perfil`.

**Catálogo de premios — seed de 25 items.** El `packages/db/prisma/seed.ts` ahora define un catálogo balanceado con las 5 categorías del §10.6: 5 entradas (Monumental, Estadio Nacional, palco Cristal), 5 camisetas (Perú 2026 para el Mundial, equipos peruanos, camiseta firmada de Paolo Guerrero como premio LIMITADO), 6 gift cards (Plaza Vea, Falabella, Netflix, Spotify — las más rotativas), 6 tech (audífonos Samsung, parlante JBL, power banks, cargadores), 3 experiencias (cena en La Mar, clase con entrenador UEFA, tour Estadio Nacional). Precios con margen ~30% sobre valor referencia en soles (campo `valorSoles` interno, no visible al jugador). Badges: 3 POPULAR (entrada doble al Monumental/Estadio Nacional, gift card Plaza Vea S/50, audífonos Samsung), 2 NUEVO (camiseta Perú 2026, smartwatch), 3 LIMITADO (stocks 2-8: palco Cristal, camiseta firmada Guerrero, cena La Mar). UN featured (entrada doble al Monumental, S/100 ≈ 120 Lukas). 19 productos requieren dirección (camisetas, tech físico); 6 no (gift cards digitales, experiencias). Decisión de diseño §15: evité agregar imágenes reales en MVP — cada premio lleva un emoji como imagen fallback (`🏟️`, `👕`, `🎧`, etc.), rendereado en el `PrizeCardV2` con el emoji gigante sobre fondo subtle. Permite lanzar sin pipeline de CDN de imágenes.

**Schema — extensión de `Premio` y nuevos enums.** Migración `20260420120000_add_perfil_premios_limites` agrega al model `Premio`: `categoria: CategoriaPremio` (enum con 5 valores), `badge: BadgePremio?` (enum POPULAR/NUEVO/LIMITADO), `featured: Boolean`, `requiereDireccion: Boolean`, `valorSoles: Int?`. Índice compuesto `(activo, categoria)` para que el filtrado del catálogo sea sub-ms incluso con 200+ premios. Decisión: los campos quedaron en el mismo `@@map("premios")` — no creamos tabla nueva. El model `Canje` + enum `EstadoCanje` ya existían desde el schema inicial con los 5 estados (PENDIENTE/PROCESANDO/ENVIADO/ENTREGADO/CANCELADO); el SS6 solo construye el flujo alrededor de ellos.

**Service de premios — `lib/services/premios.service.ts`.** Lectura pura: `listarPremios({categoria?, soloConStock?, incluirInactivos?})` devuelve `{premios[], featured}` ordenado por `featured desc, costeLukas asc, creadoEn asc` (featured arriba, luego más baratos primero para que el primer scroll muestre los alcanzables). `obtenerPremio(id)` para detalle. `CATEGORIAS_VALIDAS` es const readonly — los inputs de string no confiables se validan contra ese array. Público: el endpoint `GET /api/v1/premios` no requiere sesión (el usuario anónimo ve el catálogo y el CTA "Iniciar sesión" aparece al clickear canjear).

**Service de canjes — `lib/services/canjes.service.ts`.** La parte crítica. `crearCanje(usuarioId, {premioId, direccion?})` sigue el mismo patrón de `tickets.service`: validaciones fuera de la transacción para salir rápido (premio existe + activo + con stock, dirección válida si requiere), luego todo atómico en `prisma.$transaction`: (a) re-lee usuario + premio dentro de la tx para race-condition safety (otro canje paralelo pudo agotar stock); (b) descuenta Lukas del usuario; (c) decrementa stock del premio; (d) crea `Canje` con estado PENDIENTE + dirección JSON; (e) crea `TransaccionLukas { tipo: CANJE, monto: -costeLukas }`. Si cualquier paso falla, rollback total — ni Lukas salen ni stock se va. Post-commit, fire-and-forget `notifyCanjeSolicitado` (respeta `PreferenciasNotif.notifResultados`). Validaciones de dirección son estrictas cuando `requiereDireccion=true`: obliga nombre/telefono/direccion/ciudad; referencia opcional. Enforcement de auto-exclusión via `verificarLimiteCanje` ANTES de entrar a la transacción — si el usuario está auto-excluido, el canje falla con `LimiteExcedido` sin tocar BD.

**Admin de canjes — máquina de estados.** El `actualizarEstadoAdmin(canjeId, {estado, metodo?, codigoSeguimiento?, motivoCancelacion?})` implementa la máquina `PENDIENTE → PROCESANDO → ENVIADO → ENTREGADO`, con `CANCELADO` accesible desde cualquier estado previo a ENTREGADO. Cancelación es la transición más compleja: reembolsa Lukas al usuario (`balance += lukasUsados`), restituye stock (`stock += 1`), crea `TransaccionLukas { tipo: REEMBOLSO }`, todo en `prisma.$transaction`. Las demás transiciones son solo un update + email: ENVIADO dispara `notifyCanjeEnviado` con método + tracking; ENTREGADO dispara `notifyCanjeEntregado`. La constante `TRANSICIONES: Record<EstadoCanje, EstadoCanje[]>` documenta explícitamente qué transiciones son legales — cualquier otra revienta con `LimiteExcedido`. Endpoints: `GET /api/v1/admin/canjes` (filtros por estado + paginación), `PATCH /api/v1/admin/canjes/:id` (admin-only con `rol !== "ADMIN" → NoAutorizado`). Página `/admin/canjes` con `AdminCanjesPanel.tsx` muestra filtros + cards expandibles con dirección JSON + botones de transición (prompt inline para método/tracking en ENVIADO, confirmación nativa para CANCELADO).

**Servicio de email — `lib/services/email.service.ts` + `lib/emails/templates.ts`.** El dilema fue agregar `resend@*` + `@react-email/*` (2 deps pesadas) o escribir wrapper minimal. Opté por el segundo camino: `enviarEmail({to, subject, html, text?, from?})` hace POST directo a `https://api.resend.com/emails` con fetch — API pública, auth Bearer, Content-Type JSON. Default `from` = `"Habla! <equipo@hablaplay.com>"` (dominio ya verificado en NextAuth magic link). Modo dev: si `RESEND_API_KEY` no está configurada, loggea el email "enviado" y retorna `{ok: true, skipped: true, reason: "no-api-key"}` — smoke local funciona sin cuenta de Resend. Modo test (`NODE_ENV=test`): captura el email en un sink in-memory que los tests pueden leer con `__peekTestEmails()`. Templates vienen de funciones puras en `templates.ts` que retornan `{subject, html, text}` — cada una escapa HTML del nombre del usuario (prevención XSS), usa el layout común `wrapEmail(titulo, bodyHtml)` con branding navy + dorado + footer con link a `hablaplay.com` y a `/perfil` para cambiar preferencias. Hex hardcodeados permitidos explícitamente en `templates.ts` porque los emails se rendean en clients sin Tailwind — §14 la regla es para JSX.

**8 templates cubren todos los eventos del MVP:** `premioGanadoTemplate` (🥇/🥈/🥉/🏆 según posición, balance acreditado destacado en banda dorada con premio + CTA a tienda), `canjeSolicitadoTemplate` (copy diferente para físico "24h" vs digital "48h"), `canjeEnviadoTemplate` (método + tracking opcional), `canjeEntregadoTemplate` (copy corto + CTA volver a jugar), `torneoCanceladoTemplate` (reembolso destacado verde), `verifCodigoSmsEmailTemplate` (código 6 dígitos centrado sobre navy, usado como fallback cuando Twilio no está configurado), `solicitudEliminarTemplate` (advertencia si `balanceLukas>0`, link con TTL 48h), `datosDescargadosTemplate` (URL attachment + TTL 24h).

**Wrappers de notificación — `lib/services/notificaciones.service.ts`.** El archivo centraliza preferencias + despacho. `obtenerPreferencias(usuarioId)` lee `PreferenciasNotif`; si no existe, crea con defaults (`PREFERENCIAS_DEFAULT`: 5 toggles `true` incluido notifPremios/notifResultados/notifInicioTorneo/notifSugerencias/notifCierreTorneo, 2 toggles `false` opt-in explícito: notifPromos, emailSemanal). `actualizarPreferencias(usuarioId, patch)` hace upsert. `debeNotificar(usuarioId, tipo)` es el gate — lee la preferencia, devuelve default si no existe, booleano. Los 8 wrappers por evento (`notifyPremioGanado`, `notifyCanjeSolicitado`, `notifyCanjeEnviado`, `notifyCanjeEntregado`, `notifyTorneoCancelado`, `notifyVerifCodigoEmail`, `notifySolicitudEliminar`, `notifyDatosDescargados`) encapsulan el mismo patrón: (1) chequear preferencia relevante (excepto verificación/eliminar/descargar que son transaccionales críticos); (2) leer destinatario (skippea si `deletedAt` o sin email); (3) renderizar template; (4) enviar. Todos envueltos en `try/catch` que loggea pero NO re-throwea — si el email falla, la acción principal (acreditar premio, crear canje) NO se rompe.

**Wiring en `ranking.service.finalizarTorneo`.** Tras el commit de la transacción que acredita Lukas y marca el torneo FINALIZADO, el código lee el nombre del torneo + `equipoLocal` + `equipoVisita` del partido relacionado, y dispara `void notifyPremioGanado` por cada ganador en `resultado`. Fire-and-forget: no esperamos el email antes de retornar. El `try/catch` alrededor del `prisma.torneo.findUnique` asegura que un fallo de BD al buscar el torneo NO rompe el retorno — solo perdemos los emails de esa ronda, no el crédito que ya está comprometido. Respecto a la convención §14 "Tras toda mutación de Lukas el endpoint devuelve `nuevoBalance`": los ganadores reciben el crédito via poller, no vía endpoint con body — pero el próximo request del cliente al `session` callback de NextAuth verá el balance actualizado (ya que `obtenerBalance` lee de BD).

**Página `/tienda`.** Reemplazó el stub `<h1>Tienda de Premios</h1>`. El page.tsx (server, force-dynamic) fetchea `listarPremios()` + `auth()` + count de canjes exitosos del usuario, pasa todo a `TiendaContent.tsx` (client). Sin sesión, la página se renderiza completa y funcional — solo el CTA de "canjear" delega al login. Con sesión, hay 3 shop stats (balance del store con mounted-guard, canjeables ahora, ya canjeados) + el hero featured + chips de categoría (reusan el primitivo `Chip` con URL state `?categoria=`) + grid responsive 1/2/3 columnas + CTA final azul con 2 botones (Ver partidos, Comprar Lukas). `PrizeCardV2` tiene 3 estados visuales: agotado (badge rojo, CTA disabled), afordable (border verde, CTA dorado "Canjear ahora"), no-afordable (progress bar dorada con % + "Te faltan X 🪙"). `CanjearModal` (usa el primitivo `Modal` con createPortal) tiene 4 estados: idle (preview + balance antes/después + form de dirección si requiere), submitting, success (panel con confetti + balance restante + CTAs ver-mis-canjes / seguir-comprando), error (toast inline con retry). Validación de form client-side antes de habilitar el submit. Tras éxito, llama `setBalance(json.data.nuevoBalance)` del store — el header + sidebar widgets se actualizan al instante sin recarga.

**Tab Ganadas de `/mis-combinadas` con CTA a tienda.** La tab ya existía desde Sub-Sprint 4 y filtraba por `premioLukas > 0`. El SS6 la enriquece con `WinnerPrompt`: cuando el usuario está en `?tab=ganadas` Y hay al menos un ticket ganado, aparece un banner con gradient navy + texto "¡Ganaste X 🪙 en tus torneos!" + CTA dorado "Ir a la tienda →". Suma `premioLukas` de todos los tickets de la pestaña actual. Cero cambios en `tickets.service` — es puro UI.

**Decisiones autónomas documentadas (§15):** (a) emails como HTML strings sin `react-email/*` para no agregar deps; (b) seed de 25 premios con categorización balanceada; (c) margen ~30% sobre valor real documentado en `valorSoles` interno; (d) featured único (entrada doble al Monumental) para que el hero no compita consigo mismo; (e) validación de dirección estricta in-service, no en Zod del endpoint, porque requiere lookup del premio.

**Tests nuevos SS6 (67 casos):** `premios.service.test.ts` (9: categorías, orderBy, filter activo, seed >20 items, 5 categorías cubiertas, featured ≥ 1, badges válidos, requiereDireccion en ≥8), `canjes.service.test.ts` (10: $transaction atomicidad, notifyCanjeSolicitado wire, decrement stock/Lukas, BalanceInsuficiente, SIN_STOCK, ValidacionFallida dirección, verificarLimiteCanje, máquina de estados literal, CANCELADO con REEMBOLSO + increment stock, notifyCanjeEnviado/Entregado al transicionar), `email-templates.test.ts` (15: emoji por posición, escape XSS, copy diferente por dirección, token URL fallback texto, código SMS prominente, etc.), `tienda-ui.test.ts` (16: force-dynamic, use client en Modal/Card, authedFetch, setBalance del store, status machine, form válido), `notificaciones.service.test.ts` (9: 7 keys presentes, defaults correctos, debeNotificar consulta BD, 8 wrappers exportados, try/catch en wrappers, skip deletedAt, import desde ranking.service, loop por resultado).

### ✅ Sub-Sprint 7 (20 Abr) — Perfil + Verificación + Juego responsable

Sub-Sprint 7 cierra el lado del usuario: `/perfil` pasa de un placeholder a un centro de control completo con 12 secciones siguiendo §10.8 del CLAUDE.md al pie de la letra. Verificación de teléfono con SMS real (Twilio) y fallback a email en modo dev. Verificación de DNI con upload local a filesystem (MVP). Límites de juego responsable con enforcement REAL en los puntos críticos del producto. Eliminar cuenta con soft delete y token con TTL 48h.

**Schema — 5 tablas nuevas + extensión de Usuario.** Migración `20260420120000_add_perfil_premios_limites` agrega a `Usuario`: `username: String? @unique` (para @handle en ranking e inscritos), `telefonoVerif: Boolean @default(false)`, `dniVerif: Boolean @default(false)`, `ubicacion: String?`, `deletedAt: DateTime?` (soft delete). Crea modelos `PreferenciasNotif` (7 booleans), `LimitesJuego` (limiteMensualCompra=300 default, limiteDiarioTickets=10 default, autoExclusionHasta), `VerificacionTelefono` (usuarioId PK, código SHA-256, intentos, expiraEn 10 min, confirmado), `VerificacionDni` (imagen URL, estado PENDIENTE/APROBADO/RECHAZADO, motivoRechazo, revisadoEn), `SolicitudEliminacion` (token unique, expiraEn 48h, confirmadaEn). Todo con `onDelete: Cascade` desde Usuario — si se elimina el registro principal, las tablas satélite se limpian automáticamente. Enum nuevo `EstadoVerifDni`. Las relaciones inversas en Usuario están declaradas como opcionales (`preferenciasNotif: PreferenciasNotif?`, etc.) para que el schema no rompa con usuarios legacy sin registros.

**Service de usuarios — `lib/services/usuarios.service.ts`.** `obtenerMiPerfil(usuarioId)` compone el perfil completo leyendo Usuario + calculando `nivel` con `calcularNivel(torneosJugados)` + `stats` vía `calcularStats()`. Torneos jugados = `prisma.ticket.findMany({where: {usuarioId}, distinct: ["torneoId"]})` — cuenta torneos únicos, no tickets totales (respetando la regla de §9 SS7). `actualizarPerfil(usuarioId, patch)` valida nombre mínimo 2 chars, username con regex `[a-z0-9_]{3,20}` (si está tomado por otro usuario lanza `USERNAME_EN_USO` 409); captura P2002 de Prisma como fallback defensivo. Cambiar el teléfono resetea `telefonoVerif=false` automáticamente (hay que re-verificar). Correo y fechaNac son inmutables — no los acepta en el PATCH.

**Eliminar cuenta — soft delete atómico.** `solicitarEliminarCuenta(usuarioId, baseUrl)` genera token con `crypto.randomBytes(32).toString("hex")`, crea `SolicitudEliminacion { token, expiraEn: now + 48h }`, dispara `notifySolicitudEliminar` (email con link `{baseUrl}/perfil/eliminar/confirmar?token=<token>` + advertencia de balance > 0). No revela el token en la respuesta HTTP — solo viaja por email. `confirmarEliminarCuenta(token)` valida: existe, no expirado (>410), no confirmado antes (409). En `prisma.$transaction`: (a) marca `confirmadaEn` en la solicitud; (b) actualiza Usuario anonimizando PII — `nombre = "Usuario eliminado"`, `email = deleted-<id8>-<timestamp>@deleted.habla.local` (único, no colisiona), `username/telefono/ubicacion/image = null`, `deletedAt = new Date()`; (c) borra todas las sesiones activas (fuerza logout). Preserva tickets + transacciones + canjes — por audit y porque rompería la integridad del torneo finalizado (¿a qué ticket pertenece este premio?). El `auth.ts` de NextAuth ya respeta `deletedAt` al montar la sesión — el helper `crearOEncontrarUsuario` se actualizaría en Sub-Sprint 2 para no revivir usuarios soft-deleted. Por ahora si un usuario borrado intenta loggearse de nuevo con el mismo email, recibiría un usuario nuevo (el email viejo quedó anonimizado).

**Exportar datos.** `generarExportDatos(usuarioId)` arma un objeto `{perfil (sin nivel/stats para evitar circular), transacciones, tickets (con torneo.nombre), canjes (con premio.nombre), generadoEn}`. El endpoint `GET /api/v1/usuarios/me/datos-download/file` lo sirve como `application/json` con `Content-Disposition: attachment; filename="habla-datos-<id>-<fecha>.json"` — el browser descarga el archivo. `solicitarExportDatos(usuarioId, baseUrl)` dispara el email con el link a `/file`; la autenticación de la descarga es la cookie de sesión (solo el dueño puede bajar — el endpoint llama `auth()` y compara `session.user.id`). No ZIP — evitamos la dep `archiver@*`; si el catálogo crece demasiado en el futuro, migramos a storage temporal + streaming.

**Service de verificación — `lib/services/verificacion.service.ts`.** Teléfono: `solicitarCodigoTelefono(usuarioId, telefono)` valida con regex `^\+?[0-9]{8,15}$` (acepta `+51 999 999 999` o `999999999`), genera código 6 dígitos, guarda hasheado con `crypto.createHash("sha256")` (no bcrypt — evitamos dep; para códigos efímeros de 6 dígitos con TTL 10 min y MAX 3 intentos, SHA-256 ofrece suficiente latencia de fuerza bruta). TTL = 10 min. En `NODE_ENV=dev` + Twilio NO configurado, usa código fijo `"123456"` (rapidez de smoke + DX). En `NODE_ENV=production` + Twilio configurado, llama a Twilio REST API directo con fetch (`POST /2010-04-01/Accounts/<SID>/Messages.json` + auth Basic base64), sin la dep `twilio@*`. Fallback: si Twilio no está configurado, dispara email via `notifyVerifCodigoEmail` con el código — permite smoke testing sin cuenta SMS. `confirmarCodigoTelefono(usuarioId, codigoIngresado)`: early-returns con códigos claros (SIN_CODIGO 404, YA_VERIFICADO 409, CODIGO_EXPIRADO 410, MAX_INTENTOS 429, CODIGO_INCORRECTO 400 con contador de intentos restantes). Al éxito (match del hash), `prisma.$transaction` marca `confirmado=true` + escribe `Usuario.telefono + telefonoVerif=true`.

**Verificación DNI — upload local.** Decisión §15: almacenamiento en filesystem bajo `apps/web/public/uploads/dni/<hex32>.{jpg|png}`. Alternativas descartadas: S3 (requiere `@aws-sdk/client-s3` + credenciales), Cloudflare R2 (misma dep), servicio externo tipo uploadcare.com (requiere account). Para MVP en Railway con 1 réplica, filesystem local es suficiente. Cuando escale a multi-réplica, migrar a R2. `subirDni(usuarioId, {dniNumero, imagenBase64, mimeType?})` valida DNI peruano 8 dígitos, parsea el base64 (acepta `data:image/jpeg;base64,...` o base64 puro), valida MIME en `image/jpeg/jpg/png`, rechaza si > 1.5MB. Genera filename único con `crypto.randomBytes(16).toString("hex")`, escribe el file, crea `VerificacionDni` con estado PENDIENTE (upsert para que el usuario pueda re-subir si fue rechazado). `aprobarDniAdmin(verifId)` + `rechazarDniAdmin(verifId, motivo)` para admin; al aprobar, marca `Usuario.dniVerif=true` en `prisma.$transaction`. `obtenerEstadoDni(usuarioId)` devuelve `"NO_SUBIDO"|"PENDIENTE"|"APROBADO"|"RECHAZADO"` + motivo opcional. Se omite la UI admin del DNI en este sub-sprint por simplicidad — el admin puede llamar el endpoint manualmente o agregar UI en una iteración futura.

**Service de límites — `lib/services/limites.service.ts`.** Pasa de stub vacío a enforcement real. `obtenerLimites(usuarioId)` crea defaults si no existen (300 mensual compra, 10 diario tickets), calcula en el mismo call `uso.comprasMesActual` (sum TransaccionLukas tipo COMPRA desde inicio del mes en Lima) y `uso.ticketsUltimas24h` (count). `actualizarLimites(usuarioId, patch)` con upsert, valida no-negativos. `activarAutoExclusion(usuarioId, dias)` acepta solo 7/30/90 (enum runtime check), setea `autoExclusionHasta = now + dias*24h*60m*60s*1000ms`. **Enforcement real en consumers:** (a) `tickets.service.crear()` llama `verificarLimiteInscripcion({tx, usuarioId, entradaLukas})` antes del descuento — chequea auto-exclusión + límite diario (cuenta+1 > limiteDiario → LimiteExcedido). Para placeholder update (no se cuenta como inscripción nueva), solo chequea auto-exclusión via `bloquearSiAutoExcluido(usuarioId, tx)`. (b) `canjes.service.crearCanje()` llama `verificarLimiteCanje({usuarioId})` antes de todo — si auto-excluido, no puede canjear. (c) `verificarLimiteCompra({usuarioId, montoLukas})` queda exportado listo para Sub-Sprint 2 (pagos Culqi) — chequea auto-exclusión + suma compras del mes contra `limiteMensualCompra` (bloquea si excede). Los defaults MVP son los que §6 documenta (300/mes, 10/día).

**Service de notificaciones — SS7.** `notificaciones.service.ts` ya existía del SS6 para emails de canjes/premios. El SS7 completa: `obtenerPreferencias(usuarioId)` ya estaba; ahora el endpoint `GET/PATCH /api/v1/usuarios/notificaciones` lo expone. Default de PreferenciasNotif: 5 toggles `true` + 2 `false` (promos y semanal son opt-in explícito — §§6). El panel de /perfil los edita con debounce 500ms, PATCH por toggle.

**Página `/perfil` completa — 12 secciones, ~350 líneas.** Reemplazó el placeholder del Sprint 1. La page.tsx (server, force-dynamic) fetchea perfil + preferencias + límites en paralelo con Promise.all, pasa cada payload al Client Component correspondiente. Secciones:
1. **ProfileHero**: avatar con iniciales (hash gold), nombre + @handle, ubicación + miembro desde, badge ADMIN/JUGADOR. Level card con emoji del nivel, label, copy "Llevas X torneos, te faltan Y para {siguiente.emoji} {siguiente.label}", barra de progreso. Balance del store con pattern mounted-guard (§14).
2. **StatsGrid**: 6 pills (torneos, ganados, acierto%, balance, neto ±, mejor puesto).
3. **Quick access**: 4 cards clickables a /mis-combinadas, /wallet, /tienda, /faq.
4. **VerificacionPanel**: 4 rows (email con emailVerified, edad con fechaNac, teléfono con badge según estado, DNI). CTAs "Verificar" abren `TelefonoModal` (flujo 2 pasos telefono→codigo, muestra `devCode` en dev) y `DniModal` (input file + preview + submit base64).
5. **DatosPersonalesPanel**: formulario editable — nombre, username (@handle), ubicación editables; correo, teléfono (con link a reverificar), fecha de nacimiento bloqueados con 🔒. PATCH al botón "Guardar".
6. **PreferenciasPanel**: 7 toggles con icono + título + descripción. Cada click hace `setTimeout(500ms)` que dispara PATCH por el toggle que cambió. `role="switch"` + `aria-checked` para accesibilidad.
7. **LimitesPanel**: 2 inputs numéricos (mensual, diario) con barras de uso coloreadas por % (verde < 70 / naranja < 90 / rojo >=90). Banner urgente rojo si ya está en auto-exclusión con fecha de fin. Botón "Activar auto-exclusión" abre modal con 3 opciones (7/30/90 días) + confirmación.
8. **DatosYPrivacidadPanel**: Descargar datos (POST → email con URL) + Eliminar cuenta (advertencia de balance > 0 + modal con panel "Revisá tu email" tras enviar).
9. **Ayuda y legal**: grid de 7 links (cómo jugar, FAQ, términos, privacidad, juego responsable, sobre los Lukas, acerca).
10. **Danger zone**: cerrar sesión con `CerrarSesionBoton`.
11. **Footer**: "Habla! v1.0 · Hecho en Perú 🇵🇪".

El componente `PerfilRefreshOnUpdate` (client) escucha el evento custom `perfil:refresh` y llama `router.refresh()` — los sub-paneles lo dispatchan tras mutaciones exitosas para que los server-side reads se re-disparen. Alternativa descartada: propagar callbacks desde server → client (Next 14 no lo permite). El evento custom es el puente correcto para que los paneles no necesiten prop drilling.

**Decisiones autónomas documentadas (§15):** (a) SHA-256 en vez de bcrypt para códigos efímeros (evitamos dep); (b) filesystem local para DNI uploads (evitamos S3/R2); (c) `123456` como código fijo en dev (DX); (d) Twilio REST via fetch (evitamos dep `twilio`); (e) soft delete preserva tickets y transacciones por audit; (f) exportar datos como JSON attachment inline (evitamos `archiver` + storage temporal); (g) defaults sensatos S/ 300/mes y 10 tickets/día; (h) PerfilRefreshOnUpdate event pattern para server refresh.

**Tests nuevos SS7 (76 casos):** `limites.service.test.ts` (13: constantes, exports, defaults upsert, fecha futura cálculo, LimiteExcedido, tickets/canjes usan enforcement), `usuarios.service.test.ts` (17: nivel + siguiente, distinct torneos, soft-delete skip, NoAutenticado, regex username, USERNAME_EN_USO, telefonoVerif reset, token randomBytes + TTL 48h, anonimización PII completa, deletedAt timestamp, session.deleteMany, preserva tickets/transacciones, notifySolicitudEliminar, TOKEN_EXPIRADO 410, generarExportDatos con 3 findMany), `verificacion.service.test.ts` (15: código 6 dígitos, SHA-256 hash, TTL 10 min, MAX_INTENTOS 3, 123456 dev mode, Twilio API URL, notifyVerifCodigoEmail fallback, telefonoVerif true al confirmar, códigos HTTP correctos, DNI 8 dígitos, MIME allowlist, 1.5MB max, storage paths, aprobar/rechazar admin, dniVerif true al aprobar), `perfil-ui.test.ts` (17: force-dynamic, redirect sin sesión, 7 paneles integrados, Promise.all, mounted-guard, copy niveles, 4 rows de verificación, authedFetch, 2 pasos flujo teléfono, devCode en dev, FileReader DNI, 7 toggles completos, debounce 500ms, role=switch, barras de uso con colores, auto-exclusión [7,30,90], advertencia balance > 0), `ss6-ss7-conventions.test.ts` (22: authedFetch en 7 nuevos archivos, ConfirmarEliminar usa fetch directo, force-dynamic en 12 RSC/endpoints, admin rol check, Zod en 10 endpoints, equipo@hablaplay.com, fire-and-forget, PerfilRefreshOnUpdate event dispatch).

**Smoke esperado:** `pnpm test` 712 passing + 7 skipped (Prisma integration) en 42 archivos; `pnpm exec tsc --noEmit` limpio; `pnpm lint` sin warnings. El smoke end-to-end del flujo (registrar → jugar → ganar → recibir email → canjear → ver en admin → marcar enviado → recibir email → editar perfil → cambiar preferencia → refresh persiste → cambiar límite → intentar exceder → ver error) requiere Docker Compose + seed + cuenta real Resend y Twilio (o dev mode) — se deja para QA del Sprint 8. Migración `20260420120000_add_perfil_premios_limites` corre limpia sobre BD vacía. Seed genera 25 premios + admin + (el usuario jugador se crea al registrarse con magic link).

### 🔧 Hotfix #9 21 Abr — Seed de premios en producción + acceso a /perfil desde navegación

Smoke testing en prod (`habla-app-production.up.railway.app`) post-deploy del Sub-Sprint 7 dejó 2 reportes del PO que apuntan a brechas entre lo documentado en CLAUDE.md y lo que el usuario real ve. El primero (#24) es un bloqueador crítico del MVP — la tienda está vacía y rompe el loop "ganás → canjeás". El segundo (#25) es una brecha de UX — todo el Sub-Sprint 7 vive detrás del avatar dropdown del UserMenu sin entrada visible en la navegación mobile.

**Bug #24 — `/tienda` vacía en producción.** El seed de `packages/db/prisma/seed.ts` documentado en Sub-Sprint 6 nunca corrió contra la BD de Railway. Causa raíz doble: (a) el seed solo se invoca con `pnpm db:seed` local, no hay trigger automático en `railway.toml`, `Dockerfile`, ni `.github/workflows/deploy.yml`; (b) el archivo hacía `prisma.canje.deleteMany({})` + `prisma.premio.deleteMany({})` antes del loop de create — un tiro de pie potencial si se dispara en prod (destrozaría el historial de canjes real). Resultado: la tabla `premios` quedó vacía post-deploy, `listarPremios()` devolvía `[]`, y el grid de `/tienda` mostraba "No hay premios en esta categoría" en las 5 categorías a pesar de que el código funcionaba perfectamente. Sin catálogo, el usuario que gana Lukas no tiene dónde gastarlos → loop del §16 roto.

**Fix en 5 piezas:**
1. **Catálogo compartido — `packages/db/src/catalog.ts`** (nuevo). Exporta `CATALOGO_PREMIOS: ReadonlyArray<CatalogoPremio>` con los 25 premios + tipos `CatalogoCategoria`, `CatalogoBadge`, `CatalogoPremio`. Re-exportado desde `@habla/db` vía `packages/db/src/index.ts` para que tanto la seed local como los endpoints de admin/apps/web lo consuman sin duplicación. Fuente de verdad única — prohibido copiar el literal del catálogo en otro lugar.
2. **Service idempotente — `apps/web/lib/services/premios-seed.service.ts`** (nuevo). `sembrarCatalogoPremios()` recorre `CATALOGO_PREMIOS` y para cada item hace `prisma.premio.findFirst({where: {nombre}})` + `update` si existe / `create` si no. Sin `deleteMany`, sin transacción gigante: per-premio independiente, idempotente por name (garantizado único en el catálogo — test antidrift verifica). Devuelve `{creados, actualizados, totalCatalogo, totalEnBD, ejecutadoEn}`. Correr el service 10 veces seguidas deja 25 premios, no 250 — cada entrada posterior cae al branch `update`. Logs estructurados con Pino (§14). `obtenerStatusCatalogo()` hace tres queries en paralelo (count total activo, count con stock, groupBy por categoría) y devuelve `{totalPremios, conStock, porCategoria, catalogoEsperado, faltaSembrar}`.
3. **Endpoint admin — `POST /api/v1/admin/seed/premios`** (nuevo) + **`GET /api/v1/admin/seed/premios/status`** (nuevo). Ambos con `dynamic = "force-dynamic"`, auth ADMIN obligatoria (`NoAutenticado` 401 sin sesión, `NoAutorizado` 403 si rol !== ADMIN), delegación al service correspondiente, `toErrorResponse` + `logger.error` para errores. Patrón idéntico al `POST /api/v1/admin/torneos/:id/reconciliar` del Hotfix #7.
4. **UI admin — `components/admin/AdminSeedPremiosPanel.tsx`** (nuevo, client component) + montado en `apps/web/app/admin/page.tsx`. Al montar llama el endpoint de status; muestra "En BD: 25/25", "Con stock: X", breakdown por categoría, y una banda naranja ⚠️ con "El catálogo está incompleto" cuando `faltaSembrar=true`. Botón "Sembrar catálogo" dispara POST via `authedFetch` (§14); al éxito muestra banda verde con contadores `{creados, actualizados, totalEnBD}` y refresca el status. Permite al admin sembrar en producción con un click desde el panel sin Railway CLI.
5. **Seed legacy refactor — `packages/db/prisma/seed.ts`**. Importa `CATALOGO_PREMIOS` de `../src/catalog` (ruta relativa porque el archivo vive dentro del package), sigue creando/upserteando el usuario admin, y reemplaza el loop `deleteMany + create` por el mismo pattern `findFirst + update|create`. Re-correr `pnpm db:seed` en dev ya NO borra canjes/premios — permite re-sembrar sobre BDs con datos de testing sin wipe accidental.

**Decisión entre opciones A/B/C/D:** el prompt ofrecía 4 mecanismos de ejecución. Elegí **opción B (endpoint admin one-shot)** por: (a) mayor idempotencia (upsert por nombre, 25 premios estables); (b) menor riesgo de ejecución accidental (requiere sesión ADMIN activa, no corre automáticamente); (c) mejor DX para re-correr cuando cambie el catálogo (un click desde `/admin` vs. `railway run pnpm db:seed`). Alternativas descartadas: A (deploy script) regenera el catálogo en CADA deploy incluso sin cambios, riesgoso para datos manuales; C (standalone script via `railway run`) requiere Railway CLI + shell access no self-service; D (Prisma data migration) las migraciones son para schema, una migración de datos queda en el historial y es fragil rollback.

**Bug #25 — `/perfil` invisible en la nav mobile.** Verificado que el UserMenu desktop YA tenía `<Link href="/perfil" role="menuitem">Mi perfil</Link>` — accesible en 2 clicks (avatar → Mi perfil). Pero: (a) el dropdown del avatar no es obvio en mobile; (b) el BottomNav mobile solo tenía 5 items — Partidos, En vivo, Tickets, Tienda, Wallet — ninguno linkeaba a /perfil; (c) todo el Sub-Sprint 7 (verificación de teléfono/DNI, 7 toggles de notificación, límites de juego responsable, auto-exclusión, eliminar cuenta, exportar datos) quedaba invisible en la UI mobile.

**Fix mínimo con preservación del mockup:** `components/layout/BottomNav.tsx` reemplaza el item "Wallet" (último slot) por "Perfil" con ícono 👤 y match `p.startsWith("/perfil")`. Wallet sigue accesible en 1 tap desde el `BalanceBadge` del header (un `<Link href="/wallet">` siempre visible en el NavBar desktop y mobile — verificado en `components/layout/BalanceBadge.tsx`). Se preservan los 5 slots del mockup (estándar UX mobile). El UserMenu desktop sigue intacto (respeta la estructura original del mockup). No se agregó "Perfil" como 6° link del NavBar desktop: rompería la fidelidad al mockup y el UserMenu ya cumple el target ≤2 clicks.

**Decisiones descartadas para Bug #25:**
- *Agregar 6° item al BottomNav* → layout cramped en 375px, rompe estándar mobile de 4-5 items.
- *Perfil como 6° link del NavBar desktop* → rompe mockup §10; UserMenu ya cumple ≤2 clicks.
- *Solo exponerlo desde UserMenu (status quo pre-Hotfix)* → el dropdown del avatar no es un pattern claro en mobile; la entrada visible mejora discoverability significativamente.
- *Agregar indicador rojo de "verificaciones pendientes" sobre el avatar* → valioso pero fuera de scope del hotfix; documentado como TODO futuro en §15.

**Tests nuevos (47 casos):**
- `tests/premios-seed.test.ts` (33): `CATALOGO_PREMIOS` exporta exactamente 25 premios, cubre las 5 categorías, 1 featured único, 3 badges (POPULAR/NUEVO/LIMITADO), ≥8 con `requiereDireccion`, nombres únicos (precondición de idempotencia), `valorSoles < costeLukas` siempre, catalog.ts exporta los 3 tipos. Service: importa de `@habla/db` (no duplica), NO usa `deleteMany`, usa `findFirst + update|create`, exporta `sembrarCatalogoPremios` + `obtenerStatusCatalogo`, devuelve contadores estructurados, loguea con Pino, groupBy por categoría. Endpoints POST + GET: requieren `NoAutenticado` + `NoAutorizado` con rol ADMIN, delegan al service, exportan `force-dynamic`, usan `toErrorResponse` + `logger.error`. Legacy seed: importa CATALOGO_PREMIOS, NO contiene `deleteMany` de canje/premio, usa findFirst + update|create, sigue upserteando admin. Admin panel UI: es client component, usa `authedFetch` (§14), NO hace `fetch("/api/v1` directo, está montado en `/admin/page.tsx`, muestra badge cuando `faltaSembrar`, muestra contadores post-seed.
- `tests/perfil-nav-access.test.ts` (14): BottomNav tiene item con `href: "/perfil"`, label "Perfil", match `startsWith("/perfil")`; Wallet NO está en BottomNav; exactamente 5 items; BalanceBadge preserva `href="/wallet"` (Wallet sigue accesible). UserMenu tiene `<Link href="/perfil">Mi perfil</Link>` con `role="menuitem"` + `setAbierto(false)` onClick. Middleware: `/perfil/:path*` en PROTECTED_MATCHERS + config.matcher sin drift. `/perfil/page.tsx`: exporta `force-dynamic`, llama `auth()`, redirige a `/auth/login` si no hay sesión.
- Actualizado `tests/premios.service.test.ts` (9, sin cambio de count): apunta al nuevo `packages/db/src/catalog.ts` en vez de `seed.ts`, usa regex `categoria:\s*["']X["']` en vez de `"X" as const` (el catálogo usa tipo fuerte en vez de literal-inline).

**Smoke esperado:** `pnpm test` 759 passing + 7 skipped (+47 vs baseline 712) en 44 archivos; `pnpm exec tsc --noEmit` limpio; `pnpm lint` sin warnings. Para cerrar la brecha en producción: (1) un admin con sesión activa en `habla-app-production.up.railway.app/admin` clickea "Sembrar catálogo" en el panel (o hace `POST /api/v1/admin/seed/premios` con cookies); (2) el endpoint responde `{creados: 25, actualizados: 0, totalEnBD: 25}`; (3) `/tienda` en prod renderiza los 25 premios con chips de categoría funcionales. Si más adelante el catálogo cambia (nuevos productos, nuevos precios), el admin re-clickea y el endpoint solo actualiza lo que cambió sin duplicar.

---

## 9. SPRINT DE MECÁNICA DE JUEGO

> Bloque grande de trabajo: del 25 de abril al 5 de junio. Dividido en 6 sub-sprints semanales que van conectando todas las piezas del producto. Al final de este bloque, un usuario peruano cualquiera puede entrar a Habla!, comprar Lukas, jugar un torneo, ver el partido con ranking en vivo, y recibir su premio automáticamente.

### Principio rector
**Construir de afuera hacia adentro**, siguiendo el flujo del usuario real. Cada sub-sprint deja una parte del producto totalmente funcional (backend + frontend + integraciones), no features a medias.

### Dependencias entre sub-sprints
```
Sub-Sprint 2 (Lukas) ──┬──> Sub-Sprint 3 (Torneos) ──> Sub-Sprint 4 (Combinadas)
                       │                                        │
                       │                                        ▼
                       │              Sub-Sprint 5 (Motor + Ranking en vivo)
                       │                                        │
                       │                                        ▼
                       └──────────> Sub-Sprint 6 (Premios + Tienda + Notif)
                                                                │
                                                                ▼
                                            Sub-Sprint 7 (Perfil + Juego responsable)
```

---

### 🟦 SUB-SPRINT 2 — LUKAS & PAGOS (25 Abr – 1 May)

**Objetivo:** El usuario puede comprar Lukas, ver su balance en todos lados y revisar su historial.

**Páginas a terminar:**
- `/wallet` — Balance hero + mini stats + sección comprar (4 packs) + legal note + historial filtrable
- NavBar — Badge de balance conectado a datos reales

**Backend:**
- Módulo `lukas`: service con transacciones atómicas, balance, historial
- Módulo `pagos`: integración Culqi checkout + webhook
- Validación de límite mensual de compra (llama módulo `limites`)
- Cálculo de bonus por pack (20→+0, 50→+5, 100→+15, 250→+50)

**Endpoints nuevos:**
```
GET  /lukas/balance                      → { balance }
GET  /lukas/historial?tipo=&page=        → { transacciones[], total }
POST /lukas/comprar                      → { transaccion, nuevoBalance }
POST /webhooks/culqi                     → 200 OK (valida firma)
```

**Frontend conecta:**
- `useLukasStore` se hidrata con el balance al login
- `NavBar` escucha cambios del store
- Click en pack → abre Culqi.js → recibe token → POST /lukas/comprar
- Filter chips del historial filtran en backend (query param)
- Toast de éxito + refresh de balance tras compra

**Criterios de aceptación:**
- [ ] Tarjeta sandbox `4111 1111 1111 1111` acredita Lukas en BD
- [ ] Tarjeta rechazada muestra error sin descontar
- [ ] Webhook valida firma `CULQI_WEBHOOK_SECRET`
- [ ] Balance visible en NavBar + /wallet + /perfil es el mismo
- [ ] Historial muestra al menos: compra, bonus por compra, bonus bienvenida
- [ ] Compra que excedería límite mensual → se bloquea con mensaje

---

### 🟦 SUB-SPRINT 3 — TORNEOS (2 May – 8 May)

**Objetivo:** Admin crea torneos. Usuarios los ven, filtran por liga, y se inscriben.

**Páginas a terminar:**
- `/matches` — Filter chips funcionales, match cards por urgencia, sección finalizados, sidebar sticky
- `/torneo/:id` — Detalle con reglas de puntaje + CTA "Crear combinada"
- `/admin` — Crear torneo seleccionando partido de api-football + configurando tipo y entrada

**Backend:**
- Módulo `torneos`: CRUD + inscripción + listado con filtros
- Módulo `partidos`: import de partidos programados desde api-football (admin dispara)
- Job `cerrar-torneos.job.ts`: corre cada minuto, cierra torneos cuya fecha_cierre <= ahora
- Job de cancelación: si un torneo cerró con <2 inscritos, se cancela y reembolsa
- Cálculo de urgencia para el frontend (crítico: <15min, alto: <1h, med: <3h, bajo: >3h)

**Endpoints nuevos:**
```
GET  /torneos?estado=&liga=&page=         → { torneos[], pagination }
GET  /torneos/:id                          → { torneo, misPosicion? }
POST /torneos/:id/inscribir                → { ticket, nuevoBalance }
POST /admin/partidos/importar              → { partidosImportados }
POST /admin/torneos                        → { torneo }
GET  /admin/partidos/disponibles           → { partidos[] }
```

**Frontend conecta:**
- `/matches` llama `GET /torneos` con filtros de chip activos
- Filter chips usan `filterChip()` que refetchea datos
- Contador de "cierra en X min" se calcula en frontend con `cierreAt`
- Click en match card con CTA "Crear combinada" → abre modal (sprint 4) con torneoId pre-cargado
- Sidebar sticky muestra top del día (query a ranking de torneo más grande del día)

**Criterios de aceptación:**
- [ ] Admin crea un torneo y aparece en `/matches` al instante
- [ ] Filter chip "Liga 1 Perú" muestra solo torneos de esa liga
- [ ] CTA "Inscribirme" muestra error si balance insuficiente
- [ ] A los 5 min antes del partido, el CTA se deshabilita y dice "Cerrado"
- [ ] Torneo con 1 solo inscrito → cancela + reembolsa + email al usuario
- [ ] Sidebar muestra solo torneos con partidos en vivo o próximos (<2h)

---

### 🟦 SUB-SPRINT 4 — COMBINADAS (9 May – 15 May)

**Objetivo:** Usuarios arman y envían sus tickets de 5 predicciones. Ven todos sus tickets agrupados.

**Páginas a terminar:**
- Modal centrado de combinada (desde `/matches`, `/torneo/:id`, `/live-match`)
- `/mis-combinadas` — Stats summary (5 métricas) + 3 tabs (Activas/Ganadas/Historial) + match groups

**Backend:**
- Módulo `tickets`: crear ticket con validaciones + listar con filtros
- Constraint de unicidad (ya en schema) + manejo de error amigable
- Validación de límite diario de tickets
- Job que marca tickets como CERRADOS cuando su torneo cierra

**Endpoints nuevos:**
```
POST /tickets                              → { ticket, nuevoBalance }
GET  /tickets/mis-tickets?estado=&page=    → { tickets[] con torneo y partido }
GET  /tickets/stats                        → { jugadas, ganadas, acierto, neto, mejor }
```

**Frontend conecta:**
- `ComboModal` abre centrado (desktop) o fullscreen (mobile) con animación scaleIn
- Panel de puntos máx se calcula client-side mientras selecciona opciones
- Submit: POST /tickets → cierra modal → toast de éxito → balance actualizado
- `/mis-combinadas` agrupa tickets por torneo (query agrupa backend o frontend)
- Stats summary usa `GET /tickets/stats`
- Tab "Activas" filtra `estado IN (ABIERTO, CERRADO, EN_JUEGO)`
- Tab "Ganadas" filtra `premioLukas > 0`
- Tab "Historial" filtra `estado IN (FINALIZADO, CANCELADO)` con expandible por partido

**Criterios de aceptación:**
- [ ] Modal impide enviar si falta alguna de las 5 predicciones
- [ ] Ticket idéntico a uno previo → error "Ya enviaste esta combinada"
- [ ] Al enviar ticket 11 → error "Máximo 10 tickets por torneo"
- [ ] Si el torneo cerró entre abrir el modal y enviar → error "Torneo cerrado"
- [ ] Predicciones en mis-combinadas muestran estado: gris (pendiente), verde (acertó), rojo (falló)
- [ ] Stats summary refleja la realidad: juego 3 → jugadas 3, gano 1 → ganadas 1
- [ ] Match group enlaza al `/live-match` si el partido está en vivo

---

### 🟦 SUB-SPRINT 5 — MOTOR DE PUNTUACIÓN + RANKING EN VIVO (16 May – 22 May)

**Objetivo:** Durante un partido, los puntos se recalculan en vivo, el ranking se actualiza y los usuarios lo ven en tiempo real sin recargar.

**Páginas a terminar:**
- `/live-match` — Hero estadio + mi ticket + 3 tabs (Ranking/Stats/Events) + switcher entre partidos live + expand "ver todos"
- Sidebar sticky de `/matches` — Live mini cards con score en vivo
- `/mis-combinadas` — Actualización live de puntos en tickets activos

**Backend:**
- Job `poller-partidos.job.ts`: cada 30s llama api-football para cada partido EN_VIVO o PROGRAMADO <15min
- Mapper `partidos.mapper.ts`: traduce eventos de la API a nuestros tipos internos
- Motor `puntuacion.service.ts`: recalcula todos los tickets de un torneo cuando hay evento nuevo
- Servicio `ranking.service.ts`: genera ranking ordenado + calcula premios estimados por posición
- Redis: sorted sets por torneoId con score = puntosTotal
- WebSocket: sala por torneoId, emite `ranking:update` y `partido:evento`

**Endpoints nuevos:**
```
GET  /torneos/:id/ranking?page=&limit=      → { ranking[], miPosicion?, totalInscritos }
GET  /partidos/:id/eventos                  → { eventos[] en orden cronológico }
GET  /partidos/:id/stats                    → { home: {...}, away: {...} }
GET  /live/matches                          → { partidos en vivo }
```

**Eventos WebSocket:**
```
CLIENTE → SERVIDOR:
  socket.emit('join:torneo', { torneoId })
  socket.emit('leave:torneo', { torneoId })

SERVIDOR → CLIENTE:
  'ranking:update'     { torneoId, ranking[], totalInscritos, minutoPartido }
  'partido:evento'     { torneoId, tipo, equipo, minuto, marcador }
  'torneo:cerrado'     { torneoId }
  'torneo:finalizado'  { torneoId, ganadores[] }
```

**Frontend conecta:**
- `useRankingEnVivo(torneoId)` abre socket y suscribe al torneo
- Cada `ranking:update` actualiza el state del ranking con animación sutil
- Cada `partido:evento` muestra notificación flotante y actualiza chips de predicciones
- Switcher entre live matches carga el torneo nuevo y hace join al nuevo socket
- Tab "Stats" llama `GET /partidos/:id/stats` y refresca cada 30s
- Tab "Events" llama `GET /partidos/:id/eventos` y actualiza con cada evento nuevo
- Botón "Ver todos los 312 jugadores" llama `GET /torneos/:id/ranking?limit=312`

**Criterios de aceptación:**
- [ ] Al marcarse un gol, los puntos se recalculan en **<2s** y llegan al cliente vía WS
- [ ] Si la API de fútbol falla durante un minuto, los puntos quedan "pendientes" y se resuelven al restaurar
- [ ] El ranking muestra la posición del usuario destacada (fila azul)
- [ ] Los chips cambian color conforme los eventos van confirmando/descartando predicciones
- [ ] Stats del partido (posesión, tiros, tarjetas) se ven actualizados
- [ ] Eventos se listan en cronología con nombres de jugadores
- [ ] Switcher entre partidos live no corta la conexión (leave + join correcto)
- [ ] Test de carga: 500 clientes en el mismo torneo sin caídas

---

### 🟦 SUB-SPRINT 6 — PREMIOS + TIENDA + NOTIFICACIONES (23 May – 29 May)

**Objetivo:** Al finalizar el partido, los premios se distribuyen automáticamente. Los usuarios canjean sus Lukas en la tienda. Reciben emails de eventos clave.

**Páginas a terminar:**
- `/tienda` — Shop stats + featured + category filters + prize grid con progress bars + CTA
- `/live-match` (estado finalizado) — Pantalla final con ranking de ganadores y premios
- `/mis-combinadas` tab "Ganadas" — Cards doradas con trofeos y premios ganados
- Email templates (Resend)

**Backend:**
- Job `distribuir-premios.job.ts`: corre al recibir evento FIN_PARTIDO del partido
  1. Marca torneo como FINALIZADO
  2. Calcula posiciones finales con desempates
  3. Distribuye Lukas según `distribPremios` (35/20/12/33%)
  4. Crea transacciones PREMIO_TORNEO atómicas
  5. Dispara emails a ganadores
- Módulo `premios`: catálogo con filtros por categoría
- Módulo `canjes`: solicitud de canje + gestión desde admin
- Módulo `notificaciones`: despacho de emails con preferencias del usuario

**Endpoints nuevos:**
```
GET  /premios?categoria=                    → { premios[] con afordabilidad calculada }
POST /premios/:id/canjear                   → { canje, nuevoBalance }
GET  /canjes/mis-canjes                     → { canjes[] con estado }
GET  /admin/canjes?estado=                  → { canjes[] pendientes }
PATCH /admin/canjes/:id                     → { canje actualizado }
```

**Templates de email (Resend):**
- `premio-ganado.tsx` — "🏆 ¡Ganaste 3,444 Lukas en Man U vs R. Madrid!"
- `canje-solicitado.tsx` — "Tu canje de [Premio] está siendo procesado"
- `torneo-cancelado.tsx` — "Tu torneo fue cancelado, te reembolsamos 5 Lukas"

**Frontend conecta:**
- `/tienda` llama `GET /premios` con categoría activa
- Cada prize card calcula si es afordable según balance (frontend)
- Click en "Canjear" → modal de confirmación → POST /premios/:id/canjear → toast
- Progress bar se renderiza con `Math.min(100, balance / costeLukas * 100)`
- Tab "Ganadas" de mis-combinadas filtra por `premioLukas > 0`
- Al finalizar un partido, `/live-match` muestra pantalla final con top 10 + premios

**Criterios de aceptación:**
- [ ] Al marcarse FIN_PARTIDO, los premios se distribuyen en **<5s**
- [ ] Cada ganador recibe transacción PREMIO_TORNEO en su wallet
- [ ] Email se envía solo si `preferencias.notifPremios = true`
- [ ] Tienda muestra todas las categorías con filtro funcional
- [ ] Canje exitoso descuenta Lukas y crea registro PENDIENTE
- [ ] Admin panel muestra canjes pendientes y puede cambiar a ENVIADO
- [ ] Si usuario intenta canjear algo que no puede pagar → 400 con mensaje claro
- [ ] Progress bar actualiza al subir el balance (post-compra o post-premio)

---

### 🟦 SUB-SPRINT 7 — PERFIL + JUEGO RESPONSABLE (30 May – 5 Jun)

**Objetivo:** Usuario gestiona su cuenta completa. Los límites de juego responsable están vivos y bloquean acciones cuando corresponde. Las notificaciones respetan las preferencias.

**Páginas a terminar:**
- `/perfil` — Hero con nivel + stats + quick access + verificación + datos + notificaciones + juego responsable + seguridad + ayuda + legal
- Flujo de verificación de teléfono (SMS con Twilio)
- Flujo de verificación de DNI (subida de imagen)

**Backend:**
- Módulo `usuarios`: CRUD propio perfil, edición de datos
- Módulo `verificacion`: envío de código SMS y confirmación
- Módulo `limites`: CRUD de límites + enforcement en compra y tickets
- Módulo `notificaciones`: CRUD de preferencias
- Cálculo de **nivel** basado en torneos jugados:
  - 0-10: 🥉 Novato
  - 11-50: 🥈 Intermedio
  - 51-200: 🥇 Pro
  - 200+: 👑 Leyenda

**Endpoints nuevos:**
```
GET   /usuarios/me                            → { usuario completo con stats y nivel }
PATCH /usuarios/me                            → { usuario actualizado }
POST  /verificacion/telefono/enviar           → { codigoEnviado }
POST  /verificacion/telefono/confirmar        → { verificado: true }
POST  /verificacion/dni/subir                 → { imagenSubida }
GET   /notificaciones/preferencias            → { preferencias }
PATCH /notificaciones/preferencias            → { preferencias actualizadas }
GET   /limites                                → { limites + uso actual }
PATCH /limites                                → { limites actualizados }
POST  /limites/auto-exclusion                 → { bloqueadoHasta }
POST  /usuarios/me/datos-download             → { archivoUrl } (job async)
POST  /usuarios/me/eliminar                   → { solicitudCreada }
```

**Frontend conecta:**
- Perfil hero calcula nivel y progreso al siguiente
- Stats grid usa `GET /tickets/stats` + balance
- Cada toggle hace `PATCH /notificaciones/preferencias` con debounce 500ms
- Slider de límite edita valor y hace PATCH al soltar
- Click en "+Agregar" de teléfono → modal con input + código SMS
- Click en verificar DNI → input file + preview + submit
- Click en "Descargar mis datos" → dispara job async + email con el link

**Criterios de aceptación:**
- [ ] Al cambiar un toggle, la preferencia persiste al refresh
- [ ] Si el usuario apaga "Premios ganados", no recibe email al ganar
- [ ] Compra que excedería límite mensual → error "Excede tu límite de S/ 300/mes"
- [ ] Ticket 11 (si límite es 10) → error "Máximo 10 tickets por día"
- [ ] Nivel Intermedio muestra "Llevas 24 torneos, te faltan 27 para 🥇 Pro"
- [ ] Verificación teléfono: código llega por SMS, validar con Twilio real
- [ ] Auto-exclusión 7 días bloquea login hasta que termine
- [ ] Cerrar sesión limpia session y redirige a /
- [ ] Eliminar cuenta crea solicitud y envía email de confirmación

---

### 🔚 SPRINT 8 — QA + TEST DE CARGA + BETA (6-10 Jun)

**Objetivo:** El producto está sólido, probado y listo para el Mundial.

- Testing end-to-end con Playwright: flujos críticos (registro→comprar→inscribir→jugar→canjear)
- Test de carga con k6: 500 usuarios simultáneos en un torneo activo durante 90 min
- Fix de bugs críticos encontrados
- Beta cerrada con 15 influencers: cuentas con 2,000 Lukas de cortesía
- Ajuste final de copy, imágenes, favicon
- Verificar Sentry captura errores, Grafana muestra métricas
- Plan de contingencia documentado (API-Football cae, Culqi rechaza, Railway se satura)

### 🚀 GO LIVE (11 Jun 2026)

**Día 1 del Mundial FIFA 2026.**
- Deploy a producción verificado
- Monitoreo 24/7 durante el primer partido
- Torneo gratuito de bienvenida (entrada 0 Lukas) para el partido inaugural
- Campaña de marketing activa en TikTok/Instagram
- Canal de soporte directo por WhatsApp

---

## 10. DISEÑO UI — MAPA DE PANTALLAS

> Referencia interactiva: `docs/habla-mockup-completo.html` (también accesible en `/mockup.html`).
> **Este mockup es la fuente de verdad del diseño**. Cada sprint debe replicarlo fielmente.

### Paleta de marca

El sistema de diseño está definido en `apps/web/tailwind.config.ts` y replicado como custom properties en `apps/web/app/globals.css`. Todos los componentes deben usar estos tokens (prefijos `brand-*`, `urgent-*`, `accent-*`, `dark-*`, `pred-*`); queda prohibido hardcodear colores en JSX/CSS.

**Core:** Azul `#0052CC` (`blue-main`) · Navy `#001050` (`blue-dark`) · Azul medio `#0038B8` (`blue-mid`) · Azul claro `#1A6EFF` (`blue-light`) · Dorado `#FFB800` (`gold`) · Dorado tenue `rgba(255,184,0,.15)` (`gold-dim`).

**Estados:** Verde `#00D68F` (`green`) · Rojo live `#FF3D3D` (`live`) · Naranja `#FF7A00` (`orange`).

**Urgencia (match cards por tiempo de cierre):** Crítico `#FF2E2E` (<15min) · Alto `#FF7A00` (<1h) · Medio `#FFB800` (<3h) · Bajo `#7B93D0` (>3h). Cada uno con su variante `-bg` pastel (`#FFE5E5`, `#FFEDD5`, `#FFF3C2`, `#EEF2FF`).

**Acento por tipo de torneo:** Mundial `#8B5CF6` · Clásico `#DC2626` · Libertadores `#059669`. Cada uno con su `-bg` (`#F3E8FF`, `#FFEBEB`, `#D1FAE5`). Se usan en `type-badge type-mundial/clasico/liberta`.

**Dark surfaces** (para header, heros tipo estadio, live-match): `#001050` (`dark-surface`) · `#0A2080` (`dark-card`) · `#0D2898` (`dark-card-2`) · `#1A3AA0` (`dark-border`) · `#EEF2FF` (`dark-text`) · `#7B93D0` (`dark-muted`).

**Prediction results (chips):** Acierto `#00D68F` (`pred-correct`) · Fallo `#FF3D3D` (`pred-wrong`) · Pendiente `rgba(0,16,80,.35)` (`pred-pending`). Cada uno con su `-bg`.

**Backgrounds:** `#F5F7FC` (`bg-page`) · `#FFFFFF` (`bg-app`, `bg-card`) · `#F1F4FB` (`bg-subtle`).

**Text & borders:** Texto principal `#001050` (`text-dark`) · Cuerpo `rgba(0,16,80,.85)` (`text-body`) · Atenuado `rgba(0,16,80,.58)` (`text-muted-d`) · Suave `rgba(0,16,80,.42)` (`text-soft`) · Borde ligero `rgba(0,16,80,.08)` (`border-light`) · Borde fuerte `rgba(0,16,80,.16)` (`border-strong`).

**Shadows:** `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl` (escala estándar) + `shadow-gold` y `shadow-urgent` (acentos). Ver valores en el config.

**Radius:** `radius-sm` 8px · `radius-md` 12px · `radius-lg` 16px · `radius-xl` 20px.

Fuentes: **Barlow Condensed** (títulos, scores, números — weights 400/600/700/800/900) + **DM Sans** (cuerpo, botones — weights 400/500/600/700).

---

### 10.1 `/matches` — Home de torneos

**Layout:** 2 columnas en desktop (contenido + sidebar sticky 340px), 1 columna en mobile.

**Contenido principal:**
- Page head: "Partidos de hoy" + sub
- Filter chips de ligas (Todas, Liga 1, Champions, Libertadores, Premier, Mundial) — click filtra backend
- Section bar "⚡ Próximos torneos" con counter "8 abiertos"
- Match cards por **urgencia**:
  - **Crítico** (<15min): borde rojo animado, badge pulsante, CTA rojo
  - **Alto** (<1h): borde naranja, badge naranja
  - **Medio** (<3h): borde dorado sutil
  - **Bajo** (>3h): estilo neutro
- Match card featured (clásicos, finales): más grande, con padding extra
- Section bar "🏆 Ya ganaron hoy" con lista compacta de finalizados con ganadores

**Sidebar sticky:**
- Widget "🔴 En vivo ahora" (hasta 2-3 cards mini con score + puntero del ranking)
- Widget "🏅 Top del día" (4-5 jugadores con más puntos acumulados del día)
- Widget "🪙 Tu balance" con CTAs Comprar + Tienda

---

### 10.2 `/live-match` — Partido en vivo (página dedicada)

**Accede desde:** nav link "🔴 En vivo" en header (contador pulsante), sidebar sticky de `/matches`, bottom nav mobile.

**Estructura:**
- Page head: "🔴 Partidos en vivo" + sub
- **Live match switcher** (tabs con los 2-3 partidos en vivo, incluye score + minuto actual)
- **Hero oscuro tipo estadio** con score gigante en dorado, minuto con dot pulsante, 4 stats (jugadores, pozo, 1er premio, máx pts), timeline compacta de eventos
- **Mi ticket destacado** (card dorado grande) si el usuario tiene combinada activa: posición actual, puntos, predicciones pintadas por estado, premio estimado
- **Tabs** (funcionales): Ranking / Estadísticas / Eventos
- **Ranking (tab default):** tabla con posición + flecha de cambio ↑↓=, avatar + nombre, 5 predicciones como chips (verde/rojo/gris), puntos actuales, premio que se llevaría ahora. Top 1/2/3 con color especial. Mi fila destacada en azul. Línea de corte con ✂️ después del top 10. Botón "Ver todos los X jugadores" que expande la tabla.
- **Estadísticas:** comparación con barras graduadas (posesión, tiros, tarjetas, córners, faltas, offsides, pases).
- **Eventos:** timeline cronológica con minuto, ícono coloreado (gol/amarilla/roja/sub), píldora del equipo, título + detalle.

---

### 10.3 `/torneo/:id` — Detalle de torneo

**Uso:** Ver reglas, pozo, jugadores inscritos antes de inscribirse.

- Header con score VS + meta del partido
- Estado: Abierto / Cerrado / En vivo / Finalizado (con diferentes styling)
- Card de reglas de puntaje (las 5 predicciones con sus pts)
- Info del pozo: bruto, neto, distribución 35/20/12/33%
- CTA "🎯 Crear combinada" (abre modal centrado) o "Ver ranking en vivo" si ya empezó

---

### 10.4 Modal combinada (centrado, grande)

**Se abre desde:** `/matches`, `/torneo/:id`, `/mis-combinadas` (botón "+ Otra combinada").

- Overlay con blur, panel centrado 640px max (full-screen en mobile)
- Header azul con franja dorada animada, nombre del partido, 4 metas (entrada, pozo, 1er premio, cierre)
- Body: 5 cards de predicción con las opciones como botones
  - Resultado: 3 opciones (equipo local / empate / equipo visita)
  - Ambos anotan, +2.5, tarjeta roja: Sí/No
  - Marcador exacto: picker numérico ± por equipo
- Footer: 2 cajas (puntos máx preview + balance después) + botón "🎯 Inscribir por X 🪙"

---

### 10.5 `/mis-combinadas` — Tickets del usuario

- Page head + sub
- **Stats summary** (5 pills): Jugadas, Ganadas, Acierto %, Balance neto, Mejor puesto
- **Tabs:** 🔴 Activas (X) · 🏆 Ganadas (X) · 📜 Historial (X)
- **Vista Activas:** match groups (1 por partido) con:
  - Header: estado (live pulsante / cierra en X min), liga, CTA "Ver ranking" o "+ Otra combinada"
  - Teams row con score
  - Tickets list: cada ticket con número (2 de 2), badge de posición + puntos, 5 chips de predicciones por estado, footer con entrada + estado de premio
- **Vista Ganadas:** match groups con borde dorado, badge "🏆 Ganaste · 1° lugar", trofeo visual, premio destacado
- **Vista Historial:** filas compactas expandibles por click (1 row = 1 partido con X tickets), muestra neto del partido en verde/rojo, expande para ver cada ticket

---

### 10.6 `/tienda` — Catálogo de premios

- Page head "🎁 Tienda de premios"
- **Shop stats** (3 cards): Tu balance, Canjeables ahora, Ya canjeados
- **Nota sutil** sobre Lukas (no efectivo, solo premios)
- **Featured prize** (card grande oscuro con imagen, nombre, descripción, precio dorado, CTA)
- **Category chips** (funcionales): Todos / Entradas / Camisetas / Gift Cards / Tech / Experiencias
- **Prize grid v2:** cada card con:
  - Imagen/emoji con fondo categoría
  - Badge (🔥 Popular / ⭐ Nuevo / 💎 Limitado)
  - Nombre + descripción
  - Precio + stock (rojo si bajo)
  - **Si afordable:** borde verde + botón dorado "✓ Canjear ahora"
  - **Si no afordable:** progress bar dorada al X% + "Te faltan Y 🪙"
- **CTA azul final:** "¿Necesitas más Lukas?" → [Ver partidos] [Comprar Lukas]

---

### 10.7 `/wallet` — Billetera

- Page head "💰 Billetera"
- **Balance hero azul-navy** con amount gigante 500 🪙 + sub "Créditos para canjear premios" + badge de vencimiento
- **Wallet mini stats** (3): Total comprado, Total ganado, Total canjeado
- **Buy section** con header dorado + 4 pack cards: 20 (+0), 50 (+5), 100 (+15 "🔥 Popular"), 250 (+50 "⭐ Mejor valor"). Click selecciona.
- **Legal note** sobre Lukas (créditos, no efectivo, vencimiento 12 meses de compras)
- **Movements section:** título + filter chips (Todos / Compras / Inscripciones / Premios / Canjes / Bonos) + tx-list con icono categorizado + descripción + fecha + amount coloreado
- Botón "Ver los X movimientos restantes"

---

### 10.8 `/perfil` — Centro de control del usuario

**La más densa. Estructura de arriba a abajo:**

1. **Hero azul-navy** con:
   - Avatar 100px dorado + botón 📷 edit flotante
   - Nombre + badge "✓ Verificado"
   - Handle @user + meta (miembro desde, ubicación, edad)
   - **Level card:** 🥈 Intermedio + barra de progreso al siguiente nivel + "Te faltan X torneos"

2. **Stats grid** (6 pills): Torneos, Ganados, Acierto, Balance, Total ganado, Mejor puesto

3. **Quick access** (4 cards): Mis combinadas, Billetera, Tienda, Centro de ayuda

4. **Sección Verificación** (destacada si hay pendientes):
   - ✓ Email — Verificado
   - ✓ Edad — Verificada
   - ⚠ Teléfono — Botón "Agregar"
   - ⚠ DNI — "Requerido para canjes >S/ 500" — Botón "Verificar"

5. **Sección Datos personales** (editables row por row):
   - Nombre, Usuario (@handle), Correo, Teléfono (vacío con botón agregar), Fecha nacimiento (🔒 bloqueado), Ubicación

6. **Sección Notificaciones** (7 toggles):
   - Inicio de torneos, Resultados, Premios, Sugerencias, Cierre, Novedades, Email semanal

7. **Sección Juego responsable:**
   - Límite mensual (S/ 300/mes) con barra de uso
   - Límite diario (10 tickets/día) con barra de uso
   - Auto-exclusión temporal (link)
   - Recursos de ayuda (link)

8. **Sección Seguridad:** Método login, Dispositivos activos, Cuentas vinculadas, Descargar mis datos

9. **Sección Ayuda:** Cómo jugar, FAQ, Contáctanos, Reportar problema

10. **Sección Legal:** Términos, Privacidad, Juego responsable, Sobre los Lukas, Acerca de Habla!

11. **Danger zone:** Botón "🚪 Cerrar sesión" + link pequeño "Eliminar cuenta permanentemente"

12. **Footer:** "Habla! v1.0 · Hecho en Perú 🇵🇪"

---

### 10.9 Componentes comunes (en todas las páginas)

- **NavBar superior:** Logo + nav links (Partidos · 🔴 En vivo · Mis combinadas · Tienda · Billetera) + balance badge + avatar. En mobile: hamburger + bottom-nav.
- **Bottom nav mobile:** Partidos · 🔴 En vivo · Tickets · Tienda · Wallet (5 items).
- **Filter chips:** pattern reutilizable (dorado activo, hover dorado), usa `filterChip()`.
- **Toast:** verde en top center, aparece 3.5s tras acciones exitosas.
- **Alert banners:** alert-info (azul), alert-success (verde), con ícono + texto.
- **Pred chips:** verde ✓ (acertó), rojo ✕ (falló), gris ⏳ (pendiente).
- **Footer:** 4 columnas (Juego, Cuenta, Soporte, Legal) con enlaces.

---

## 11. CONTRATOS DE API — RESUMEN

Base URL dev: `http://localhost:3001/api/v1`. Endpoints protegidos requieren JWT en header `Authorization: Bearer <token>`.

### Auth
```
GET  /auth/me                   → usuario actual con stats y balance
```

### Usuarios
```
GET   /usuarios/me                            → perfil completo + nivel + stats
PATCH /usuarios/me                            → editar datos
POST  /usuarios/me/datos-download             → job async, email con ZIP
POST  /usuarios/me/eliminar                   → solicitud de eliminación
```

### Lukas
```
GET   /lukas/balance                          → balance actual
GET   /lukas/historial?tipo=&page=            → transacciones con filtros
POST  /lukas/comprar                          → token Culqi → acredita Lukas
```

### Torneos
```
GET   /torneos?estado=&liga=&desde=&hasta=&page=   → listado con filtros (UTC ISO 8601)
GET   /torneos/:id                                  → detalle + miTicket (si hay sesión)
POST  /torneos/:id/inscribir                        → crea Ticket placeholder + descuenta entrada
GET   /torneos/:id/ranking?page=&limit=             → ranking paginado con premios estimados + miPosicion
```

### Tickets
```
POST  /tickets                                               → crea ticket (5 predicciones)
GET   /tickets/mis-tickets?estado=ACTIVOS|GANADOS|HISTORIAL  → mis tickets + torneo + partido
GET   /tickets/stats                                         → jugadas, ganadas, aciertoPct, neto, mejorPuesto
```

### Partidos
```
GET   /partidos?fecha=&estado=                → listado con filtros
GET   /partidos/:id                           → detalle + último evento
GET   /partidos/:id/eventos                   → timeline cronológica (asc)
GET   /partidos/:id/stats                     → stats comparadas home/away (cache in-memory 15s)
GET   /live/matches                           → partidos EN_VIVO + top 3 preview por torneo
```

### Realtime
```
GET   /realtime/token                         → JWT HS256 de 5 min para handshake de Socket.io
```

### Premios y canjes (Sub-Sprint 6)
```
GET   /premios?categoria=&soloConStock=            → catálogo + featured
POST  /premios/:id/canjear                         → body: { direccion? } · crea canje atómico → { canje, nuevoBalance }
GET   /canjes/mis-canjes?estado=&limit=&offset=    → canjes del usuario con premio embebido
```

### Usuario y perfil (Sub-Sprint 7)
```
GET   /usuarios/me                                 → perfil completo + nivel + stats
PATCH /usuarios/me                                 → body: { nombre?, username?, ubicacion?, telefono?, image? }
POST  /usuarios/me/eliminar                        → solicita eliminación + email con token 48h
POST  /usuarios/me/eliminar/confirmar              → body: { token } · soft delete + anonimiza PII
POST  /usuarios/me/datos-download                  → dispara email con link a JSON attachment
GET   /usuarios/me/datos-download/file             → attachment con JSON de todos los datos
```

### Notificaciones y límites (Sub-Sprint 7)
```
GET   /usuarios/notificaciones                     → 7 toggles (PreferenciasNotif)
PATCH /usuarios/notificaciones                     → body: { notifXxx?: bool } · upsert
GET   /usuarios/limites                            → límites + uso actual { comprasMesActual, ticketsUltimas24h }
PATCH /usuarios/limites                            → body: { limiteMensualCompra?, limiteDiarioTickets? }
POST  /usuarios/limites/autoexclusion              → body: { dias: 7 | 30 | 90 } · bloqueo temporal
```

### Verificación (Sub-Sprint 7)
```
POST  /usuarios/verificacion/telefono              → body: { telefono } · envía código 6 dígitos (SMS o email fallback) · TTL 10 min
POST  /usuarios/verificacion/telefono/confirmar    → body: { codigo } · valida hash SHA-256 · máx 3 intentos
GET   /usuarios/verificacion/dni                   → estado actual (NO_SUBIDO|PENDIENTE|APROBADO|RECHAZADO)
POST  /usuarios/verificacion/dni                   → body: { dniNumero, imagenBase64, mimeType? } · upload local pendiente revisión admin
```

### Admin (rol ADMIN)
```
POST  /admin/partidos/importar                → dispara import de api-football
POST  /admin/torneos                          → crear torneo
POST  /admin/torneos/:id/reconciliar          → Hotfix #7 Bug #20 · recalcula puntos + re-distribuye + acredita deltas
GET   /admin/metricas                         → dashboard: inscriptos, pozos, rake
GET   /admin/canjes?estado=                   → canjes pendientes
PATCH /admin/canjes/:id                       → cambiar estado
```

### Webhooks
```
POST  /webhooks/culqi                         → confirmación pago (valida firma)
```

---

## 12. EVENTOS WEBSOCKET

Socket.io montado sobre **Next.js custom server** (`apps/web/server.ts`, no Fastify — ver §15). Corre en el mismo proceso y puerto que la app Next. Path `/socket.io`.

Handshake auth: cliente hace `GET /api/v1/realtime/token` para recibir un JWT HS256 (5 min, firmado con `AUTH_SECRET`) y lo pasa como `auth.token` en el `io()`. Sin token la conexión se acepta como anónima (`socket.data.usuarioId = null`) y puede leer rankings en vivo. Con token inválido, se rechaza. Sala por `torneo:{torneoId}`.

**Cliente → Servidor:**
- `join:torneo` `{ torneoId }`
- `leave:torneo` `{ torneoId }`

**Servidor → Cliente:**
- `ranking:update` `{ torneoId, ranking[], totalInscritos, pozoNeto, minutoPartido, timestamp }`
- `partido:evento` `{ torneoId, partidoId, tipo, equipo, minuto, jugador, detalle, marcadorLocal, marcadorVisita }`
- `torneo:cerrado` `{ torneoId }`
- `torneo:finalizado` `{ torneoId, ganadores[] }`

El cliente (`lib/realtime/socket-client.ts`) implementa ref-counting sobre los rooms — si dos componentes piden el mismo `torneoId`, el segundo `leave` es el único que efectivamente abandona el room. Reconexión automática con backoff (1s → 10s).

---

## 13. INTEGRACIONES CLAVE

### Culqi (pagos)
- Culqi.js en frontend → token → backend ejecuta cargo con secret key
- Webhook POST `/webhooks/culqi` valida firma con `CULQI_WEBHOOK_SECRET`
- Sandbox: tarjeta aprobada `4111 1111 1111 1111`, rechazada `4000 0000 0000 0002`

### api-football.com (deportes)
- **Header correcto:** `x-apisports-key` (NO `X-RapidAPI-Key`)
- Endpoints clave: `/fixtures?date=`, `/fixtures/events?fixture=`, `/fixtures?live=all`
- Poller cada 30s mientras el partido está EN_VIVO
- Mapper traduce: `Goal → GOL`, `Card/Red → TARJETA_ROJA`, `fixture.status.short=FT → FIN_PARTIDO`

### NextAuth v5 + Resend (auth)
- Magic link vía Resend (dominio hablaplay.com)
- Custom Prisma adapter que mapea `Usuario/nombre` al contrato de NextAuth
- Session JWT (sin roundtrips a BD), balance se lee en callback session
- `trustHost: true` para Railway proxy

### Twilio (SMS)
- Verificación de teléfono con código de 6 dígitos
- Alertas urgentes (opcional, activado por preferencia)

---

## 14. CONVENCIONES DE CÓDIGO

- TypeScript strict en todo el proyecto
- Archivos: kebab-case (`torneo.service.ts`)
- Funciones/variables: camelCase
- Tipos/clases: PascalCase
- Rutas API: `/api/v1/{recurso}` plural, kebab-case
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- Branches: `main` (prod), `develop` (integración), `feat/nombre`
- PR a main: requiere CI verde
- Validación: **Zod** en entrada de datos
- Errores: clases tipadas (nunca `throw new Error('string')`)
- Logs: **Pino** en producción (nunca `console.log`)
- **Fechas y zonas horarias:** prohibido usar `Date.prototype.toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` sobre un `Date` sin `timeZone` explícito dentro de `apps/web/`. Usar los helpers de `lib/utils/datetime.ts` (`formatKickoff`, `formatCountdown`, `getDayKey`, `getDayBounds`, etc.). Default del proyecto: `America/Lima`. Nota: la invocación `Number.toLocaleString("es-PE")` para separador de miles no aplica — no hay fecha, no hay tz.
- **Cero hex hardcodeados fuera de `tailwind.config.ts` y `globals.css`:** todos los colores de fondo/texto/borde en JSX/TSX deben venir de los tokens declarados (prefijos `brand-*`, `urgent-*`, `accent-*`, `dark-*`, `pred-*`, `alert-*`, `medal-*`, etc.). Si un fix necesita un color nuevo, agregar el token al config primero. Únicas excepciones documentadas: (a) atributos SVG `stroke=` / `fill=` donde el color se aplica inline (ver `MatchCardCTA.tsx` TargetIcon/ArrowIcon, `MatchCard.tsx` accent bar por liga); (b) valores `style={{background: ...}}` donde el color se deriva en tiempo de render por un mapper puro (ej. `getLigaAccent`, `getTeamColor`). Cualquier otro hex en `.tsx` debe reventar la revisión. Esta regla la expuso el Bug #1 del hotfix 19 Abr (tokens nested `text-dark-text` no generados por colisión con `textColor.dark` string — deuda del design system a fixear en PR dedicado; mientras tanto, usar `text-white/N` sobre dark surfaces).
- **Cobertura de utilities Tailwind:** antes de usar un token en JSX, verificar que Tailwind lo genere como utility. La colisión entre `textColor.dark: "#001050"` (string flat) y `colors.dark.*` (nested) bloquea la expansión de `text-dark-text` / `text-dark-muted`; intentarlos en un elemento cae al `color: inherit` del body (`text-body` ~0.85 alpha oscuro). Cuando un style requiere color claro sobre dark surface, usar `text-white/N` (ej. `text-white/80`) como workaround oficial hasta que se fixee el config.
- **Fetches client-side a `/api/v1/*` pasan por `authedFetch`:** cualquier `fetch()` desde Client Components u hooks contra el backend debe usar `authedFetch` del helper `apps/web/lib/api-client.ts`. El helper centraliza `credentials: 'include'` y deja un único punto para agregar retry/backoff/headers futuros. El test `tests/auth-protection.test.ts` escanea 8 archivos consumers y revienta ante cualquier `fetch("/api/v1` directo. Si se agrega un endpoint nuevo bajo `/api/v1/*`, incluir su consumer en `ARCHIVOS_VIGILADOS`. Razón: el Bug #3 del Hotfix #2 19 Abr dejó claro que ser explícito sobre cookies elimina ambigüedades ante service workers/polyfills/test mocks y facilita la auditoría.
- **Páginas autenticadas exportan `dynamic = "force-dynamic"`:** las rutas que llaman `auth()` en el RSC y leen datos del usuario (`/wallet`, `/mis-combinadas`) deben exportar `export const dynamic = "force-dynamic"`. Sin esto Next.js puede cachear el RSC de la primera evaluación (posiblemente anónima) y servirlo a requests autenticados, re-disparando el redirect a login aunque la cookie esté OK. Razón: el Bug #3 del Hotfix #2.
- **Balance de Lukas se hidrata al mount del layout `(main)`:** el `useLukasStore` inicializa `balance: 0`. El layout `(main)/layout.tsx` es async, llama `auth()` y pasa `initialBalance={session?.user?.balanceLukas ?? null}` a `<LukasBalanceHydrator>` (client). Este efectúa `setBalance(initialBalance)` en su primer `useEffect`. Cualquier página que cuelgue del grupo `(main)` recibe el balance real antes de que se pueda abrir un ComboModal. Si se agrega otro grupo de layout (ej. `/admin`) con componentes que consuman Lukas, montar el hydrator también. Razón: el Bug #1 del Hotfix #2 — sin hidratación, el modal mostraba "Balance después: -5".
- **Modales DEBEN renderizarse via `createPortal` a `document.body`:** el componente `components/ui/Modal.tsx` aplica `createPortal(overlay, document.body)`. Prohibido refactorizarlo a `return overlay` directo — el modal queda atrapado en cualquier stacking context que cree un ancestor con `transform`, `filter`, `perspective` u `opacity`. El MatchCard aplica `transform: translate-y-px` en hover, lo que invalida `position: fixed` del overlay y produce el bug visual de "modal flicker + page freeze" reportado por el PO. Test de regresión: `tests/modal-portal.test.ts` busca literalmente `createPortal(overlay, document.body)` en el AST; si alguien revierte el fix, reventa. Al agregar un nuevo modal/dialog/popover, usar el mismo `<Modal>` o replicar el patrón de portal. Razón: el Bug #4 del Hotfix #3.
- **`/live-match` excluye partidos sin torneo jugable:** un partido cuyos torneos estén todos en `CANCELADO` (regla: `<2 inscritos` al cierre → cancelar + reembolsar) **no aparece** en la lista de live-matches ni es navegable por `?torneoId`/`?partidoId`. El filtro se basa en `partido.estado EN_VIVO/FINALIZADO` + `torneos.some(estado != CANCELADO)`, preservando la tolerancia al jitter del cron del Hotfix #2 (no filtrar por estados específicos del torneo, solo excluir CANCELADO). Razón: revisión del PO post Hotfix #3 (Bug #8 del Hotfix #4) — mostrar el partido sin torneo activo confundía al usuario que esperaba poder competir. Alternativa descartada: conservar la tolerancia con cartel "sin torneo activo" — hacía más daño que beneficio en UX.

- **Tras toda mutación de Lukas (inscripción, canje, compra, reembolso), el endpoint debe retornar `nuevoBalance` y el cliente propagarlo con `useLukasStore.setBalance`:** el store Zustand es la única fuente de verdad cross-página. Los consumers client-side (`BalanceBadge` del header, `BalancePill` de /mis-combinadas, ComboModal footer) se suscriben al store y re-renderizan automáticamente al cambiar. Queda prohibido derivar balance client-side sumando/restando transacciones sobre un valor hidratado — si el backend dice "te quedan 495", la UI muestra 495, sin que la UI intente recomputar nada. Razón: el Bug #7 del Hotfix #4 — antes el header leía `session.user.balanceLukas` (SSR) y /mis-combinadas mostraba `stats.neto` (lifetime P/L) con label "Balance neto" que para el primer ticket daba -5 🪙, engañando al usuario.

- **UI del minuto de partido en vivo usa `formatMinutoLabel`, nunca renderiza "?" como fallback:** el `LiveHero` recibe `minutoLabel: string | null` (no `minuto: number`) y lo muestra directo. Si llega null/undefined, `renderMinutoLabel` devuelve `"—"`. El label se computa server-side con el mapper puro `lib/utils/minuto-label.ts:formatMinutoLabel({statusShort, elapsed})` que traduce los codes de api-football (HT → "ENT", FT → "FIN", ET → "Prór. {n}'", P → "Penales", AET → "FIN (prór.)", etc.). El poller actualiza el cache in-memory (`live-partido-status.cache.ts`) en cada tick; `emitirRankingUpdate`, el endpoint `/api/v1/live/matches` y el SSR de `/live-match` lo leen. Razón: el Bug #9 del Hotfix #4 — el LiveHero renderizaba `{minuto ?? "?"}'` y el "?" aparecía literal cuando `elapsed` era null (HT, prórroga, pre-WS).

- **`/live-match`: switcher solo muestra EN_VIVO, FINALIZADOS van en sección separada:** el switcher superior (`LiveSwitcher`) lista exclusivamente partidos en curso. Los FINALIZADOS de las últimas 24h viven en una sección propia abajo (`LiveFinalizedSection`) con grid de cards de resumen (score final, equipos, ganador + premio) que linkean al `/live-match?torneoId=<id>`. El filter chips de liga (`LiveLeagueFilter`, Bug #11) filtra **solo el switcher**; los finalizados no se filtran por liga por decisión del PO. Ligas de las chips se derivan dinámicamente de los partidos EN_VIVO actuales, no una lista hardcodeada. Razón: los Bugs #10 y #11 del Hotfix #4 — la mezcla confundía al usuario y el scroll horizontal del switcher se volvía tedioso en días pesados (Mundial, fecha doble).

- **Todo Client Component que RENDERIZA el balance de Lukas lee del `useLukasStore`, nunca de `session.user.balanceLukas` directo:** extensión de la convención del Hotfix #4 a todos los consumers UI. Los Server Components/RSC pueden leer la sesión UNA sola vez y pasar `initialBalance` como prop al Client Component correspondiente (patrón "SSR → Client hydrator" con mounted-guard: `mounted ? storeBalance : initialBalance`). Componentes migrados en los hotfixes: `BalanceBadge` (header), `BalancePill` (/mis-combinadas), `SidebarBalanceWidget` (sidebar de /matches), `WalletBalanceHero` (/wallet). Test de regresión: `tests/balance-sync.hotfix5.test.ts` escanea `components/**` + `app/**` y reventa si algún archivo NO whitelistado contiene `session(?).user(?).balanceLukas`. La whitelist tiene 4 entradas legítimas (layout y 3 páginas RSC que pasan el balance como prop). Razón: el Bug #14 del Hotfix #5 — el sidebar de /matches y el hero de /wallet quedaban stale tras inscripción porque seguían leyendo SSR.

- **`/torneo/:id`: copy del pozo es UN SOLO número con label "Pozo" — prohibido exponer "neto"/"bruto"/"rake" al jugador:** el detalle del torneo muestra el pozo proyectado (o real si está CERRADO+) con label "Pozo del torneo", sin glosario financiero. La distribución se presenta en Lukas absolutos por posición (1° 🥇 X 🪙, 2° 🥈, 3° 🥉, 4°-10° Y 🪙 c/u) sin mostrar porcentajes. Los términos "rake", "pozo bruto" y "pozo neto" existen en código (campos `torneo.pozoBruto`, `torneo.pozoNeto` en BD, helper `buildTorneoDetailViewModel` calcula `pozoMostrado`) pero NO aparecen en copy visible. Test antidrift en `tests/torneo-detail-view.test.ts` busca literales prohibidos como `'Pozo bruto'`, `'Pozo neto'`, `'Rake'`, `'Rake (12%)'`. Razón: el Bug #13 del Hotfix #5 — la versión vieja tenía 3 BigStats "Pozo bruto / Rake / Pozo neto" que mostraban al usuario la mecánica interna de la plataforma, leyéndose como casino; el PO pidió ocultar el mecanismo y quedarnos con un solo valor motivacional.

- **`/torneo/:id`: predicciones de otros inscritos ocultas mientras el torneo está ABIERTO (privacidad competitiva):** el service `listarInscritos(torneoId)` devuelve `{ inscritos, total, mostrarPredicciones }`. Cuando `torneo.estado === 'ABIERTO'`, `mostrarPredicciones=false` y cada `InscritoTicket.predicciones=null` — la UI muestra solo @handle + nivel + cantidad de tickets, sin chips de predicciones ni puntos. Una vez CERRADO/EN_JUEGO/FINALIZADO el service devuelve predicciones + puntos y la UI las pinta. Defensa en profundidad: aunque el caller ignore el campo, el service jamás devuelve las predicciones con estado ABIERTO. Razón: el Bug #13 del Hotfix #5 — dejar expuestas las predicciones antes del cierre habilita que otros copien combinadas ganadoras, destruyendo el meta del juego (todos tirarían la misma predicción popular).

- **Todo launcher del ComboModal comparte `ComboLauncher` + hook `useComboOpener` — prohibido duplicar fetch o state machine del modal:** los puntos de entrada actuales son `MatchCardCTA` (grilla de /matches y /), `ComboLauncher` (usado por /torneo/:id, /mis-combinadas, /live-match, `TorneoStickyCTA`) y `AutoOpenComboFromQuery` (auto-disparo post-login con `?openCombo=<id>`). Todos pasan por `useComboOpener` (hook client que hace el fetch a `GET /api/v1/torneos/:id` vía `authedFetch`, mapea con `buildComboTorneoInfo`, y maneja open/close state). Si aparece un 5to launcher, debe consumir el hook + reusar el `ComboModal` sin re-implementar el fetch. Test antidrift en `tests/torneo-detail-view.test.ts` verifica que `TorneoStickyCTA.tsx` NO tenga `fetch(` ni `authedFetch` directos — todo pasa por el `ComboLauncher`. Razón: consolidación del Hotfix #1 (3 launchers con lógica duplicada) que el Hotfix #5 extiende al nuevo sticky CTA de /torneo/:id.

- **Badge "🔴 En vivo" del NavBar/BottomNav renderiza `null` cuando `count === 0` — NO muestra dot, "0", ni círculo gris:** `LiveCountBadge` aplica `if (count <= 0) return null` como guardia dura. El layout `(main)/layout.tsx` llama `contarLiveMatches()` una sola vez y pasa `initialLiveCount` como prop tanto al NavBar (desktop) como al BottomNav (mobile); el badge polea `/api/v1/live/count` cada 30s para mantenerse fresco sin escuchar el socket (bajo-frecuencia). Counts >9 se colapsan a "9+" para no romper el layout. Test antidrift: `tests/live-count-badge.test.ts` verifica la regla de renderizado condicional, el polling con `authedFetch`, el wiring del layout → navs, y la absencia del viejo `LIVE_COUNT_PLACEHOLDER = 2` hardcoded. Razón: el Bug #12 del Hotfix #5 — mostrar un badge "2" aunque no hubiera partidos era una mentira visual del header (era un TODO del Sub-Sprint 0 que quedó vigente).

- **Título h1 de `/matches` deriva de filtros activos vía `buildMatchesPageTitle`, no es copy fija:** el helper puro `lib/utils/matches-page-title.ts` toma `{liga, dia, now, tz}` y devuelve el título a renderizar: "Todos los torneos" sin filtros, "Torneos de {liga}" con solo liga, "Torneos de hoy" / "Torneos de mañana" / "Torneos del Mié 22" con solo día, "Torneos de {liga} · {día}" con ambos. Nombre de liga se toma del `LIGA_SLUGS` canónico; slugs inválidos caen al default. Los chips de día reusan `formatDayChip` para evitar inconsistencia de formato (mismo mes: "Mié 22", otro mes: "Vie 1 may"). Razón: el Bug #15 del Hotfix #5 — antes el h1 decía literal "Partidos de hoy" aunque el usuario estuviera filtrando "Champions · Mañana", un mismatch confuso que contradecía el estado de la página.

- **Nivel del usuario (🥉/🥈/🥇/👑) se calcula vía `calcularNivel(torneosJugados)` — función pura compartida:** `lib/utils/nivel.ts` mapea cantidad de torneos jugados a uno de 4 niveles con emoji + label + min/max (0-10 Novato, 11-50 Intermedio, 51-200 Pro, 201+ Leyenda). Usado en `InscritosList` de /torneo/:id. Cualquier otro punto del producto que muestre nivel (perfil del Sub-Sprint 7, cards de ganador de /live-match) debe consumir el mismo helper — no reimplementar los escalones. `faltanParaSiguiente(n)` y `siguienteNivel(actual)` cubren el caso del hero "Te faltan X para 🥇 Pro" del perfil. Razón: el Bug #13 del Hotfix #5 — primer uso del helper; consolidarlo acá evita drift cuando el Sub-Sprint 7 lo reuse.

- **Distribución de premios se calcula siempre vía `distribuirPremios` del helper puro `lib/utils/premios-distribucion.ts` — prohibido hardcodear porcentajes de premio (35/20/12/33, 0.45, `n * 0.10`, etc.) en services/components:** el helper encapsula la curva top-heavy del Hotfix #6 (paga 10% de inscritos, 45% al 1°, decaimiento geométrico). Consumers: `ranking.service.ts` (listar + finalizar), `MatchGroup.tsx` (estimado por posición), `LiveMatchView.tsx` (1er premio del hero), `torneo-detail-view.ts` (view-model de `/torneo/:id`), `combo-info.mapper.ts` (estimado del ComboModal via `PREMIO_PRIMER_LUGAR_PCT = 0.45`). Si aparece un nuevo caller, usar el helper o agregar una función pura al módulo — nunca inline math. Test antidrift `tests/premios-distribucion.test.ts` busca literales `0.35`, `0.20`, `0.12` en `ranking.service.ts` + `torneos.service.ts` y revienta si aparecen. Razón: el Hotfix #6 Ítem 1 eliminó la curva vieja; cablear el porcentaje en cualquier lugar rompe la coherencia del producto (ej. el 1er premio del hero muestra un valor y el que se paga al finalizar es otro).

- **Motor de puntuación proyecta TODOS los campos en vivo incluyendo marcador exacto (Hotfix #6 — reversal Sub-Sprint 5):** `calcularPuntosTicket(preds, partido)` es función pura. Durante EN_VIVO:
  - Resultado 1X2: adjudica según score actual.
  - BTTS: `true` si ambos anotaron (irreversible), `false` como proyección mientras alguno tenga 0.
  - +2.5 goles: `true` si goles≥3, `false` como proyección.
  - Tarjeta roja: `true` si `huboTarjetaRoja === true` (irreversible dentro del tick), `false` como proyección mientras sea null/false. Si aparece roja después, el recálculo siguiente revierte los 6 pts de la predicción "No".
  - Marcador exacto: `true` si score actual coincide con la predicción. Proyecta en vivo (antes del Hotfix #6 sólo se adjudicaba al FINALIZADO).
  La volatilidad en rankings es esperada — la UI la comunica con el copy motivacional del ranking en vivo (`buildMotivationalCopy`). Razón: el Bug #4 del Hotfix #6 — jugadores veían "Empate / No / No / No / 0-0" con 0-0 en el marcador y solo sumaban 3 pts de los 21 visibles como acierto. La disonancia rompía la sensación de juego en vivo. Reversal explícito del Sub-Sprint 5 — ganó claridad cognitiva sobre estabilidad numérica.

- **Poller sincroniza eventos (DELETE + INSERT) — nunca solo INSERT:** `sincronizarEventos(partidoId, fixture, eventosApi)` en `poller-partidos.job.ts` compara el set de API con el set de BD. Inserta nuevos, elimina los que BD tiene y API no. Excepción: el evento sintético `FIN_PARTIDO` se preserva al sync (no viene del API). Si el fetch del API falla, el error se propaga antes de llegar al helper y no se toca BD — la defensa está en el throw, no en un guard adicional. Emite `partido:evento-invalidado { torneoId, partidoId, naturalKey }` por cada eliminación para que los clientes remuevan la fila en vivo (el hook `useEventosPartido` consume el evento). El flag `huboTarjetaRoja` de `Partido` también revierte a `false` si el API ya no reporta roja — protege al motor de puntuación de sumar 6 pts fantasmas post-revocación. Razón: el Ítem 2 del Hotfix #6 — goles anulados por VAR o rojas revocadas quedaban huérfanos en BD y la timeline del /live-match los mostraba indefinidamente.

- **Copy motivacional del ranking en vivo (`buildMotivationalCopy`) es la única fuente de verdad para los 4 estados del badge "En el dinero":** `lib/utils/premio-motivacional.ts` expone el helper puro que mapea `{miPuesto, puntosPropios, ranking, M}` → `{emoji, copy, tone, state}`. Estados: `in-money-solo` (gold, "🎯 Único ganador del N° puesto"), `in-money-tie` (gold, "🤝 Empate con X jugadores — premios compartidos"), `close` (muted, "⚡ A N puntos del premio — no te rindas"), `far` (muted, "💪 Sigue sumando — todo se define al final"). Consumidor único actual: `RankingTable.tsx` (fila del usuario). Si otro surface (ej. notificación push, email post-FT) quiere mostrar el estado, debe usar el mismo helper — prohibido duplicar los literales. Test antidrift verifica que `RankingTable.tsx` NO tenga los strings hardcodeados y sí importe del helper. Razón: el Ítem 1.6 del Hotfix #6 — el copy cambia en edge cases (empate, 1 punto del premio) y mantenerlo en un solo helper garantiza que la UX no se degrade por drift.

- **Countdown del MatchCard actualiza en vivo vía `CountdownLabel` (Client Component con `useEffect + setInterval(1s)`) — NO texto server-rendered:** `components/matches/CountdownLabel.tsx` envuelve el label "Cierra en X min" y lo re-calcula cada segundo con `formatCountdown(cierreAt)`. Antes del Hotfix #6 el label se rendereaba server-side y quedaba pegado al valor del SSR hasta refresh manual. El color del chip (urgencia crit/high/med/low) se calcula server-side y no se actualiza segundo a segundo — si el usuario cruza un umbral con la página abierta, el color se refleja en la próxima navegación. Decisión MVP: un interval por card. Si el test de carga del Sprint 8 muestra lag con 20+ cards, migrar a un store Zustand compartido con un solo tick global. Razón: el Ítem 5 del Hotfix #6 — "Cierra en 3 min" quedaba pegado mientras el contador real ya pasaba a "Cerrado"; UX disonante.

- **`finalizarTorneo` acredita Lukas al ganador + crea `TransaccionLukas { tipo: PREMIO_TORNEO }` en transacción atómica — NUNCA solo setea `Ticket.premioLukas` sin mover el balance:** `ranking.service.ts:finalizarTorneo` hace dentro de `prisma.$transaction`: (a) `Ticket.update` con `posicionFinal` + `premioLukas`; (b) si `premioLukas > 0`, `Usuario.balanceLukas += premioLukas`; (c) `TransaccionLukas.create` con `tipo: "PREMIO_TORNEO"`, `monto: premioLukas`, `refId: torneoId`; (d) `Torneo.estado = "FINALIZADO"`. Si cualquier paso falla, rollback completo — la próxima corrida del poller reintenta. Los Lukas ganados NO vencen (§6), no se setea `venceEn`. **Idempotencia:** si `torneo.estado` ya es FINALIZADO al entrar, la función hace early-return con `{ alreadyFinalized: true }` — protege contra doble-crédito si el poller re-dispara. Antes de distribuir premios, `finalizarTorneo` llama `await recalcularTorneo(torneoId)` para garantizar que los puntos usados son del snapshot final (defensa contra tickets con puntos stale del motor pre-FT). Razón: el Bug #18 del Hotfix #7 — desde Sub-Sprint 5 la función solo seteaba `Ticket.premioLukas` pero nunca tocaba el balance; el ganador nunca veía sus Lukas. Caso testigo: partido Alianza Atlético vs Sport Boys finalizó en prod y el ganador no recibió su premio — el PO reportó el bug al revisar el wallet.

- **Para reparar torneos FINALIZADOS sin crédito usar `POST /api/v1/admin/torneos/:id/reconciliar` (ADMIN-only):** el service `reconciliarTorneoFinalizado` recalcula puntos, recomputa distribución con la regla vigente, lee todas las `TransaccionLukas` PREMIO_TORNEO existentes para el torneo (por usuario), compara con el `expected` de la nueva distribución, y acredita el delta si `delta > 0`. Actualiza `Ticket.posicionFinal` + `Ticket.premioLukas` con los valores correctos. Idempotente: correrlo dos veces seguidas solo genera ajustes con delta > 0; la segunda corrida tiene yaAcreditado === expected → no-op. Se usa cuando (a) un torneo finalizó antes del deploy del Hotfix #7 y nunca acreditó; (b) los puntos fueron calculados con motor pre-Hotfix #6 y la distribución vieja; (c) se descubre un error en algún ticket y se requiere re-aplicar la regla. NO se puede usar en torneos NO-FINALIZADOS (validación dura) — para esos casos usar el flujo normal del poller (`finalizarTorneo`). Razón: el Bug #20 del Hotfix #7 — partidos pre-deploy necesitaban un camino de reparación que no re-acreditara lo ya pagado ni reventara por race condition.

- **Todas las rutas RSC que dependan de estado en vivo (torneos ABIERTOS, partidos EN_VIVO, widgets del sidebar) DEBEN exportar `dynamic = "force-dynamic"`:** rutas actuales con el export: `/live-match`, `/matches`, `/`, `/mis-combinadas`, `/wallet`. El RSC se re-evalúa en cada request y el usuario nunca ve datos stale. Sin esto, Next.js cachea el output y el widget "🔴 En vivo ahora" del sidebar queda congelado cuando un partido termina o entra en vivo, y la pestaña `/matches` muestra torneos cerrados como si estuvieran abiertos. Razón: el Bug #17 del Hotfix #7 — el PO reportó que el widget de /matches seguía mostrando el partido terminado y no aparecía el nuevo live, mientras `/live-match` (que sí tenía force-dynamic desde Sub-Sprint 5) sí actualizaba. La regla cubre también páginas futuras (ej. admin dashboards con métricas en vivo).

- **Minuto del partido en vivo se deriva con `useMinutoEnVivo` — ancla al `elapsedAgeMs` calculado server-side (Ítem 4):** el hook `apps/web/hooks/useMinutoEnVivo.ts` es el único punto donde la UI decide qué label mostrar para el minuto en el `LiveHero`. Toma `{ statusShort, elapsed, elapsedAgeMs }` (sin `fechaInicio` — fue removida). Regla unificada:
  - **Anclaje server-side:** el server calcula `elapsedAgeMs = Date.now() - snapshot.updatedAt` al momento del SSR/emit. Como usa SU propio reloj, es inmune a clock skew. El cliente hace `elapsedAnchorAt = Date.now() - elapsedAgeMs` — obtiene el epoch ms LOCAL correspondiente al momento en que el server capturó el elapsed. El reloj local proyecta desde ahí correctamente aunque el snap tenga 5 min de edad.
  - **Fases avanzables con `elapsed !== null` (1H/2H/ET)**: proyectamos `final = elapsed >= cap ? elapsed : min(cap, elapsed + delta)` donde `delta = floor((now - elapsedAnchorAt)/60000)` y `cap` = 45 (1H) / 90 (2H) / 120 (ET). Server-anclado en todas las fases — cero heurística.
  - **Fases fijas** (`HT`, `FT`, `AET`, `PEN`, `NS`, `TBD`, `PST`, `SUSP`, `INT`, `BT`, `P`, `CANC`, `ABD`, `AWD`, `WO`): delega al mapper `formatMinutoLabel` sin interval (cero CPU).
  - **Fase avanzable con `elapsed === null`**: delega al mapper (devuelve "1T"/"2T"/"Prórroga"). NO fabricamos heurística.
  - **Sin `statusShort` (cache frío)**: devuelve `"—"`. El hook NO usa `fechaInicio` como heurística — la experiencia anterior demostró que asumir "HT de 15 min" o "kickoff = fechaInicio" introduce desfases crónicos que el usuario reporta. Preferimos la honestidad del "—" por ≤30s hasta el primer tick del poller.

  Prohibido renderizar el minuto con `renderMinutoLabel` directo o con lógica inline — siempre vía el hook. Prohibido aplicar heurística basada en `fechaInicio` dentro del hook — el server es la única fuente de verdad del minuto. Test de regresión en `tests/use-minuto-en-vivo.test.ts` verifica el caso `BUG REPRO del PO: elapsed=54 con age=5min (snap stale cache) → 59`. Razón: el Ítem 4 post Hotfix #8 — el cliente asumía que `elapsed` era fresco al montar y subestimaba la edad real del snap, causando que el reloj mostrara el valor del cache (en lugar del minuto real) hasta que el primer WS llegara a re-anclar; la heurística con `fechaInicio` era un workaround imperfecto que generaba su propio desfase. `elapsedAgeMs` resuelve ambos problemas con una sola pieza.

- **`LiveHero` recibe `{ statusShort, elapsed, elapsedAgeMs }` — prop `fechaInicio` removida:** el componente ya no recibe `fechaInicio` porque el reloj no la usa. El `LiveMatchTab` sigue declarando `fechaInicio: string` para metadata general (útil para banners pre-live en el futuro) pero el hero no la lee. El `LiveMatchView` propaga `elapsedAgeMs={live.elapsedAgeMs ?? active.elapsedAgeMs}` — preferencia WS → SSR. Razón: simplificar la API del hero a los 3 inputs que realmente se usan para el reloj.

- **`RankingUpdatePayload.elapsedAgeMs: number | null` es aditivo y obligatorio para el reloj local correcto:** cualquier consumidor del payload (SSR, WS, endpoints REST) debe incluir `elapsedAgeMs` calculado como `Date.now() - snapshot.updatedAt` en el momento en que arma el payload. Sin este campo el cliente asume `elapsedAgeMs = null` y cae a `elapsedAnchorAt = Date.now()` (el bug del Ítem 4). Si un endpoint nuevo devuelve `statusShort`/`elapsed`, DEBE también devolver `elapsedAgeMs`. Test de regresión verifica que `emitirRankingUpdate`, `/api/v1/torneos/:id/ranking`, `/api/v1/live/matches` y el SSR de `/live-match` lo calculen.

- **`RankingUpdatePayload` y endpoints REST incluyen `statusShort: string | null` (NO `snapshotUpdatedAt`):** el hook `useMinutoEnVivo` solo necesita `statusShort` del server — el ancla primaria del reloj es `Partido.fechaInicio` (persistida en BD, serializada al `LiveMatchTab` desde SSR). Para 2H/ET el ancla extra es `elapsed` del server + tracking local del `elapsedAnchorAt` vía `useRef`. Decisión post-feedback del PO sobre el primer intento del Hotfix #8 (que incluía `snapshotUpdatedAt`): agregar un campo crudo en cada payload para algo que ya está persistido en BD era complejidad innecesaria — `fechaInicio` del `PartidoLive` viaja al cliente vía el SSR del `LiveMatchTab` y es suficiente para anclar 1H. El `elapsed` ya estaba en el payload (como `minutoPartido`), solo agregamos `statusShort` para que el hook sepa la fase. Endpoint `/api/v1/live/matches` incluye además `fechaInicio: p.fechaInicio.toISOString()` para que el sidebar widget pueda migrar al mismo hook cuando convenga. Razón: el Bug #22 del Hotfix #8 — resolver la UX del reloj sin agregar dependencias innecesarias a un cache in-memory que puede estar vacío.

- **`LiveMatchTab` incluye `fechaInicio: string` (ISO):** el SSR de `/live-match` lo obtiene de `Partido.fechaInicio.toISOString()` y lo pasa al `LiveMatchView`, que lo propaga al `LiveHero` como `fechaInicio={active.fechaInicio}` (estable, no cambia entre ticks del WS). El tipo acepta `string | Date` en el hook para que sea trivial consumir desde cualquier origen (RSC, Client, etc). Razón: estabilidad del ancla del reloj — a diferencia de `snapshotUpdatedAt` que cambiaba cada 30s, `fechaInicio` es fijo para la vida entera del partido.

- **`finalizarTorneo` auto-repara torneos FINALIZADOS sin crédito completo (Hotfix #8 Bug #23) — no depende de intervención admin manual:** al detectar `preTorneo.estado === "FINALIZADO"`, antes del early-return consulta `detectarCreditoIncompleto(torneoId)`. Este helper puro suma `Ticket.premioLukas` (esperado) y `TransaccionLukas.monto WHERE tipo=PREMIO_TORNEO AND refId=torneoId` (acreditado). Si el delta es positivo, loggea `logger.warn` + dispara `reconciliarTorneoFinalizado` internamente (dentro de try/catch para no romper el poller). El return final sigue siendo `{ alreadyFinalized: true, ganadores: [] }` — la interfaz externa no cambia. Idempotente al cuadrado: una segunda corrida sobre el mismo torneo reparado encuentra delta=0 y no hace nada (ni log warn). El endpoint admin `POST /api/v1/admin/torneos/:id/reconciliar` sigue existiendo para casos fuera del ciclo del poller (cancelaciones retroactivas). Razón: el Bug #23 del Hotfix #8 — el PO reportó 2 torneos finalizados sin acreditar y el Hotfix #7 quedaba atrapado en el early-return sin repararse; el PO pidió que el sistema se auto-cure sin requerir admin manual para cada torneo afectado.

- **`detectarCreditoIncompleto(torneoId)` es el único helper que decide si hay crédito faltante — prohibido inlinear la lógica en otros callers:** `lib/services/ranking.service.ts:detectarCreditoIncompleto` lee tickets + transacciones en paralelo (`Promise.all`), suma ambos, y retorna `null` en 2 casos: (a) no hay tickets con `premioLukas > 0` (torneo sin ganadores — típico de cancelaciones o pozos 0); (b) `deltaPendiente ≤ 0` (crédito completo o sobre-crédito por algún ajuste manual). Retorna `{stats: {...}}` con contexto completo cuando detecta faltante. Si aparece otro consumidor (ej. un cron de auditoría, un dashboard admin de "torneos en estado inconsistente"), usar el helper — no re-implementar las queries. Razón: cambiar la definición de "incompleto" en un solo lugar evita que el dashboard diga "OK" y el auto-reconcile diga "incompleto" (o viceversa).

- **Emails transaccionales SIEMPRE pasan por un wrapper `notifyXxx` de `notificaciones.service` — prohibido llamar `enviarEmail` directo desde un caller de negocio:** los 8 wrappers del `lib/services/notificaciones.service.ts` (`notifyPremioGanado`, `notifyCanjeSolicitado`, `notifyCanjeEnviado`, `notifyCanjeEntregado`, `notifyTorneoCancelado`, `notifyVerifCodigoEmail`, `notifySolicitudEliminar`, `notifyDatosDescargados`) encapsulan el mismo contrato: (1) chequean la preferencia relevante del usuario via `debeNotificar(usuarioId, tipo)`; (2) resuelven el destinatario (skippean si `deletedAt` o sin email); (3) renderizan el template puro de `lib/emails/templates.ts`; (4) disparan `enviarEmail`. Todo envuelto en try/catch con `logger.error` — un email fallido NO rompe la acción principal. Si aparece un nuevo evento que necesita email (ej. "torneo está por cerrar", SS6+), agregar un wrapper más al service + un template más en `templates.ts`. Razón: separa las preferencias de la lógica de negocio, permite apagar un tipo de email sin tocar el código que lo dispara, y centraliza el dominio-verificado `hablaplay.com`.

- **`PreferenciasNotif` se crea lazy con defaults la primera vez que se lee/edita — nunca asumir que existe al llamar `debeNotificar`:** `obtenerPreferencias(usuarioId)` hace un `findUnique` + `create con defaults` si no existe, devuelve los valores siempre. `debeNotificar(usuarioId, tipo)` lee directo y fallbackea a `PREFERENCIAS_DEFAULT[tipo]` si no hay fila — así no hay diferencia funcional entre "usuario con preferencias por defecto" y "usuario sin registro". Los 5 toggles `true` por default son: `notifInicioTorneo`, `notifResultados`, `notifPremios`, `notifSugerencias`, `notifCierreTorneo`. Los 2 `false` (opt-in explícito) son: `notifPromos` y `emailSemanal`. Razón: el email es parte del valor del producto (saber que ganaste); los promos son spam latente que el usuario opta-in conscientemente.

- **Enforcement de límites de juego responsable vive exclusivamente en `lib/services/limites.service.ts` — callers no deben replicar la lógica:** los 4 helpers exportados son los únicos puntos donde se decide si una acción está permitida. `verificarLimiteInscripcion({tx?, usuarioId, entradaLukas})` se llama desde `tickets.service.crear()` ANTES del descuento de Lukas — chequea auto-exclusión + límite diario (`cuenta+1 > limite`). `verificarLimiteCanje({usuarioId, tx?})` desde `canjes.service.crearCanje()` — solo chequea auto-exclusión (los canjes no tienen límite cuantitativo propio). `verificarLimiteCompra({usuarioId, montoLukas, tx?})` queda exportado listo para Sub-Sprint 2 (pagos Culqi) — chequea auto-exclusión + suma `TransaccionLukas tipo=COMPRA` del mes vs `limiteMensualCompra`. `bloquearSiAutoExcluido(usuarioId, tx?)` es el helper de menor nivel que los 3 anteriores usan — si `autoExclusionHasta` existe y es futura, lanza `LimiteExcedido` con meta. Si aparece un nuevo punto de consumo de Lukas (ej. "entrada premium al chat exclusivo del torneo"), debe llamar al helper existente o uno nuevo en el service — prohibido duplicar las queries de conteo o la lógica de auto-exclusión en otros archivos. Test `limites.service.test.ts` verifica que los 4 helpers están exportados y que tickets/canjes los invocan. Razón: los límites protegen al usuario (juego responsable); un helper olvidado es un vector legal y ético.

- **Auto-exclusión solo acepta duraciones 7, 30 o 90 días — constante `AUTOEXCLUSION_DIAS_VALIDOS` es la fuente de verdad:** tanto el service (`activarAutoExclusion(usuarioId, dias)`) como el endpoint Zod (`z.union([z.literal(7), z.literal(30), z.literal(90)])`) como el modal de `/perfil` (array literal `[7, 30, 90]`) deben usar las mismas 3 opciones. Valores arbitrarios se rechazan con `LimiteExcedido`. Razón: los 3 escalones son los estándar del juego responsable en la industria (cooling off de 1 semana, corte de mes, pausa de trimestre); agregar "1 día" o "1 año" podría ser peligroso en ambos sentidos (muy corto para el propósito psicológico, o demasiado permanente sin reflexión previa).

- **Código de verificación de teléfono: 6 dígitos, TTL 10 min, SHA-256 hash, máximo 3 intentos:** constantes en `verificacion.service.ts`. El código se almacena hasheado (`crypto.createHash("sha256").update(codigo).digest("hex")`) — nunca en plaintext. La decisión de no usar bcrypt es consciente: códigos efímeros de 6 dígitos con TTL 10 min y 3 intentos máximo no justifican el costo computacional de bcrypt; SHA-256 ofrece la latencia suficiente para hacer inviable fuerza bruta. En modo dev (sin Twilio configurado), el código fijo es `123456` — facilita el smoke local. Cuando Twilio está configurado (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER), el service llama a Twilio REST API con fetch directo, sin agregar la dep `twilio@*`. Si Twilio falla o no está configurado en prod, fallback: dispara `notifyVerifCodigoEmail` para que el código llegue por email. Razón: robustez + evitar deps.

- **Upload de DNI vive en filesystem local bajo `apps/web/public/uploads/dni/<hex32>.{jpg|png}` — decisión MVP documentada en §15:** alternativas descartadas: S3 (`@aws-sdk/client-s3`), R2 (misma dep + credenciales Cloudflare), upload services externos. Para Railway con 1 réplica, filesystem es suficiente — los archivos se sirven directo como estáticos de Next.js. Validaciones: DNI peruano 8 dígitos, MIME allowlist (`image/jpeg|jpg|png`), máx 1.5MB. El `VerificacionDni.estado` transiciona PENDIENTE → APROBADO (admin marca) → `Usuario.dniVerif=true` o PENDIENTE → RECHAZADO con motivo (usuario puede re-subir). Cuando se escale a multi-réplica, migrar a R2 con storage compartido — el helper `getUploadDir()` de `verificacion.service.ts` es el único punto que toca path local; refactorizarlo a un adapter es trivial.

- **Eliminar cuenta es soft delete + anonimización explícita — TICKETS Y TRANSACCIONES NO SE BORRAN:** `confirmarEliminarCuenta(token)` en `prisma.$transaction` hace (a) marca `SolicitudEliminacion.confirmadaEn`; (b) actualiza `Usuario` anonimizando PII — `nombre="Usuario eliminado"`, `email=deleted-<id8>-<timestamp>@deleted.habla.local` (único para no colisionar, dominio inválido por diseño), `username/telefono/ubicacion/image=null`, `deletedAt=new Date()`; (c) `session.deleteMany` fuerza logout en todos los dispositivos. **Preserva:** tickets (integridad de torneos), transacciones (audit de premios pagados), canjes (audit de premios entregados). **Razón:** un jugador que ganó un torneo y se elimina no puede "desaparecer" retroactivamente del ranking — el torneo ya pagó su premio y la integridad del audit financiero lo requiere. El `deletedAt` se consulta al intentar leer el perfil (`NoAutenticado`) y al armar destinatarios de emails (`obtenerDestinatario` retorna null). El token de confirmación tiene TTL 48h; tras confirmar, una segunda llamada al mismo token lanza `YA_CONFIRMADO 409`.

- **Tienda: canjes requieren chequeo de dirección SOLO si `premio.requiereDireccion=true`:** el campo por premio (gift cards digitales y experiencias lo tienen false; camisetas y tech lo tienen true) controla la UI (el modal de canje muestra formulario de dirección solo cuando corresponde) y la validación del service (`crearCanje` lanza `ValidacionFallida` si falta dirección completa en un premio físico). La dirección se persiste como JSON en `Canje.direccion` para que el admin la vea tal cual en el panel sin necesidad de un model separado. Razón: flexibilidad — mañana un premio podría requerir campos extra (talle de camiseta, preferencia de color) sin migración.

- **Distribución de premios canjeados fire-and-forget: el email va después del commit, no dentro de la transacción:** `crearCanje` y `actualizarEstadoAdmin` siempre disparan `void notifyXxx(...)` DESPUÉS de que `prisma.$transaction` retorne. Razón: si la transacción falla y hace rollback, NO se envía email — la UX es coherente con lo que quedó en BD. Si el email falla después del commit, el canje queda creado y el usuario se entera la próxima vez que entre a /perfil — preferimos un email perdido a un email duplicado. El patrón aplica también a la parte de `finalizarTorneo` que despacha `notifyPremioGanado` tras el commit del crédito.

- **Máquina de estados de canjes: las transiciones legales son un `Record<EstadoCanje, EstadoCanje[]>` — prohibido hacer transiciones inline sin consultar la constante:** `canjes.service.ts:TRANSICIONES` documenta explícitamente: `PENDIENTE → [PROCESANDO, CANCELADO]`, `PROCESANDO → [ENVIADO, CANCELADO]`, `ENVIADO → [ENTREGADO, CANCELADO]`, `ENTREGADO → []` (terminal), `CANCELADO → []` (terminal). Cualquier transición que no esté en la lista lanza `LimiteExcedido` con meta `{desde, hacia, permitidas}`. Cancelación es la única transición destructiva (reembolsa Lukas + restituye stock + crea REEMBOLSO). Razón: la máquina debe ser auditable desde un solo punto; un admin que intenta "saltarse" directo de PENDIENTE a ENTREGADO debe recibir un error — el step PROCESANDO es útil para que el admin interno sepa qué está "en cola para despacho" vs "aún sin tocar".

- **Tras mutaciones de perfil (verificar teléfono, subir DNI, editar datos) los client components dispatchean `new Event("perfil:refresh")` para que el server-side se re-consulte:** `PerfilRefreshOnUpdate.tsx` es un Client Component montado en la page `/perfil` que escucha el evento y llama `router.refresh()`. Los sub-paneles (VerificacionPanel, DatosPersonalesPanel, etc.) disparan el evento tras un PATCH/POST exitoso. Razón: Next 14 no permite pasar callbacks desde server page → client component; el evento custom es el puente idiomático. Si un nuevo panel muta datos y necesita refresh, debe dispatchear el mismo evento — prohibido duplicar el patrón con otros nombres.

- **Balance de Lukas tras canje propagado vía `setBalance(json.data.nuevoBalance)` del `useLukasStore`:** el endpoint `POST /premios/:id/canjear` devuelve `{canje, nuevoBalance}` — el `CanjearModal` llama `setBalance` post-éxito. Lo mismo aplica a la cancelación de canje por admin (reembolso) — aunque no haya UI client-side para admin mutando el balance del usuario, el próximo request del usuario al session callback verá el balance actualizado (NextAuth `obtenerBalance` lee de BD). Razón: continuación de la convención §14 del Hotfix #4 Bug #7; el store es la única fuente de verdad cross-página.

- **Catálogo de premios vive en `packages/db/src/catalog.ts` — fuente de verdad única compartida por seed local + endpoint admin; prohibido duplicar la constante:** `CATALOGO_PREMIOS` es un `ReadonlyArray<CatalogoPremio>` exportado desde `@habla/db`. Lo consumen (a) `packages/db/prisma/seed.ts` vía import relativo `../src/catalog`, y (b) `apps/web/lib/services/premios-seed.service.ts` vía `@habla/db`. Cualquier cambio de catálogo (precio, stock, nuevo premio) se hace UNA SOLA VEZ acá; el endpoint admin `POST /api/v1/admin/seed/premios` re-sembrará con los nuevos valores al siguiente POST (actualiza lo que cambió, crea lo nuevo). Test antidrift verifica unicidad de nombres, 25 items, 5 categorías, featured único, 3 badges. Razón: Bug #24 del Hotfix #9 — antes el catálogo vivía solo en `seed.ts` con `deleteMany + create` y nunca corrió en prod; consolidar en un solo archivo typed + idempotente elimina la brecha. Si aparece un nuevo consumer (ej. un export CSV, un dashboard), debe importar la constante — nunca copiar los 25 items.

- **Operaciones admin one-shot (seeds, reconciliaciones manuales, imports) usan endpoints bajo `/api/v1/admin/*` — nunca scripts de deploy ni migraciones de datos:** el patrón quedó establecido con `POST /api/v1/admin/torneos/:id/reconciliar` (Hotfix #7) y se extiende con `POST /api/v1/admin/seed/premios` (Hotfix #9). Ventajas sobre las alternativas: (a) ejecución manual explícita (bajo riesgo de correr por accidente); (b) reusa la capa de auth existente (`NoAutenticado` + `NoAutorizado` con rol ADMIN); (c) idempotente por diseño (re-correrlo es seguro); (d) observable (logs con Pino, response JSON con contadores); (e) self-service para admin vía UI en `/admin` o `authedFetch` desde curl con cookies. Prohibido: lanzar estas operaciones en `startCommand` / `Dockerfile` / `.github/workflows/deploy.yml` (se corren en cada deploy, mutan datos, dificultan rollback). Prohibido: scripts standalone que requieran `railway run` (no self-service, requiere CLI + shell access). Las migraciones de Prisma se reservan EXCLUSIVAMENTE para cambios de schema. Cuando aparezca una nueva operación admin (ej. "reasignar categoría de premios", "forzar recálculo de stats de todos los usuarios"), debe ser un endpoint `POST /api/v1/admin/*` con el mismo contrato: auth ADMIN, `force-dynamic`, idempotente, contadores en el response, logs estructurados. Razón: el Bug #24 del Hotfix #9 reveló que el único mecanismo que teníamos (un script `pnpm db:seed`) era inejecutable en Railway sin CLI + shell, dejando el catálogo vacío en prod durante todo el Sub-Sprint 6+7.

- **Un usuario autenticado llega a `/perfil` en ≤ 2 taps/clicks desde cualquier página principal del grupo `(main)` — regla de design system:** entradas visibles en la nav: (a) desktop → `UserMenu.tsx` dropdown del avatar (1 click para abrir, 1 click en "Mi perfil" = 2 clicks); (b) mobile → `BottomNav.tsx` último item con ícono 👤 label "Perfil" (1 tap). El `/perfil` es una ruta protegida por middleware (redirige a `/auth/login` si no hay sesión). Prohibido esconderla atrás de flows más largos. Si un rediseño futuro consolida el mobile header (ej. reemplaza UserMenu por un hamburger), mover la entrada a Perfil a ese nuevo pattern manteniendo ≤2 taps. Wallet mantiene la misma regla vía `BalanceBadge` del header (siempre visible, 1 tap a /wallet) — no se duplica su link en el BottomNav. Test antidrift `tests/perfil-nav-access.test.ts` fija las 3 entradas (UserMenu, BottomNav, middleware protection) + force-dynamic de la page. Razón: el Bug #25 del Hotfix #9 — el Sub-Sprint 7 completo (verificación teléfono/DNI, 7 toggles de notificación, límites de juego responsable, auto-exclusión, eliminar cuenta, exportar datos) quedaba invisible en mobile porque el único acceso era el dropdown del avatar, pattern no obvio en pantallas <1024px.

---

## 15. RIESGOS Y DECISIONES CLAVE

- **Regulatorio:** Los Lukas clasificados como apuesta. Mitigación: **no retirables** como efectivo, solo créditos. Asesoría legal pre-lanzamiento.
- **Técnico — caída durante partidos:** Railway auto-scaling. Test de carga 500 usuarios obligatorio en Sprint 8.
- **Pasivo de Lukas:** Vencimiento a 12 meses + provisión del 25%. Límite de balance máximo por usuario post-MVP.
- **Post-Mundial churn:** Torneos de liga diarios + ligas privadas (v1.1) + gamificación (v1.2).
- **Decisiones técnicas:** pnpm 10, NextAuth v5 beta, API-Football directo (no RapidAPI), Dockerfile sobre Railpack, JWT session strategy, custom Prisma adapter.
- **Sub-Sprint 3 — backend en Next.js Route Handlers, no Fastify todavía:** el API del Sub-Sprint 3 (torneos, partidos, admin) vive en `apps/web/app/api/v1/*` con los servicios en `apps/web/lib/services/*` (Node runtime por defecto). El scaffold de `apps/api/` (Fastify) queda congelado como backlog post-MVP: cuando el poller de partidos en vivo del Sub-Sprint 5 pegue fuerte con WebSockets, migraremos los módulos a Fastify. Mientras tanto, Next.js corre todo en el mismo servicio Railway y la sesión de NextAuth se consume directo desde los route handlers con `auth()` — sin JWT bridge entre dos procesos.
- **Sub-Sprint 3 — Ticket placeholder con predicciones default:** al inscribirse, se crea un `Ticket` con `predResultado=LOCAL, predBtts=false, predMas25=false, predTarjetaRoja=false, predMarcadorLocal=0, predMarcadorVisita=0`. La unique constraint `[usuarioId, torneoId, preds…]` impide la doble inscripción con defaults (1 ticket por usuario por torneo en el Sub-Sprint 3). El Sub-Sprint 4 permite que el usuario edite las predicciones y, para tickets adicionales, fuerza a que las 5 predicciones difieran (hasta 10 tickets distintos por torneo). Alternativa descartada: tabla `Inscripcion` separada, implicaba migración más cara sin beneficio MVP.
- **Sub-Sprint 3 — REEMBOLSO agregado a `TipoTransaccion`:** migración `20260418030000_add_reembolso_tipo_transaccion` agrega el valor `REEMBOLSO` al enum; lo usa `cancelar()` cuando un torneo se cancela por no alcanzar el mínimo de inscritos (2).
- **Sub-Sprint 3 — Cron in-process en vez de externo:** ni Railway Cron ni GitHub Actions permiten intervalos <5min; para cerrar torneos con la precisión que pide el negocio (`cierreAt` exacto), registramos el cron **dentro del proceso Next.js** vía `apps/web/instrumentation.ts` (Next.js `register()` hook) con un `setInterval(tick, 60_000)`. Es posible porque Railway corre el contenedor 24/7 (a diferencia de Vercel serverless). Sin dependencias externas, sin `CRON_SECRET` obligatorio, granularidad arbitraria (lo subimos a 30s o menos si Sub-Sprint 5 lo pide). Caveat documentado: si escalamos `web` a >1 réplica, mover a un servicio Railway dedicado con `replicas=1` o agregar un leader-lock en Redis. El endpoint HTTP `/api/cron/cerrar-torneos` se mantiene como trigger manual opcional (protegido con `CRON_SECRET` si se setea).

- **Sub-Sprint 3.5 — Temporada de liga resuelta dinámicamente, no hardcodeada:** api-football NO acepta `season=current` en `/fixtures`; hay que pedirla primero con `/leagues?id=X&current=true`. En vez de cablear el año en la config (`season: 2026` por cada liga) guardamos sólo el `apiFootballId` y dejamos que `seasons.cache.ts` resuelva y cachee la temporada (refresh cada 24h). Beneficio: cuando Liga 1 pase de 2026 a 2027, el sistema lo recoge sin deploy — lo recoge en la siguiente corrida del refresh.

- **Sub-Sprint 3.5 — Auto-creación de torneo al importar partido (regla dura):** el business rule es que toda partido de liga whitelisteada tiene torneo, punto. El service `partidos-import.service.ts` hace `findFirst({ partidoId })` antes de crear; si existe, skip. Si el partido ya tiene `cierreAt` en el pasado (importado tarde, ya empezó), NO se crea torneo — un torneo con cierre vencido es basura que confunde `procesarCierreAutomatico`. La combinación `upsert partido + find/create torneo` hace al job 100% idempotente.

- **Fase 3 — round y venue en BD en vez de on-demand:** el mapper inglés→español corre en el poller (`mapRoundToEs`) y cachea resultado en columna `round` de `Partido`. Evita recalcular en cada render y mantiene el frontend agnóstico del formato del API. `venue` se guarda como string concatenado `"{name}, {city}"` — si el formato cambiara, el poller repobla en la siguiente corrida (cada 6h). Los partidos anteriores al deploy quedan con `null` hasta que el poller los refresque; la UI omite las líneas null limpiamente.

- **Fase 3 — colores de equipos por hash, no por marca real:** `team-colors.ts` mapea un seed estable (team.id o nombre del equipo) a un palette determinista de 12 colores. Evita problemas de trademark con escudos/colores oficiales y garantiza que cada equipo siempre recibe el mismo color dentro de la app. Como el schema actual de `Partido` no guarda team.id, usamos el nombre como seed — igualmente determinista.

- **Fase 3 — filtros de /matches en URL, no en client state:** `useMatchesFilters` lee `?liga=&dia=` con `useSearchParams` y escribe con `router.replace`. Permite deep-linking, refresh estable y share. Para filtrar por día el frontend resuelve el rango local (`getDayBounds` en America/Lima) a ISO UTC antes de llamar al backend; el backend NO convierte tz. Así, un mismo día clickeado desde Madrid y Lima hace la misma query UTC.

- **Fase 3 — default de /matches es "Todos", no "Hoy":** la primera iteración defaulteaba a `dia=<hoy>` en memoria. El problema: si no hay partidos programados para hoy (final de semana, ventana internacional, día muerto), la página se ve vacía aunque haya 40 torneos programados esta semana — UX terrible para un usuario que recién descubre la app. Cambiamos a mostrar todos los torneos `ABIERTO` de la ventana por default (ordenados por `fechaInicio ASC`) y exponemos un chip "Todos" como primero de la fila. Así el primer impacto visual siempre tiene torneos disponibles, y el usuario que quiere filtrar por día puede hacerlo explícitamente con los chips de día.

- **Fase 3 — filtro de día scrollea horizontalmente, NO wrappea:** la segunda iteración (19 Abr) topeaba los chips a los próximos 7 días y dejaba torneos de la ventana 2 (días 8-14) sin filtro accesible. Probamos dos alternativas descartadas: (a) wrappear chips a segunda línea — se come layout vertical y se ve mal en desktop con 10+ días; (b) mostrar solo los próximos N días relevantes — re-introduce el problema original de ventana incompleta. Adoptamos scroll horizontal con `scroll-snap-type: x proximity` + gradientes laterales + flechas (hover-capable only, ocultas en mobile por `@media (hover: none)`) + roving tabindex. Mostrar 14 chips en desktop sin wrap y sin cortar el contenido principal de `/matches` solo es viable con scroll. El hook `useScrollIndicators` queda disponible para otras filas scrolleables futuras.

- **Fase 3 — `formatDayChip` varía formato por mes, NO por cercanía:** consideramos mostrar el mes solo para días lejanos (>7 días), pero esa regla es visualmente inconsistente cuando el chip "Jue 30" (mes actual) queda junto al chip "Vie 1" (mes siguiente) sin diferencia visible — el usuario no distingue el salto de mes. La regla final: el chip lleva mes si y solo si cae fuera del mes-en-curso del navegador, independiente de la distancia. Efecto neto: los chips del mes actual comparten formato corto, los que caen en el mes siguiente (o en año siguiente, para el caso diciembre→enero) muestran el mes abreviado para desambiguar. Esto deja claro el "salto" visualmente sin inventar un treshold de días arbitrario.

- **Sub-Sprint 5 — WebSockets en custom Next.js server (Opción B), NO en Fastify separado (Opción A):** la decisión estaba en el aire desde el Sub-Sprint 3 (se había anotado: "cuando el poller de partidos en vivo del Sub-Sprint 5 pegue fuerte con WebSockets, migraremos los módulos a Fastify"). Este fue ese momento y la decisión cayó del lado opuesto al plan original. Opción A (apps/api + Fastify + Socket.io) hubiera requerido un segundo servicio Railway, un JWT bridge para compartir sesión con NextAuth v5 (cuyas internals de JWE son frágiles en beta.30), y duplicar el `instrumentation.ts` cron en dos procesos. Opción B (custom `apps/web/server.ts` que monta `Socket.io` sobre el HTTP server de Next): 1 proceso, 1 puerto, session sharing trivial — reusamos `AUTH_SECRET` para firmar un JWT HS256 de 5 min emitido por un route handler que sí tiene `auth()`, y el server WS lo verifica con `jose`. El trade-off es perder `output: "standalone"` en `next.config.js` (el standalone output está cableado al `server.js` por defecto de Next y no es compatible con el custom). Cambiamos el entry a `tsx server.ts` tanto en dev como en prod, Dockerfile copia el workspace completo (más peso vs. standalone, aceptable para MVP). Cuando el Sprint 8 (QA/carga) o métricas post-Mundial muestren saturación del event-loop del proceso de Next, la migración a `apps/api` Fastify queda viva pero ya desde una base de pruebas reales, no especulativa.

- **Sub-Sprint 5 — Poller idempotente con natural key en `EventoPartido`:** el poller corre cada 30s y hace N requests al API externo. Una re-corrida accidental o una latencia de red que dispare dos ticks simultáneos podría duplicar eventos y puntos. Defensa: la tabla `eventos_partido` tiene unique `(partidoId, tipo, minuto, equipo, COALESCE(jugador,''))` — insertar un evento idéntico revienta con `P2002` que atrapamos y descartamos como dup. El motor de puntuación es una función pura `(ticket, snapshot) → PuntosDetalle`, así que re-correrlo sobre el mismo partido escribe los mismos números. `recalcularTorneo` además diffea antes de escribir y sólo toca los tickets que cambiaron, reduciendo presión sobre Postgres cuando un gol no mueve el pick de muchos tickets. Consecuencia: si por un 502 de api-football los puntos quedan "pendientes" durante un minuto, el siguiente tick los resuelve sin intervención ni duplicados — la recuperación es automática.

- **Sub-Sprint 5 — Backoff 429 por partido vs. global:** el free tier de api-football es ~100 req/día. Un torneo con 30 partidos en vivo nos fuma el budget en un tick. Decisión: si cualquier llamada devuelve 429, activamos backoff GLOBAL (no por partido) con cap 5 min y abortamos el tick — preferimos perder 30s de latencia en el ranking antes que seguir bombardeando y quemar la cuota del día entero. Reset al siguiente tick sin errores. El plan de negocio pre-Mundial es upgradear a plan paid (750k req/día) cuando salgamos de beta; hasta entonces, el backoff protege el servicio.

- **Sub-Sprint 5 — Redis opcional (degradación a BD):** el ranking en vivo vive en un sorted set Redis `torneo:{id}:ranking` con `score=puntosTotal`. `ZREVRANGE` es O(log N) y sirve un top 10 sub-ms aún con 500 tickets. Pero `REDIS_URL` en Railway requiere service-link explícito que a veces falla en deploy. En lugar de bloquear el sistema si Redis no está, `getRedis()` devuelve `null` y el `ranking.service` degrada a lectura directa de BD (`findMany` + sort en memoria). Para 500 tickets por torneo el overhead es ~50ms vs. sub-ms de Redis, aceptable. Consecuencia: Redis es nice-to-have, no crítico; no bloquea deploys. Cuando el test de carga del Sprint 8 muestre degradación, forzamos Redis a "obligatorio".

- **Sub-Sprint 5 — Ranking como proyección, no confirmación:** el motor adjudica los 3 pts de Resultado 1X2 cuando el marcador actual coincide con el pick, aunque el partido siga en vivo. Razón: el usuario ve "si terminara ahora, ¿dónde quedo?" — el ranking debe reflejar esa pregunta. Si el marcador cambia (ej. 1-0 → 1-1), el motor re-adjudica en la próxima corrida (la función es pura). Excepción: el marcador exacto SÓLO se adjudica en FINALIZADO — durante EN_VIVO coincidir momentáneamente con el score no garantiza la confirmación, y los 8 pts son demasiado peso para ser volátiles en cada segundo del ranking.

- **Hotfix 19 Abr — Convención única para CTAs que abren el ComboModal:** todos los puntos de entrada que disparan el formulario de combinada (`/matches` y `/` vía `MatchCardCTA`, `/torneo/:id` y `/mis-combinadas` y `/live-match` vía `ComboLauncher`) comparten el hook `hooks/useComboOpener.ts` y el mapper puro `components/combo/combo-info.mapper.ts:buildComboTorneoInfo`. El estado se derive del mismo `GET /api/v1/torneos/:id` y se pasa al `<ComboModal>` con la misma forma `ComboTorneoInfo`. Guardia de sesión consistente en todos: sin sesión → `<Link href="/auth/login?callbackUrl=<punto de entrada>?openCombo=<torneoId>">`, con sesión → `<button onClick={openFor(torneoId)}>`. Al volver post-login, `AutoOpenComboFromQuery` (montado en `MatchesPageContent`) lee `?openCombo=<id>` y abre el modal automáticamente, limpiando el query param con `router.replace` preservando `?liga=` y `?dia=`. Razón: al Sub-Sprint 4 cada launcher tenía su propia copia de fetch + state machine, y el CTA lateral del MatchCard era un `<Link>` directo que saltaba el flow — el usuario tenía que navegar a `/torneo/:id` solo para armar la combinada (friction inútil para el caso happy). Prohibido agregar un 4° launcher con lógica duplicada; si aparece un nuevo punto de entrada, consumir `useComboOpener` + armar el callbackUrl con `?openCombo=<id>`.

- **Hotfix #2 19 Abr — Footer del ComboModal pasa por `computeComboFooterState` puro, nunca renderiza balance negativo:** la fórmula `balance - costoLukas` puede dar negativo cuando el store no se hidrató desde la sesión (Bug #1) o cuando el usuario tiene menos balance que la entrada del torneo. El helper `combo-info.mapper.ts:computeComboFooterState` deriva `displayBalanceDespues = Math.max(0, balanceDespues)` para la UI y `balanceInsuficiente = !tienePlaceholder && balance < entradaLukas`. Si `balanceInsuficiente`, el ComboModal reemplaza el botón "Inscribir" por un `<Link href="/wallet">🪙 Comprar Lukas</Link>` con mensaje "Te faltan X 🪙". `handleSubmit` añade defensa redundante: si por race se dispara con `balanceInsuficiente`, no avanza. Razón: el backend ya rechazaba con `BalanceInsuficiente` 400, pero permitir que el modal mostrara "-5" y dejara el botón clickeable era UX pésimo. Test `BUG REPRO: store sin hidratar (balance=0) NO muestra negativo` reproduce el caso del bug original con `balance=0, entradaLukas=5, tienePlaceholder=false` y asserta `displayBalanceDespues=0` + `ctaMode='comprar'`.

- **Hotfix #2 19 Abr — `/live-match` filtra solo por `partido.estado`, no por estado del torneo:** el query original tenía `where: { torneos: { some: { estado: { in: [EN_JUEGO, FINALIZADO, CERRADO] } } } }` que descartaba el partido entero si ningún torneo estaba en esos estados. Caso real: el cron in-process de cierre corre cada 60s; si el partido pasó a EN_VIVO (poller cada 30s) y el cron aún no transicionó los torneos `ABIERTO→CERRADO`, el partido EN_VIVO desaparecía de /live-match. Fix: helper compartido `lib/services/live-matches.service.ts` con `obtenerLiveMatches()` que filtra solo por `partido.estado in ["EN_VIVO", "FINALIZADO"]` (sin `some` filter) y `elegirTorneoPrincipal(torneos)` que prioriza por estado (EN_JUEGO > CERRADO > FINALIZADO > ABIERTO) y dentro del mismo estado por `pozoBruto DESC`. Los 3 consumers (`/live-match` page, `/api/v1/live/matches` endpoint, `MatchesSidebar` widget) usan el mismo helper para que las 3 vistas del frontend sean consistentes. `listarRanking` funciona aún para torneos ABIERTOS (devuelve tickets con `puntosTotal=0`), así que mostrar el partido con torneo ABIERTO es seguro — el ranking se llena cuando el cron transiciona y el poller calcula. Razón: el usuario espera ver el partido tan pronto como esté en vivo, no esperar al jitter del cron.

- **Hotfix #2 19 Abr — `/mis-combinadas` protegida por middleware (no solo por `auth()` interno):** la página llamaba `auth()` en el RSC y redirigía si retornaba null, lo que pasaba intermitentemente por timing entre cookie set y SSR de soft-navigations en Next.js 14 + NextAuth v5 beta. Agregando `/mis-combinadas/:path*` al matcher del middleware, el wrapper `auth()` de NextAuth corre antes del RSC y evalúa el cookie consistentemente. El middleware redirige con `callbackUrl` si no hay sesión; si hay, deja pasar y la página renderiza normal. Adicional defensivo: `force-dynamic` en /mis-combinadas y /wallet evita caché entre requests, y el `session` callback en `auth.ts` envuelve `obtenerBalance` en try/catch para no romper la sesión si Prisma falla (defaultea balance a 0 + log). Razón: una sesión "fantasma" que se pierde al click pero vuelve al refresh es de las peores UX — el usuario no entiende qué pasó. Mejor pagar 1 ms de middleware extra y eliminar la ambigüedad.

- **Hotfix #3 19 Abr — Modal renderizado via React portal a `document.body` (Bug #4):** el overlay del modal es `position: fixed` + `inset: 0`. Con el Hotfix #2 que arregló el flow del balance el modal se empezó a abrir desde el `<MatchCardCTA>` que vive dentro del `<article>` del MatchCard, y el hover del card (`transform: translate-y-px` por shadow animation) crea un nuevo containing block para descendientes `fixed`. Resultado: el overlay se anclaba al `<article>` (~150px alto) en vez del viewport — el modal se veía superpuesto a las cards vecinas, sin backdrop centrado, sin blur y con la página "congelada" mientras el modal permanecía atrapado. La solución estándar para esto en React es `createPortal(overlay, document.body)`: el overlay se renderiza como child directo de `<body>`, fuera de cualquier stacking context intermedio. Se agregó `mounted` guard (`useState(false)` + effect) para evitar hydration mismatch ya que `document` no existe server-side. Alternativa descartada: sacar el `<ComboModal>` del MatchCardCTA y centralizarlo en un provider al tope del layout — requería API de dispatch + estado global y afectaba 3 launchers sin fix general. El portal resuelve el problema de raíz para este modal y cualquier futuro (canjes en tienda, confirmaciones, etc.) sin refactor de consumers. Test antidrift: `tests/modal-portal.test.ts` busca literalmente `createPortal(overlay, document.body)` en el AST del archivo; si se revierte, reventa pre-merge.

- **Hotfix #3 19 Abr — `/live-match` tolera partidos cuyos torneos están todos CANCELADO (Bug #5):** el Hotfix #2 abrió la puerta (filtro por `partido.estado` solamente) pero la página seguía descartando partidos cuyo `elegirTorneoPrincipal` retornaba `null`. Ese es el caso de un partido EN_VIVO cuyo único torneo se canceló por <2 inscritos al cierre. Decisión: mostrar el partido igual. El hero con el marcador live + los eventos + las stats siguen siendo información útil (aunque no haya torneo donde el usuario pueda competir). En el tab Ranking se rendera un `<SinTorneoActivo />` con copy "🏟️ Este partido no tiene torneo activo". Consecuencia para el modelo: `LiveMatchTab.torneoId` pasa a `string | null`, `LiveMatchTab.torneoEstado` incluye `null`, y el identificador sintético del tab activo en el switcher es `torneoId ?? 'partido:<id>'`. El helper `obtenerLiveMatches` ahora incluye TODOS los torneos (incluso CANCELADO) en el eager load para que el caller vea el contexto completo; `elegirTorneoPrincipal` sigue filtrando CANCELADO al elegir el principal pero retorna null si todos lo están. Deep-linking `/live-match?partidoId=<id>` permite volver al tab de un partido sin torneo activo. Alternativa descartada: esconder el partido y redirigir a `/matches` — violaba la expectativa del usuario que ve el partido en la sidebar EN_VIVO y clickea "ver ranking completo". **Revertido por Bug #8 del Hotfix #4** (ver entrada más abajo).

- **Hotfix #4 19 Abr — ComboModal con 6 status states y feedback panel post-submit (Bug #6):** antes el ComboModal solo tenía el estado idle + el flag binario `balanceInsuficiente` del mapper de footer. No había confirmación post-submit (la backend ya inscribía pero el modal cerraba sin avisar), ni copy para torneo cerrado, ni retry para errores de red, ni loading visible durante el POST. Decisión: introducir `ComboModalStatus = 'idle' | 'submitting' | 'success' | 'insufficient-balance' | 'tournament-closed' | 'error'` con un helper puro `computeComboModalUIState(opts)` que deriva título, copy, icono, tono cromatico y CTAs por estado. Estado `success` muestra un panel con detalles del ticket creado (id, predicciones como chips, entrada pagada, puntos máx, balance después) + CTAs "Ver mis combinadas" / "Crear otra" (este último resetea el form). `statusFromBackendError` mapea códigos del backend (BALANCE_INSUFICIENTE → insufficient-balance, TORNEO_CERRADO → tournament-closed, otros → error). El defense-in-depth del Hotfix #2 (gate por `balanceInsuficiente`) se mantiene pero ahora navega al status visible. Alternativa descartada: toast simple con "¡Combinada enviada!" (como el mockup original) — sin detalles del ticket se pierde la oportunidad de confirmar qué armó el usuario y ofrecer el próximo paso lógico. Razón: la UX de "click → modal se cierra → nada" dejaba al usuario sin saber si había pasado.

- **Hotfix #4 19 Abr — Balance de Lukas global se sincroniza vía store post-inscripción (Bug #7):** el PO reportó 3 manifestaciones del mismo bug: (a) header del NavBar seguía mostrando 500 tras inscripción de 5 Lukas, debería ser 495; (b) `/mis-combinadas` mostraba "Balance" en `-5` — era el `stats.neto` (sum(premioLukas - entradaLukas) acumulado) con label "Balance neto" y para el primer ticket sin premios aún daba P/L negativo; (c) el segundo ComboModal que el usuario abría en otro torneo calculaba "Balance después" desde 500, no 495. Root cause común: los consumers del balance en UI (NavBar, /mis-combinadas pill) leían de `session.user.balanceLukas` (SSR) en lugar del `useLukasStore`. El ComboModal ya actualizaba el store via `setBalance(nuevoBalance)` (Sub-Sprint 4), pero ese cambio no se reflejaba en NavBar (Server Component) ni en /mis-combinadas (pill basado en server-side stats). Fix en 3 piezas: (1) `BalanceBadge.tsx` (nuevo, client) reemplaza el chip inline del NavBar — lee del store, acepta `initialBalance` del SSR para evitar flicker pre-hydration con el pattern `mounted ? storeBalance : initialBalance`. (2) `BalancePill.tsx` (nuevo, client) reemplaza el `StatsPill` de "Balance neto" en /mis-combinadas — muestra el balance absoluto del store con el mismo pattern mounted-guard. (3) Convención nueva en §14: tras toda mutación de Lukas, el endpoint devuelve `nuevoBalance` y el cliente llama `setBalance` — único punto de verdad cross-página. Alternativa descartada: refresh completo del RSC tras cada mutación — pesado y rompe el UX fluido del modal.

- **Hotfix #4 19 Abr — Revert de "tolerar partidos sin torneo activo" en `/live-match` (Bug #8):** el Hotfix #3 decidió tolerar partidos con todos sus torneos CANCELADO, mostrándolos en /live-match con un cartel "🏟️ Este partido no tiene torneo activo" en el tab Ranking. El PO revisó en uso real y la decisión quedó del lado opuesto: mostrar el partido sin posibilidad de competir confundía al usuario que esperaba poder inscribirse. Fix: `obtenerLiveMatches` agrega `where: { torneos: { some: { estado: { not: "CANCELADO" } } } }` — los partidos sin ningún torneo navegable quedan fuera de la lista. El `include.torneos.where` también excluye CANCELADO, así el caller ve solo torneos jugables. `elegirTorneoPrincipal` mantiene el filtro defensivo y la firma `Torneo | null` (retorna null si el array llega vacío — caso edge que no debería ocurrir post-Bug #8). Se preserva la tolerancia del Hotfix #2 al jitter del cron: el filtro se basa en `partido.estado` + `torneos.some(estado != CANCELADO)`, NO en estados específicos del torneo — un torneo en ABIERTO por cron atrasado sigue apareciendo. Side-effects: `LiveMatchTab.torneoId` vuelve a ser `string` no-nullable, el componente `<SinTorneoActivo>` del Hotfix #3 se eliminó, y el tabKey sintético `partido:<id>` ya no se usa. Alternativa descartada: mantener la tolerancia con mejor copy que empujara al usuario a /matches — sigue tirando al usuario a navegar por un resultado "inútil" (no hay ranking donde competir).

- **Hotfix #4 19 Abr — Minuto del partido con label mapeado + cache in-memory (Bug #9):** el `LiveHero` renderizaba `⏱ {minuto ?? "?"}'` y el "?" aparecía literalmente cuando el poller no había propagado un número: primer render antes del primer WS, halftime (api-football pone `status.elapsed = null`), prórroga con status "ET" sin elapsed capturado. Fix en 4 piezas: (1) helper puro `lib/utils/minuto-label.ts:formatMinutoLabel({statusShort, elapsed})` que traduce todos los codes de api-football a labels legibles — HT→"ENT", FT→"FIN", ET→"Prór. {n}'", P→"Penales", AET→"FIN (prór.)", PEN→"FIN (pen.)", NS→"Por empezar", CANC/ABD/AWD con sus propios labels; status desconocido + elapsed numérico devuelve "{n}'"; null/null devuelve "—" (nunca "?"). (2) `live-partido-status.cache.ts` (nuevo) es un `Map<partidoId, {minuto, statusShort, label, updatedAt}>` in-memory con TTL 10 min. El poller lo escribe en cada tick vía `setLiveStatus`. (3) `RankingUpdatePayload` extendido con `minutoLabel: string | null` (aditivo, preservamos `minutoPartido` numérico); `emitirRankingUpdate(torneoId, { partidoId })` lee del cache antes de emitir. (4) UI: `LiveHero.minutoLabel: string | null` (renombrada de `minuto: number | null`), usa `renderMinutoLabel()` para garantizar "—" en null. SSR de `/live-match` precarga el label desde el cache por tab. Decisión de NO persistir: el brief del PO aceptaba ambos caminos; optamos por cache in-memory para no tocar el schema — si el proceso reinicia, los primeros 30s (hasta el próximo tick del poller) muestran "—". Alternativa descartada: persistir `minutoActual` y `statusShort` en columnas de `Partido` — más resiliente pero agrega una migración por valor que cambia cada 30s (alto write traffic).

- **Hotfix #4 19 Abr — Switcher de `/live-match` split + sección de "Partidos finalizados" (Bug #10):** el switcher superior mezclaba partidos EN_VIVO con FINALIZADOS en la misma fila de tabs — el PO pidió separarlos para claridad. Decisión: el switcher pasa a mostrar solo EN_VIVO; los FINALIZADOS (últimas 24h) viven en una nueva sección `<LiveFinalizedSection>` abajo del contenido en vivo, con grid responsive de cards (2-3 cols desktop, 1 mobile). Cada card de finalizado muestra score final, equipos con colores hash, liga + hora Lima, pozo, ganador + premio si ya se distribuyó, y linkea al mismo `/live-match?torneoId=<id>` que rendera el hero en modo post-partido. Se agregó `obtenerFinalizedMatches({sinceHours, limit})` al service; la page hace ambos fetches en paralelo (live + finalizados). La sección de finalizados NO se filtra por liga por decisión del PO — si el caso de uso crece, se puede agregar su propio filter-chips row en el futuro. Alternativa descartada: mantener la mezcla con un separador visual dentro del switcher — seguía siendo un único scroll horizontal y no ayudaba a la jerarquía.

- **Hotfix #4 19 Abr — Filter chips por liga en `/live-match` (Bug #11):** en días pesados (Mundial, fecha doble de ligas) el switcher llegaba a 6+ tabs y el usuario scrolleaba horizontalmente buscando su partido. Decisión: agregar filter chips por liga arriba del switcher, mismo pattern que `/matches` (primitivo `Chip` + estado en `?liga=<slug>` URL). La lista es dinámica — solo aparecen chips para ligas con ≥1 partido EN_VIVO ahora (derivadas server-side con el nuevo `ligaToSlug` inverso de `LIGA_SLUGS`). Chip "Todas" default. Al seleccionar una liga el switcher filtra (la sección de finalizados NO); si el `?torneoId` activo no pertenece a la liga filtrada, se auto-selecciona el primer torneo visible. El hook nuevo `useLigaFilter` maneja solo el eje liga — paralelo a `useMatchesFilters` de /matches que tiene liga + día. Alternativa descartada: reutilizar `useMatchesFilters` directamente en /live-match — arrastra el eje `dia` que no aplica a partidos en vivo; mantener hooks separados hasta que aparezca un caso fuerte de consolidación evita acoplar prematuramente. Deep-linking con `?liga=` preserva compartibilidad con `?torneoId=`.

- **Sub-Sprint 6 20 Abr — Templates de email como HTML strings, NO React Email:** evaluamos `@react-email/components` + `resend@*` pero agregaba 2 deps pesadas (React Email renderiza a HTML en build-time; requiere también `@react-email/render`). Opté por escribir `enviarEmail(payload)` con fetch directo a `https://api.resend.com/emails` (API pública, auth Bearer). Templates como funciones puras `(input) => {subject, html, text}` con helper `wrapEmail(titulo, bodyHtml)` para layout común. Escape XSS explícito en `escapeHtml(s)`. Hex hardcodeados permitidos en `lib/emails/templates.ts` (§14 la regla es para JSX). Ventajas: (a) cero deps nuevas; (b) templates en < 200 líneas totales; (c) fácil de evolucionar sin build-step extra. Trade-off aceptado: sin JSX los templates son menos cómodos de leer; si en el futuro agregamos >10 templates nuevos, migrar a React Email vale la dep.

- **Sub-Sprint 6 20 Abr — Seed de 25 premios con 5 categorías balanceadas:** decisión autónoma sobre qué productos incluir. 5 ENTRADA (estadios peruanos), 5 CAMISETA (selección + 3 grandes de Perú + 1 firmada LIMITADO), 6 GIFT (Plaza Vea/Falabella/Netflix/Spotify — las más universales), 6 TECH (audífonos + parlante + cargadores + power bank + smartwatch + teclado), 3 EXPERIENCIA (cena La Mar + clase entrenador + tour Estadio). Precios con margen ~30% sobre valor referencia en soles (campo interno `valorSoles`, no visible al jugador). Alternativa descartada: generar 50+ premios para dar "catálogo lleno" — sobra en MVP, conviene pocos y deseables. Imágenes: emoji fallback (`🏟️`, `👕`, `🎧`) — evitamos pipeline de CDN/upload de imágenes reales hasta post-MVP; en el catálogo se ve el emoji gigante sobre fondo subtle en cada card.

- **Sub-Sprint 6 20 Abr — Máquina de estados de canjes con cancelación reembolsable:** documentada como constante `TRANSICIONES` en `canjes.service.ts`. PENDIENTE → PROCESANDO → ENVIADO → ENTREGADO, con CANCELADO accesible desde cualquier estado previo a ENTREGADO. La cancelación reembolsa Lukas + restituye stock + crea `TransaccionLukas REEMBOLSO` en `prisma.$transaction`. Alternativa descartada: "una vez ENVIADO, no se puede cancelar sin devolución física primero" — agrega complejidad admin innecesaria en MVP. El admin puede (y debe) gestionar la devolución física fuera del sistema y luego marcar CANCELADO para reembolsar al usuario.

- **Sub-Sprint 6 20 Abr — Emails fire-and-forget DESPUÉS del commit:** tras `prisma.$transaction` retorne, los wrappers `notifyXxx` se disparan con `void` — no bloquean la respuesta HTTP. Si el email falla, la transacción ya commiteó, el usuario ve el resultado en UI, y el logger captura el error. Preferimos un email perdido a bloquear la UX o hacer rollback por un fallo de red a Resend. Alternativa descartada: encolar emails en Redis con retry exponencial — overkill para MVP; cuando tengamos >1k emails/día evaluamos BullMQ o similar.

- **Sub-Sprint 7 20 Abr — SHA-256 en vez de bcrypt para códigos de verificación efímeros:** `crypto.createHash("sha256").update(codigo).digest("hex")` es suficiente para códigos 6 dígitos con TTL 10 min y máx 3 intentos. Bcrypt agregaría latencia de ~50ms por operación sin beneficio real (el espacio de claves es 900000, el TTL de 10 min y el lockout post-3-intentos hacen inviable la fuerza bruta). Alternativa descartada: bcrypt — innecesario + agrega dep. Para passwords permanentes usaríamos bcrypt; para tokens efímeros SHA-256 es el estándar.

- **Sub-Sprint 7 20 Abr — Twilio REST API vía fetch directo, sin dep `twilio@*`:** el SDK oficial de Twilio pesa ~2MB con deps transitivas (axios, etc.). Para el único caso de uso (POST a `/2010-04-01/Accounts/<SID>/Messages.json` con auth Basic base64), fetch directo en ~10 líneas es equivalente. Alternativa descartada: agregar `twilio` al package.json — pesada por lo que usamos. Si en el futuro usamos SMS bidireccional, voice calls, o WhatsApp Business API, la dep se justifica. Fallback si Twilio no está configurado: `notifyVerifCodigoEmail` dispara el código por email (permite smoke local + protección contra Twilio down en prod).

- **Sub-Sprint 7 20 Abr — Código fijo `123456` en modo dev (sin Twilio):** decisión de DX. En `NODE_ENV !== "production"` + Twilio NO configurado, el código siempre es `123456`. La respuesta del endpoint `POST /usuarios/verificacion/telefono` incluye `devCode` para que el frontend lo muestre en un banner info ("🔧 Modo dev: tu código es 123456"). Permite smoke local sin configurar Twilio ni abrir email. En prod con Twilio configurado, `devCode` queda `undefined` y nunca se expone. Alternativa descartada: random siempre + mostrar devCode — igualmente inseguro en dev, confuso por variabilidad.

- **Sub-Sprint 7 20 Abr — DNI uploads en filesystem local (`apps/web/public/uploads/dni`) para MVP:** evalué S3, Cloudflare R2, uploadcare. Filesystem local en Railway con 1 réplica sirve todo lo necesario — archivos accesibles como estáticos de Next.js. Alternativa descartada: R2 o S3 — agregan dep + credenciales + refactor del helper. Cuando escale a multi-réplica, migrar a R2 con storage compartido; el helper `getUploadDir()` es el único punto que conoce la ubicación física, refactorizarlo a adapter es trivial. Límite 1.5MB + allowlist MIME (JPG/PNG) evita DoS por uploads gigantes.

- **Sub-Sprint 7 20 Abr — Soft delete que preserva tickets y transacciones:** `confirmarEliminarCuenta` NO borra tickets, transacciones ni canjes. Solo anonimiza PII en `Usuario` + marca `deletedAt`. Razón regulatoria: los torneos ya finalizados pagaron premios; borrar al ganador rompería la integridad del audit. Razón técnica: cascade delete en `Usuario` llevaría a borrar todos los tickets del torneo (potencialmente contaminando puntos de otros usuarios si hay lookups). Alternativa descartada: hard delete de todo — peligroso e irreversible. Con el soft delete preservamos historia para audit + el usuario no aparece más en UI pública.

- **Sub-Sprint 7 20 Abr — Exportar datos como JSON attachment inline, NO ZIP:** evalué agregar `archiver@*` o `jszip@*` para hacer ZIP con múltiples JSON + instrucciones. Opté por servir un único JSON grande con `Content-Disposition: attachment; filename="habla-datos-<id>-<fecha>.json"` — el browser lo descarga como archivo. Los datos incluyen perfil, transacciones, tickets, canjes en un solo objeto. Alternativa descartada: ZIP con archivos separados + README.md — sobra en MVP; el JSON es suficientemente legible con un viewer online. Si un usuario requiere formato específico para portabilidad GDPR (CSV, por ejemplo), evaluamos en iteración futura.

- **Sub-Sprint 7 20 Abr — Evento custom `perfil:refresh` para gatillar `router.refresh()` desde sub-paneles:** los Client Components (VerificacionPanel, DatosPersonalesPanel, etc.) no pueden invocar directamente un re-render del Server Component padre (`/perfil/page.tsx`). En vez de prop drilling un callback desde el server page (Next 14 no lo permite), dispatchean `new Event("perfil:refresh")` tras mutaciones exitosas. El componente `PerfilRefreshOnUpdate` (client, montado en la page) escucha el evento y llama `router.refresh()`. Alternativa descartada: estado local optimista en cada panel — multiplica complejidad y puede desviar del server-side truth. El pattern del evento custom es idiomático y centraliza la lógica de refresh.

- **Sub-Sprint 7 20 Abr — Defaults de límites 300 S/mes compra, 10 tickets/día:** documentados en §6 de CLAUDE.md desde el inicio del MVP. 300 S/mes corresponde al promedio de consumo de entretenimiento en hogares peruanos clase media; 10 tickets/día son suficientes para que un usuario entusiasta diversifique sus predicciones sin volverse compulsivo. Alternativa descartada: arrancar sin defaults (el usuario elige) — el opt-out por silencio es mal pattern de juego responsable; defaults conservadores protegen al usuario. Alternativa descartada: límites más bajos (100 S/mes, 3 tickets/día) — innecesariamente restrictivos para MVP, el usuario siempre puede subirlos en /perfil.

- **Sub-Sprint 7 20 Abr — Auto-exclusión solo 7/30/90 días, SIN opción "forever":** opción "bloqueo permanente" sería contradictoria con el pattern de auto-exclusión (cooling-off → reconsideración). Para eliminación definitiva existe el flujo separado "Eliminar cuenta". Los 3 escalones son estándar del juego responsable en la industria europea/australiana y replican bien el MVP peruano.

- **Hotfix #9 21 Abr — Catálogo de premios como constante compartida en `@habla/db`, NO duplicada por consumer:** el primer intento natural era tener el catálogo inline en `apps/web/lib/services/premios-seed.service.ts` con los 25 premios. Descartado: el seed local de `packages/db/prisma/seed.ts` (usado en `pnpm db:seed` de dev) también lo necesitaría, y duplicar 25 objetos de 10 campos cada uno es caldo de cultivo para drift cuando un PM cambie un precio solo en uno de los lugares. Puse el catálogo en `packages/db/src/catalog.ts` y lo re-exporté desde `@habla/db` — el seed legacy lo importa por ruta relativa (`../src/catalog`, porque vive dentro del package), el service web lo importa por nombre del package. Alternativa descartada: packages/shared como home del catálogo — no había razón para crear otra dependencia, `@habla/db` ya es el home natural de datos relacionados a Prisma models.

- **Hotfix #9 21 Abr — Endpoint admin `POST /api/v1/admin/seed/premios` vs. 3 alternativas:** el prompt ofrecía (A) correr el seed en el pipeline de deploy, (B) endpoint admin one-shot, (C) script standalone vía `railway run`, (D) migración de datos Prisma. Elegí B por 3 razones concretas. **Idempotencia máxima**: el service hace `findFirst + update|create` por nombre → re-correrlo termina con 25 premios invariablemente. **Menor riesgo de ejecución accidental**: no corre en deploys (que ocurren automáticamente), no modifica datos sin consentimiento explícito; hay que clickear el botón del panel admin o hacer POST con sesión admin activa. **Mejor DX**: el admin puede re-sembrar cuando cambie el catálogo con un click, sin pedir Railway CLI, sin abrir shell, sin escribir un migration file. **Alternativas descartadas**: A (deploy script) regeneraba el catálogo en cada push a main aunque no hubiera cambios en los premios — riesgoso con mutaciones manuales vía Prisma Studio; C (standalone script) requiere Railway CLI + shell access que el PO no tiene en self-service; D (data migration) las migraciones viven en el historial eternamente, rollback costoso, fragilidad de schema-vs-data.

- **Hotfix #9 21 Abr — BottomNav reemplaza "Wallet" con "Perfil" (vs. agregar 6° item o mantener status quo):** el prompt listaba 3 opciones. Elegí reemplazar Wallet porque (a) Wallet tiene **un flow único** (comprar Lukas) y sigue accesible en 1 tap vía `BalanceBadge` del header — que es literalmente un `<Link href="/wallet">` siempre visible; (b) Perfil tiene **múltiples flows importantes** del Sub-Sprint 7 (verificación, límites, preferencias, eliminar cuenta, exportar datos) que antes no tenían entrada visible en mobile; (c) los 5 slots del BottomNav son un **estándar UX mobile** que no quiero romper. Alternativas descartadas: **6° item** cramped en 375px (label 10px truncado) y rompe el estándar de 4-5; **status quo** deja todo el SS7 invisible en mobile aunque desktop tenga UserMenu; **link "Perfil" en NavBar desktop** rompe fidelidad al mockup §10 y el UserMenu ya cumple el target ≤2 clicks. El seguimiento del mockup se preserva: NavBar desktop mantiene los 5 links originales + UserMenu dropdown, BottomNav mobile mantiene 5 items (solo cambia el 5° de "Wallet" a "Perfil"). La regla §14 "≤2 taps/clicks a /perfil desde cualquier página" queda fijada por test antidrift.

- **Hotfix #9 21 Abr — TODO futuro descartado del scope: indicador rojo de "verificaciones pendientes" sobre avatar.** Evalué agregar un puntito rojo sobre el avatar del UserMenu cuando el usuario no verificó teléfono o DNI (mismo pattern del `LiveCountBadge` del Bug #12 Hotfix #5: render null cuando count=0). Descartado del scope del Hotfix #9 por 3 razones: (1) expande el alcance del hotfix más allá de "cerrar brecha entre documentado y desplegado"; (2) requiere agregar un endpoint `GET /api/v1/usuarios/me/verifStatus` o consumir el endpoint del perfil desde el layout, con su propio polling/hidratación; (3) el valor es incremental — el usuario ya tiene entrada clara a /perfil donde ve las verificaciones pendientes en rojo. Si el PO decide agregarlo en un hotfix futuro, el pattern a reusar es `LiveCountBadge` (render null cuando nada pendiente, no crear una bola gris).

---

## 16. MÉTRICA DE ÉXITO DEL SPRINT DE MECÁNICA

Al terminar el Sub-Sprint 7 (5 de junio), un usuario peruano cualquiera debe poder, en una sola sesión:

1. Entrar a habla-app-production.up.railway.app sin cuenta
2. Ver los torneos disponibles
3. Crear su cuenta por magic link, recibir 500 Lukas de bienvenida
4. Comprar 100 Lukas más con tarjeta sandbox (→ 615 con bonus)
5. Inscribirse en un torneo de Liga 1 (costo 10 Lukas)
6. Armar su combinada de 5 predicciones
7. Ver cómo durante el partido sus puntos se actualizan en vivo
8. Al terminar el partido, si quedó en top 10, recibir sus Lukas de premio automáticamente
9. Recibir email del premio
10. Canjear sus Lukas por una entrada de Liga 1 en la tienda
11. Configurar sus notificaciones y ajustar sus límites desde /perfil
12. Cerrar sesión y volver al día siguiente a repetir

Si estas 12 acciones funcionan end-to-end sin bugs críticos, **el MVP está listo para el Mundial**.
