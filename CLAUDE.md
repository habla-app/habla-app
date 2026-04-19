# CLAUDE.md — Habla! App

> Este archivo es el cerebro del proyecto. Léelo completo antes de tocar cualquier código.
> Última actualización: 19 de Abril 2026 (Sub-Sprints 4 y 5 completados — combinadas + motor de puntuación + ranking en vivo + WebSockets en producción vía custom server)

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
- **Rake:** 12% del pozo bruto → ingreso principal de la plataforma
- **Distribución del pozo neto (ejemplo 100 jugadores × S/10):**
  - 1er lugar: 35% — 2° lugar: 20% — 3er lugar: 12% — Puestos 4° a 10°: 33% repartido
  - **Del 11° en adelante: sin premio**
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
  id          String      @id @default(cuid())
  nombre      String
  descripcion String
  costeLukas  Int
  stock       Int         @default(0)
  categoria   String                                 // entrada, camiseta, gift, tech, experiencia
  imagen      String?
  badge       String?                                // POPULAR, NEW, LIMITED
  activo      Boolean     @default(true)
  canjes      Canje[]
  creadoEn    DateTime    @default(now())

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
```

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
- Desempate: marcador exacto → tarjeta roja → orden de inscripción (timestamp).
- Rake exactamente 12% del pozo bruto, al entero de Luka.
- Distribución top 10: **35% / 20% / 12% / 33% repartido entre 4°-10°**.
- Del **11° en adelante no reciben premio**.

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

### Premios y canjes
```
GET   /premios?categoria=                     → catálogo con afordabilidad
POST  /premios/:id/canjear                    → solicita canje
GET   /canjes/mis-canjes                      → estado de mis canjes
```

### Notificaciones y límites
```
GET   /notificaciones/preferencias            → 7 toggles
PATCH /notificaciones/preferencias            → actualizar toggles
GET   /limites                                → límites + uso actual
PATCH /limites                                → editar límites
POST  /limites/auto-exclusion                 → activar bloqueo temporal
```

### Verificación
```
POST  /verificacion/telefono/enviar           → SMS con Twilio
POST  /verificacion/telefono/confirmar        → valida código
POST  /verificacion/dni/subir                 → imagen para review manual
```

### Admin (rol ADMIN)
```
POST  /admin/partidos/importar                → dispara import de api-football
POST  /admin/torneos                          → crear torneo
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
