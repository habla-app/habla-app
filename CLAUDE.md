# CLAUDE.md — Habla! App

> Contexto operativo del proyecto. El historial detallado de bugs vive en `CHANGELOG.md` y en `git log`.
> Última actualización: 21 Abr 2026.

---

## 1. QUÉ ES HABLA!

WebApp de torneos de predicciones sobre partidos de fútbol, mercado peruano. Los usuarios compran **Lukas** (moneda virtual, 1 Luka = S/ 1) para inscribirse en torneos. Gana quien más puntos acumule. Premios en Lukas canjeables por productos en la tienda integrada.

**Posicionamiento:** NO es apuesta — los Lukas no se retiran como efectivo. Es un torneo de habilidad.

**Fecha límite inamovible:** 11 de junio de 2026 — Día 1 del Mundial FIFA 2026.

**URL producción:** `https://habla-app-production.up.railway.app`

---

## 2. MECÁNICA DEL JUEGO

### Flujo del usuario
1. Compra Lukas con Culqi/Yape
2. Elige torneo, paga entrada, arma combinada de 5 predicciones
3. Torneo cierra 5 min antes del partido (predicciones selladas)
4. Puntos y ranking se actualizan en vivo durante el partido
5. Al FT, Lukas del pozo neto se distribuyen automáticamente
6. Canjea Lukas por premios reales en `/tienda`

### Puntuación por ticket (máx 21 pts)
| # | Predicción | Puntos |
|---|-----------|--------|
| 1 | Resultado 1X2 | 3 |
| 2 | Ambos anotan (BTTS) | 2 |
| 3 | Más de 2.5 goles | 2 |
| 4 | Habrá tarjeta roja | 6 |
| 5 | Marcador exacto | 8 |

Máx **10 tickets** por usuario por torneo; constraint en BD impide tickets idénticos.

### Modelo económico
- **Rake 12%** del pozo bruto → ingreso de la plataforma.
- **Distribución del pozo neto:** paga al **10% de inscritos** (cortes: 2-9→1, 10-19→2, 20-29→3, 30-49→5, 50-99→10, 100+→`round(N×0.10)`). Curva top-heavy: 1° recibe **45%**, el 55% restante decae geométricamente entre el resto.
- **Tablas fijas para M≤5:** M=1 [1.00], M=2 [0.65, 0.35], M=3 [0.50, 0.30, 0.20], M=5 [0.40, 0.25, 0.18, 0.10, 0.07].
- **Empates:** tickets con mismo puntaje reparten equitativamente los premios de sus posiciones como grupo. Sin desempate.
- **Implementación:** `lib/utils/premios-distribucion.ts:distribuirPremios()` (función pura).
- **Margen en premios físicos:** ~30%.
- Lukas **comprados** vencen a los 12 meses; **ganados** no vencen.

### Tipos de torneo
| Tipo | Entrada | Partido típico |
|------|---------|----------------|
| EXPRESS | S/ 3–5 | Liga 1, Premier, La Liga |
| ESTANDAR | S/ 10–20 | Champions, Libertadores |
| PREMIUM | S/ 30–50 | Clásicos, Mundial |
| GRAN_TORNEO | S/ 100 | Final del Mundial |

---

## 3. STACK TECNOLÓGICO

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 (React) + Tailwind 3.4, PWA |
| Backend (MVP) | Next.js Route Handlers en `apps/web/app/api/v1/*` (el scaffold `apps/api/` Fastify está congelado como backlog post-MVP) |
| BD | PostgreSQL 16 + Prisma |
| Cache / Realtime | Redis 7 + Socket.io (sobre custom Next server en `apps/web/server.ts`) |
| Auth | NextAuth v5 (beta.30) — Google OAuth + magic link via Resend |
| Pagos | Culqi + Yape API |
| API deportiva | api-football.com (header `x-apisports-key`, NO RapidAPI) |
| Email | Resend (dominio `hablaplay.com`) |
| SMS | Twilio (fetch directo, sin SDK) |
| Hosting | Railway (Dockerfile multi-stage, auto-scaling) |
| CDN | Cloudflare |
| Monorepo | pnpm 10 + Turborepo (`.npmrc` con `node-linker=hoisted`) |

---

## 4. ESTRUCTURA DEL MONOREPO (resumen)

```
habla-app/
├── apps/
│   ├── web/                ← Next.js 14 (MVP: frontend + backend + WS)
│   │   ├── app/            ← pages + api/v1/*
│   │   ├── components/     ← layout, matches, live, combo, tickets, wallet, tienda, perfil, ui
│   │   ├── lib/
│   │   │   ├── services/   ← torneos, tickets, ranking, puntuacion, premios, canjes, limites, notificaciones, verificacion, email, live-matches, partidos-import, seasons.cache, wallet-view
│   │   │   ├── realtime/   ← socket-client, socket-auth, events
│   │   │   ├── utils/      ← datetime, premios-distribucion, nivel, team-colors, round-mapper, minuto-label, matches-page-title, torneo-detail-view
│   │   │   ├── config/     ← ligas, liga-slugs
│   │   │   └── api-client.ts  ← authedFetch
│   │   ├── hooks/          ← useRankingEnVivo, useEventosPartido, useLigaFilter, useMatchesFilters, useMinutoEnVivo, useLiveMatchesCount, useScrollIndicators
│   │   ├── stores/         ← zustand: lukas, notifications
│   │   ├── instrumentation.ts  ← cron in-process (setInterval cada 60s)
│   │   └── server.ts       ← custom Next server + Socket.io
│   └── api/                ← Fastify scaffold (congelado, backlog post-MVP)
├── packages/
│   ├── db/                 ← Prisma schema + seed + src/catalog.ts (catálogo de premios)
│   ├── shared/             ← tipos, constantes
│   └── ui/                 ← componentes compartidos
├── docs/
│   └── habla-mockup-completo.html  ← FUENTE DE VERDAD del diseño
├── CLAUDE.md
├── CHANGELOG.md            ← historial de hotfixes y sub-sprints
├── Dockerfile              ← corre `tsx apps/web/server.ts` (NO `output: "standalone"`)
├── railway.toml            ← builder = "DOCKERFILE"
└── pnpm-workspace.yaml
```

Para explorar a profundidad, usar `ls` sobre el repo.

---

## 5. MODELO DE DATOS

Schema completo en `packages/db/prisma/schema.prisma`. Modelos principales:

- **Usuario** — email, `username` (@handle, **NOT NULL + unique**, 3-20 chars, `^[a-zA-Z0-9_]+$`, unicidad **case-insensitive** — `Gustavo` y `gustavo` colisionan), `usernameLocked` (true tras completar-perfil, inmutable), `tycAceptadosAt`, balanceLukas, rol (JUGADOR|ADMIN), telefonoVerif, dniVerif, deletedAt (soft delete), relaciones a tickets/transacciones/canjes/preferenciasNotif/limites.
- **Partido** — externalId (api-football), liga, equipoLocal/Visita, fechaInicio, estado (PROGRAMADO|EN_VIVO|FINALIZADO|CANCELADO), golesLocal/Visita, flags btts/mas25Goles/huboTarjetaRoja, round, venue.
- **EventoPartido** — tipo (GOL|TARJETA_AMARILLA|TARJETA_ROJA|FIN_PARTIDO|SUSTITUCION), minuto, equipo, jugador. Unique natural key `(partidoId, tipo, minuto, equipo, COALESCE(jugador,''))` para upsert idempotente del poller.
- **Torneo** — tipo (EXPRESS|ESTANDAR|PREMIUM|GRAN_TORNEO), entradaLukas, partidoId, estado (ABIERTO|CERRADO|EN_JUEGO|FINALIZADO|CANCELADO), totalInscritos, pozoBruto, pozoNeto, rake, cierreAt, distribPremios (Json).
- **Ticket** — 5 predicciones (predResultado, predBtts, predMas25, predTarjetaRoja, predMarcadorLocal, predMarcadorVisita), puntos desglosados, posicionFinal, premioLukas. Unique compuesto de las 5 preds + usuarioId + torneoId.
- **TransaccionLukas** — tipo (COMPRA|ENTRADA_TORNEO|PREMIO_TORNEO|CANJE|BONUS|VENCIMIENTO|REEMBOLSO), monto (±), refId, venceEn (solo COMPRA).
- **Premio** — categoria (ENTRADA|CAMISETA|GIFT|TECH|EXPERIENCIA), badge (POPULAR|NUEVO|LIMITADO), featured, requiereDireccion, costeLukas, stock, valorSoles (audit interno).
- **Canje** — estado (PENDIENTE|PROCESANDO|ENVIADO|ENTREGADO|CANCELADO), direccion (Json).
- **PreferenciasNotif** — 7 toggles. Lazy create con defaults.
- **LimitesJuego** — limiteMensualCompra (default S/ 300), limiteDiarioTickets (default 10), autoExclusionHasta.
- **VerificacionTelefono** — código 6 dígitos hash SHA-256, TTL 10 min, máx 3 intentos.
- **VerificacionDni** — imagen local en `apps/web/public/uploads/dni/<hex32>.{jpg|png}`, estado (PENDIENTE|APROBADO|RECHAZADO).
- **SolicitudEliminacion** — token 32 bytes hex, TTL 48h.
- **Auth: Account, Session, VerificationToken** — NextAuth adapter.

---

## 6. REGLAS DE NEGOCIO CRÍTICAS

### Lukas
- 1 Luka = S/ 1. Entero, nunca centavos.
- Todo movimiento es atómico (`prisma.$transaction`). Si falla un paso, rollback total.
- Balance nunca negativo. Verificar ANTES de descontar.
- Lukas **NO retirables** en efectivo.
- Bonus de bienvenida: **500 Lukas** (BONUS, sin vencimiento).
- Packs de compra: 20 (+0), 50 (+5), 100 (+15), 250 (+50).

### Torneos y Tickets
- Cierre inscripciones: **exactamente 5 min antes** del partido. Automático e irreversible.
- Máx **10 tickets** por usuario por torneo. Predicciones enviadas son inmutables.
- Dos tickets del mismo usuario NO pueden tener las 5 preds idénticas (constraint BD).
- Torneo con **<2 inscritos** al cierre → CANCELADO + reembolso `REEMBOLSO`.

### Puntuación y ranking
- Puntos calculados desde eventos de **api-football** (cero intervención manual).
- **Motor proyectivo:** TODOS los campos se proyectan en vivo como "si terminara ahora" (incluido marcador exacto, que muta con cada gol).
- **Marcador exacto:** solo se adjudica al `FINALIZADO`.
- **Tarjeta roja:** se confirma `true` al instante; `false` solo al `FINALIZADO`.
- BTTS y +2.5 se adjudican parcialmente (ej. 1-1 ya confirma BTTS=true).
- Rake 12% exacto al entero. Puestos `M+1` en adelante NO reciben premio.

### Juego responsable
- Edad mínima 18. Verificación al registro.
- Límite mensual de compra: default S/ 300/mes. Bloqueante.
- Límite diario de tickets: default 10/día. Bloqueante.
- Auto-exclusión: solo **7, 30 o 90 días** (constante `AUTOEXCLUSION_DIAS_VALIDOS`).
- Mostrar siempre rake y distribución del pozo antes de inscribir.

### Navegación
- Navegación libre sin login (torneos, ranking, tienda).
- Login solo al intentar: inscribirse, canjear, ver wallet/perfil.
- Tras login continúa al destino (`pendingTorneoId`, `callbackUrl`).
- Middleware bloquea el grupo `(main)` si `session.user.usernameLocked === false` → redirect a `/auth/completar-perfil?callbackUrl=<ruta>` (OAuth primera vez sin @handle definitivo).

### Seguridad
- Rate limiting 60 req/min por IP.
- Verificación email obligatoria para comprar Lukas.

---

## 7. ENTORNO Y COMANDOS

### Variables de entorno (.env.example)
```bash
# BD
DATABASE_URL=postgresql://habla:habla@localhost:5432/habladb
REDIS_URL=redis://localhost:6379   # opcional: si falta, ranking degrada a lectura directa de BD

# Auth
AUTH_SECRET=            # usado también para firmar JWT de WS (5 min)
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=       # Google Cloud Console → OAuth client ID (web)
GOOGLE_CLIENT_SECRET=

# API Deportiva (NO RapidAPI)
API_FOOTBALL_KEY=
API_FOOTBALL_HOST=v3.football.api-sports.io

# Pagos Culqi
CULQI_PUBLIC_KEY=
CULQI_SECRET_KEY=
CULQI_WEBHOOK_SECRET=

# Notificaciones
RESEND_API_KEY=         # si falta, emails se loggean pero no se envían (dev)
TWILIO_ACCOUNT_SID=     # si falta, fallback a email; código dev fijo "123456"
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=
SENTRY_DSN=
```

### Notas Railway
- `DATABASE_URL` NO se hereda entre servicios → usar `${{ Postgres.DATABASE_URL }}` explícito.
- `NEXTAUTH_URL` sin `/` final. `HOSTNAME=0.0.0.0`.
- `trustHost: true` en NextAuth (proxy de Railway).
- Dockerfile corre `tsx apps/web/server.ts` (no `node server.js` de standalone).

### Comandos
```bash
pnpm install
docker-compose up -d
pnpm --filter @habla/db db:migrate
pnpm --filter @habla/db db:seed
pnpm dev          # web + WS en :3000
pnpm test
pnpm build
pnpm lint
pnpm exec tsc --noEmit
```

---

## 8. ESTADO DEL PROYECTO

### ✅ Implementado y en producción
- **Sprint 0 — Fundamentos:** monorepo, Docker Compose, Prisma, CI/CD, Railway deploy, landing, NavBar/BottomNav, paleta Tailwind, fuentes Barlow Condensed + DM Sans.
- **Sprint 1 — Auth:** NextAuth v5 magic link (Resend `hablaplay.com`), custom Prisma adapter, middleware protegido (`/wallet`, `/perfil`, `/admin`), bonus 500 Lukas al registro. Ver registro formal (Abr 2026) para el flujo actual con Google OAuth + username obligatorio.
- **Fase 2 — UI desde mockup:** primitivos (`Button`, `Chip`, `Alert`, `Toast`, `Modal`), NavBar/BottomNav/UserMenu, MatchCard con 4 tiers de urgencia. Cero hex hardcodeados fuera de `tailwind.config.ts` + `globals.css`.
- **Sub-Sprint 3 + 3.5 — Torneos + Auto-import:** CRUD de torneos, inscripción atómica, cancelación por <2 inscritos. Cron in-process en `instrumentation.ts`. Auto-import de temporadas (`seasons.cache.ts`) y partidos cada 6h para ligas whitelisteadas en `lib/config/ligas.ts` (Liga 1 Perú EXPRESS, Champions ESTANDAR, Libertadores ESTANDAR, Premier EXPRESS, La Liga EXPRESS, Mundial 2026 PREMIUM). Cada partido nuevo crea su torneo automáticamente.
- **Fase 3 — UX de /matches:** filtros en URL (`?liga=&dia=`), scroll horizontal de días con `useScrollIndicators`, MatchCard compacta 150px, colores hash por equipo (`team-colors.ts`), zona horaria `America/Lima`.
- **Sub-Sprint 4 — Combinadas:** `ComboModal` centrado, 5 PredCards + ScorePicker, placeholder-ticket que se actualiza al primer envío sin re-cobrar, `/mis-combinadas` con 3 tabs (Activas/Ganadas/Historial), stats pills, chips resueltos por `tickets/adapter.ts`.
- **Sub-Sprint 5 — Motor + Ranking en vivo:** custom Next server con Socket.io (`apps/web/server.ts`), handshake JWT HS256 5 min via `GET /api/v1/realtime/token`, rooms `torneo:{id}`, eventos `ranking:update`/`partido:evento`/`torneo:cerrado`/`torneo:finalizado`. Motor puro `puntuacion.service.ts`. Poller cada 30s con backoff 429. Redis sorted sets (opcional). `/live-match` con hero + switcher + tabs Ranking/Stats/Events + `LiveFinalizedSection` + filter chips por liga. Hook `useMinutoEnVivo` consume `{ statusShort, minuto, extra, elapsedAgeMs }` y delega en `getMinutoLabel` puro — avanza el reloj localmente en 1H/2H/ET, congela en HT/BT/NS/FT/etc.
- **Sub-Sprint 6 — Tienda + Canjes + Emails:** catálogo de 25 premios en `packages/db/src/catalog.ts` (5 categorías, 3 badges, 1 featured). Endpoint admin idempotente `POST /api/v1/admin/seed/premios`. Máquina de estados de canjes (`TRANSICIONES: Record<EstadoCanje, EstadoCanje[]>`). 8 templates de email transaccional en `lib/emails/templates.ts`, wrappers `notifyXxx` en `notificaciones.service.ts`. **Crédito automático de Lukas** al `finalizarTorneo` + auto-reconciliación de torneos FINALIZADOS con crédito incompleto + endpoint admin `POST /api/v1/admin/torneos/:id/reconciliar`.
- **Sub-Sprint 7 — Perfil + Juego responsable:** `/perfil` completo (verificación teléfono/DNI, 7 toggles de notif, límites de compra/tickets, auto-exclusión, eliminar cuenta soft-delete, exportar datos). Niveles 🥉/🥈/🥇/👑 por torneos jugados (`lib/utils/nivel.ts`). Rediseño motivacional de `/torneo/:id` con lista de inscritos, pozo sin tecnicismos, CTA estelar adaptativo.
- **Rediseño mockup v1 (Abr 2026):** re-alineamiento visual 1:1 de `/wallet`, `/tienda`, `/mis-combinadas`, tabs de `/live-match` y `/perfil` al mockup. Tokens `medal.silver/bronze` actualizados al mockup (`#C0C0C0`, `#CD7F32`). Nuevo service `wallet-view.service.ts` (SSR: totales por tipo + próximo vencimiento + historial). Componentes nuevos: `WalletView`/`TxList`/`MovesFilter`/`BuyPacksPlaceholder` en wallet, `HistoryList` (tab historial expandible) en tickets, `SectionShell` + `ProfileFooterSections` en perfil (absorbe `DatosYPrivacidadPanel`). Delta de posición ↑↓= en `RankingTable` vía `useRef` local. Backend, stores, WS y endpoints intactos.
- **Registro formal + rediseño `/perfil` (Abr 2026):** dos rutas separadas `/auth/signin` y `/auth/signup` + `/auth/completar-perfil` para OAuth nuevo. Google provider sumado a NextAuth v5. `username` pasa a NOT NULL + unique, con flag `usernameLocked` (true tras elegir @handle) y `tycAceptadosAt` para audit de T&C. Middleware bloquea `(main)` si `usernameLocked=false` → forza a `/auth/completar-perfil`. Endpoints nuevos: `GET /auth/username-disponible`, `POST /auth/signup`, `POST /auth/completar-perfil`. `/perfil` fue reescrito desde cero (nuevos componentes `VerificacionSection`/`DatosSection`/`NotificacionesSection`/`JuegoResponsableSection`/`FooterSections`); servicios, endpoints y modelos preservados. `@username` reemplaza a `nombre` en NavBar/UserMenu/RankingTable/InscritosList. `PATCH /usuarios/me` ya NO acepta username (inmutable post-registro). Migración destructiva — reset de BD acordado.
- **Ajustes UX sidebar + wallet + perfil (Abr 2026):** Sidebar de `/matches` y `/` reordenado — widget #2 es **"Los Pozos más grandes de la semana"** (torneos de la semana calendario ordenados por `pozoBruto` DESC, TOP 5) y widget #5 es **"Los más pagados de la semana"** (suma de `TransaccionLukas.monto` con tipo `PREMIO_TORNEO` por usuario en la semana, TOP 10); ventana lunes→domingo via `datetime.ts:getWeekBounds`. Balance widget rediseñado (tipografía 52px + border gold + CTA único a `/wallet`). En `/torneo/:id` el CTA desktop vive en la sidebar derecha sobre `RulesCard`. Modal post-envío de combinada invierte énfasis: primario = "Crear otra combinada" (reset), secundario = "Ver mis combinadas" (link). `/wallet` — filtro "Inscripciones" ahora enriquece cada transacción con `partido` (vía `refId → Torneo → Partido`) y muestra el resumen `Local 2-1 Visita` en la lista. Usernames case-sensitive para display, unicidad case-insensitive en BD (regex `^[a-zA-Z0-9_]+$`); filtro `lib/utils/username-filter.ts:esUsernameOfensivo` bloquea slurs + leet-speak básico en los 3 endpoints de auth. `VerificacionSection` actualiza copy DNI a "Requerido para canjear cualquier premio.". `DatosSection` muestra "Por completar" cuando `nombre` está vacío o coincide con el `username`; adapter OAuth ya no copia email/username al nombre. Minuto en vivo simplificado: `getMinutoLabel({ statusShort, minuto, extra })` + propagación de `status.extra` (injury time "45+3'") desde api-football al cache, WS y endpoints REST.

### ⏳ Pendiente
- **Sub-Sprint 2 — Pagos Culqi:** `/wallet` ya tiene UI completa (balance hero, 4 packs, historial), falta integración Culqi.js + webhook `/webhooks/culqi` + acreditación real de Lukas. Endpoints diseñados: `POST /lukas/comprar`, `POST /webhooks/culqi`. Enforcement de límite mensual ya listo (`verificarLimiteCompra` en `limites.service.ts`).
- **Sprint 8 — QA + carga + beta:** Playwright end-to-end, k6 load test 500 usuarios en un torneo, beta con influencers, plan de contingencia documentado.
- **Post-MVP:** ligas privadas (v1.1 jul-ago), gamificación completa (v1.2 sep-oct), WhatsApp Bot + múltiples deportes (v1.3 nov-dic), app nativa React Native (v2.0 Q1 2027).

---

## 9. MAPA DE PANTALLAS

**Fuente de verdad del diseño:** `docs/habla-mockup-completo.html` (también en `/mockup.html`). Cada componente debe replicarlo fielmente.

### Paleta de marca (tokens Tailwind)
- **Core:** `blue-main` #0052CC, `blue-dark` #001050, `blue-mid` #0038B8, `blue-light` #1A6EFF, `gold` #FFB800, `gold-dim` rgba(255,184,0,.15).
- **Estados:** `green` #00D68F, `live` #FF3D3D, `orange` #FF7A00.
- **Urgencia match cards:** `urgent-crit` <15min, `urgent-high` <1h, `urgent-mid` <3h, `urgent-low` >3h (cada uno con variante `-bg`).
- **Acento por tipo:** Mundial #8B5CF6, Clásico #DC2626, Libertadores #059669.
- **Dark surfaces:** `dark-surface` #001050, `dark-card` #0A2080, `dark-card-2` #0D2898, `dark-border` #1A3AA0.
- **Pred chips:** `pred-correct` verde, `pred-wrong` rojo, `pred-pending` gris.
- **Radius:** sm 8, md 12, lg 16, xl 20.
- **Fuentes:** Barlow Condensed (títulos, scores) + DM Sans (cuerpo).

### Páginas
| Ruta | Contenido |
|------|-----------|
| `/auth/signin` | Login de cuenta existente. Google OAuth (botón) + form email (magic link). Si el email no está registrado → redirect a `/auth/signup` con `hint=no-account`. |
| `/auth/signup` | Crear cuenta nueva. Google OAuth (botón) + form email + username (`@handle` único, 3-20 chars) + checkbox T&C / mayor de 18. Cierra creando usuario + bonus 500 Lukas y dispara magic link via `signIn("resend")`. |
| `/auth/completar-perfil` | Post-OAuth Google primera vez. Usuario elige su @handle definitivo (inmutable después) + acepta T&C. Middleware redirige aquí hasta `usernameLocked=true`. |
| `/` y `/matches` | Filter chips (liga + día scroll horizontal) + match cards por urgencia + sidebar sticky. Sidebar (top→bottom): **1)** En vivo ahora · **2)** Los Pozos más grandes de la semana · **3)** Tu balance · **4)** Cómo se pagan los premios · **5)** Los más pagados de la semana. Título derivado de filtros via `buildMatchesPageTitle`. |
| `/live-match` | Filter chips por liga + LiveSwitcher (solo EN_VIVO) + LiveHero (dark, score dorado, 4 stats, timeline) + mi ticket destacado + tabs Ranking/Stats/Events + LiveFinalizedSection abajo (últimas 24h). |
| `/torneo/:id` | Hero motivacional: "Pozo" único (sin "bruto/neto/rake" en copy visible), stats pills, lista de inscritos con nivel + @handle (predicciones ocultas hasta el cierre), CTA estelar adaptativo por estado + back button. |
| `/mis-combinadas` | 5 stats pills (Jugadas, Ganadas, Acierto%, Balance, Mejor puesto) + tabs Activas/Ganadas/Historial + match groups con tickets. |
| `/tienda` | Shop stats (3 cards) + featured prize + category chips + prize grid v2 con progress bars si no afordable. |
| `/wallet` | Balance hero 64px + mini stats (comprado/ganado/canjeado) + 4 pack cards + legal note + filter chips historial + tx-list. |
| `/perfil` | Hero con avatar + nivel + progreso → stats grid (6) → quick access (4) → Verificación → Datos personales → Notificaciones (7 toggles) → Juego responsable → Seguridad → Ayuda → Legal → Danger zone. |
| `/admin` | Panel crear torneos + importar partidos + gestionar canjes + sembrar catálogo de premios (`AdminSeedPremiosPanel`). |

### Componentes comunes
- **NavBar desktop:** logo + links (Partidos · 🔴 En vivo · Mis combinadas · Tienda) + `BalanceBadge` (link a /wallet, siempre visible) + `UserMenu` dropdown.
- **BottomNav mobile** (5 items): Partidos · En vivo · Tickets · Tienda · **Perfil** (NO Wallet — Wallet sigue en 1 tap via BalanceBadge del header).
- **LiveCountBadge:** render `null` si count=0, nunca muestra "0" ni dot gris.

---

## 10. API ENDPOINTS

Base: `/api/v1`. Protegidos requieren sesión NextAuth (cookie). Admin requiere `rol === "ADMIN"`.

### Lukas y Pagos
```
GET   /lukas/balance
GET   /lukas/historial?tipo=&page=
POST  /lukas/comprar                    ← Sub-Sprint 2 (pendiente Culqi)
POST  /webhooks/culqi                   ← valida firma CULQI_WEBHOOK_SECRET
```

### Torneos
```
GET   /torneos?estado=&liga=&desde=&hasta=&page=   ← ISO 8601 UTC
GET   /torneos/:id                                  ← + miTicket si hay sesión
POST  /torneos/:id/inscribir                        ← crea Ticket placeholder + descuenta
GET   /torneos/:id/ranking?page=&limit=             ← + miPosicion + premios estimados
```

### Tickets
```
POST  /tickets                                                  ← crea ticket con 5 preds
GET   /tickets/mis-tickets?estado=ACTIVOS|GANADOS|HISTORIAL
GET   /tickets/stats                                            ← jugadas, ganadas, aciertoPct, neto, mejorPuesto
```

### Partidos + Realtime
```
GET   /partidos/:id/eventos                ← cronológico asc
GET   /partidos/:id/stats                  ← cache in-memory 15s
GET   /live/matches                        ← partidos EN_VIVO + top 3 por torneo
GET   /live/count                          ← solo { count } barato
GET   /realtime/token                      ← JWT HS256 5 min para WS
```

### Premios / Canjes
```
GET   /premios?categoria=&soloConStock=
POST  /premios/:id/canjear                 ← body: { direccion? }
GET   /canjes/mis-canjes?estado=&limit=&offset=
```

### Usuario / Perfil (SS7)
```
GET/PATCH  /usuarios/me
POST       /usuarios/me/eliminar                → email con token 48h
POST       /usuarios/me/eliminar/confirmar      ← body: { token } → soft delete + anonimiza
POST       /usuarios/me/datos-download          → email con link JSON attachment
GET/PATCH  /usuarios/notificaciones             ← 7 toggles
GET/PATCH  /usuarios/limites
POST       /usuarios/limites/autoexclusion      ← body: { dias: 7|30|90 }
POST       /usuarios/verificacion/telefono      ← envía código SMS o email fallback
POST       /usuarios/verificacion/telefono/confirmar
GET/POST   /usuarios/verificacion/dni           ← upload local base64
```

### Admin (rol ADMIN)
```
POST  /admin/partidos/importar
POST  /admin/torneos
POST  /admin/torneos/:id/reconciliar            ← recalcula + acredita deltas
POST  /admin/seed/premios                       ← idempotente (findFirst + update|create)
GET   /admin/canjes?estado=
PATCH /admin/canjes/:id
GET   /admin/metricas
```

---

## 11. WEBSOCKETS

Socket.io montado sobre custom Next server (`apps/web/server.ts`). Path `/socket.io`.

- **Handshake:** cliente hace `GET /api/v1/realtime/token` (JWT HS256 5 min, firmado con `AUTH_SECRET`) y lo pasa como `auth.token`. Sin token = anónimo (puede leer rankings). Token inválido = rechazo.
- **Rooms:** `torneo:{torneoId}`.
- **Cliente → Server:** `join:torneo { torneoId }`, `leave:torneo { torneoId }`.
- **Server → Cliente:**
  - `ranking:update { torneoId, ranking[], totalInscritos, pozoNeto, minutoLabel, minutoPartido, minutoExtra, statusShort, elapsedAgeMs, timestamp }`
  - `partido:evento { torneoId, partidoId, tipo, equipo, minuto, jugador, marcadorLocal, marcadorVisita }`
  - `torneo:cerrado { torneoId }`
  - `torneo:finalizado { torneoId, ganadores[] }`
- **Cliente (`lib/realtime/socket-client.ts`):** ref-counting sobre rooms (solo el último `leave` efectivo cierra). Reconexión con backoff 1s→10s.

---

## 12. INTEGRACIONES

### Culqi (pagos, SS2 pendiente)
- Culqi.js en frontend → token → backend ejecuta cargo con secret key.
- Webhook valida firma con `CULQI_WEBHOOK_SECRET`.
- Sandbox: aprobada `4111 1111 1111 1111`, rechazada `4000 0000 0000 0002`.

### api-football.com
- Header `x-apisports-key` (NO `X-RapidAPI-Key`).
- Endpoints clave: `/fixtures?date=`, `/fixtures/events?fixture=`, `/fixtures?live=all`, `/fixtures/statistics`, `/leagues?id=X&current=true`.
- Poller cada 30s mientras EN_VIVO. Mapper: `Goal→GOL`, `Card/Red→TARJETA_ROJA`, `status.short=FT→FIN_PARTIDO`.
- Temporada resuelta dinámicamente via `seasons.cache.ts` (refresh 24h), NO hardcodeada.

### NextAuth v5 + Resend
- Magic link, dominio `hablaplay.com` verificado.
- Custom adapter mapea `Usuario.nombre` al contrato NextAuth.
- Session strategy JWT (sin roundtrips a BD), balance se lee en callback session.
- `trustHost: true` para Railway proxy.

### Twilio (SMS)
- Verificación teléfono con código 6 dígitos. Fetch directo (sin SDK).
- Sin config → fallback a email. Dev sin Twilio → código fijo `123456`.

---

## 13. CONVENCIONES DE CÓDIGO (reglas duras)

### Base
- TypeScript strict. Archivos kebab-case, funciones camelCase, tipos PascalCase.
- Rutas API `/api/v1/{recurso}` plural, kebab-case.
- Validación con **Zod** en entrada. Errores con clases tipadas (nunca `throw new Error("string")`).
- Logs con **Pino** (nunca `console.log`).
- Commits Conventional (`feat:`, `fix:`, `chore:`, `docs:`). Branches `main` (prod), `develop`, `feat/nombre`.

### Frontend
- **Cero hex hardcodeados** en JSX/TSX. Usar tokens Tailwind (`brand-*`, `urgent-*`, `accent-*`, `dark-*`, `pred-*`). Excepciones documentadas: atributos SVG `stroke`/`fill` inline y `style={{ background }}` con mappers puros (`getLigaAccent`, `getTeamColor`).
- **Fechas:** prohibido `Date.prototype.toLocaleString/Date/Time` sin `timeZone` explícito. Usar helpers de `lib/utils/datetime.ts` (`formatKickoff`, `formatCountdown`, `getDayKey`, `getDayBounds`, `formatDayChip`). Default `America/Lima`.
- **Fetches client-side a `/api/v1/*` pasan por `authedFetch`** (`lib/api-client.ts`). Centraliza `credentials: 'include'`. Test antidrift revienta ante `fetch("/api/v1` directo.
- **Páginas autenticadas o con datos en vivo** exportan `export const dynamic = "force-dynamic"` (al menos: `/wallet`, `/mis-combinadas`, `/perfil`, `/matches`, `/`, `/live-match`, `/torneo/[id]`).

### Lukas balance (cross-página)
- **Único source of truth:** `useLukasStore` (Zustand).
- El layout `(main)/layout.tsx` llama `auth()` y pasa `initialBalance` a `<LukasBalanceHydrator>` que hace `setBalance` en `useEffect`.
- Client components que muestren balance usan **pattern mounted-guard:** `mounted ? storeBalance : initialBalance`. Prohibido leer `session.user.balanceLukas` directo en Client Component (whitelist: 4 RSC que lo pasan como prop).
- Tras toda mutación de Lukas (inscripción, canje, compra, reembolso), el endpoint retorna `{ ..., nuevoBalance }` y el cliente llama `setBalance(json.data.nuevoBalance)`. Prohibido derivar balance sumando/restando transacciones client-side.

### Modales
- Modales DEBEN renderizar con `createPortal(overlay, document.body)` (`components/ui/Modal.tsx`). Sin esto, cualquier ancestor con `transform`/`filter`/`opacity` rompe el `position: fixed`.

### Emails y notificaciones
- SIEMPRE pasar por wrappers `notifyXxx` de `lib/services/notificaciones.service.ts` (8: `notifyPremioGanado`, `notifyCanjeSolicitado`, `notifyCanjeEnviado`, `notifyCanjeEntregado`, `notifyTorneoCancelado`, `notifyVerifCodigoEmail`, `notifySolicitudEliminar`, `notifyDatosDescargados`). Prohibido llamar `enviarEmail` directo.
- Cada wrapper: (1) chequea `debeNotificar(usuarioId, tipo)`, (2) skippea si `deletedAt` o sin email, (3) renderiza template puro, (4) dispara `enviarEmail`. try/catch con `logger.error` — email fallido NO rompe flujo.
- `PreferenciasNotif` lazy-create con defaults. 5 toggles `true` por default; `notifPromos` y `emailSemanal` son opt-in.
- Emails fire-and-forget DESPUÉS del commit, NO dentro de `$transaction`.

### Límites de juego responsable
- Lógica vive SOLO en `lib/services/limites.service.ts`. Helpers: `verificarLimiteInscripcion`, `verificarLimiteCanje`, `verificarLimiteCompra`, `bloquearSiAutoExcluido`. Prohibido replicar queries de conteo en otros archivos.
- Auto-exclusión: solo 7/30/90 días (constante `AUTOEXCLUSION_DIAS_VALIDOS`). Tanto service, Zod del endpoint y modal de /perfil leen de la misma constante.
- Se chequea ANTES de descontar Lukas, no después.

### Finalización de torneo (crítico)
- `finalizarTorneo(torneoId)` dentro de `prisma.$transaction`:
  1. Llama `recalcularTorneo(torneoId)` PRIMERO (motor proyectivo del Hotfix #6 puede dejar puntos stale si el poller recalculó con EN_VIVO justo antes del FT).
  2. Aplica `distribuirPremios` (45% al 1°, decaimiento geométrico entre el resto).
  3. Por cada ticket con `premioLukas > 0`: `Usuario.balanceLukas += premioLukas` + crea `TransaccionLukas { tipo: PREMIO_TORNEO, monto, refId: torneoId }` + update `Ticket.posicionFinal`.
  4. Torneo → FINALIZADO.
- **Auto-reparación:** si el torneo ya estaba FINALIZADO al entrar, llama `detectarCreditoIncompleto(torneoId)`; si delta > 0, dispara `reconciliarTorneoFinalizado` dentro de try/catch (no rompe el poller). Idempotente.
- **`detectarCreditoIncompleto`** es el único helper que decide si hay crédito faltante — prohibido inlinear la lógica.

### Canjes — máquina de estados
- `TRANSICIONES: Record<EstadoCanje, EstadoCanje[]>` en `canjes.service.ts` documenta: `PENDIENTE → [PROCESANDO, CANCELADO]`, `PROCESANDO → [ENVIADO, CANCELADO]`, `ENVIADO → [ENTREGADO, CANCELADO]`, `ENTREGADO` y `CANCELADO` terminales. Cualquier otra revienta `LimiteExcedido`.
- Cancelación reembolsa Lukas + restituye stock + crea `REEMBOLSO` — todo en `$transaction`.

### Verificaciones
- Código teléfono: 6 dígitos, TTL 10 min, SHA-256, máx 3 intentos. Dev sin Twilio → `123456`. Si Twilio falla → fallback email.
- DNI: upload local `apps/web/public/uploads/dni/<hex32>.{jpg|png}`. DNI peruano 8 dígitos, MIME `image/jpeg|jpg|png`, máx 1.5MB.

### Eliminar cuenta
- Soft delete + anonimización en `$transaction`: `nombre="Usuario eliminado"`, `email=deleted-<id8>-<ts>@deleted.habla.local`, `username=deleted_<id10>` (NOT NULL → handle anonimizado único en vez de null), `usernameLocked=true`, `telefono/ubicacion/image=null`, `deletedAt=new Date()`, `session.deleteMany`.
- **PRESERVA** tickets, transacciones, canjes (integridad financiera y de ranking).
- Token TTL 48h. Segunda llamada al mismo token → `YA_CONFIRMADO 409`.

### Perfil
- Ruta protegida. **Acceso ≤2 taps/clicks** desde cualquier página del grupo `(main)`: desktop via UserMenu dropdown (2 clicks), mobile via BottomNav item "Perfil" (1 tap).
- Wallet mantiene la misma regla via `BalanceBadge` del header.
- Tras mutaciones (verificar teléfono, subir DNI, editar datos), Client Components dispatchean `new Event("perfil:refresh")` → `PerfilRefreshOnUpdate.tsx` llama `router.refresh()`.
- **`@username` es permanente** post-registro. El row en `DatosSection` es read-only con tooltip "Tu @handle es permanente". `PATCH /usuarios/me` no acepta `username`. Si se necesita cambiar (error manifiesto, soporte), hacerlo en Prisma Studio como operación admin.

### Operaciones admin one-shot
- Seeds, reconciliaciones, imports se exponen como endpoints `POST /api/v1/admin/*` con auth ADMIN, `force-dynamic`, idempotentes, contadores en response, logs Pino. 
- **Prohibido:** ejecutarlas en `startCommand`/`Dockerfile`/`.github/workflows` (corren en cada deploy, mutan datos, dificultan rollback). Prohibido scripts que requieran `railway run`.
- Ejemplos: `POST /admin/torneos/:id/reconciliar`, `POST /admin/seed/premios`.

### Catálogo de premios
- Fuente única: `packages/db/src/catalog.ts` (`CATALOGO_PREMIOS`, `ReadonlyArray<CatalogoPremio>`).
- Consumen: `packages/db/prisma/seed.ts` (ruta relativa) y `apps/web/lib/services/premios-seed.service.ts` (via `@habla/db`). Prohibido duplicar la constante.
- 25 premios, 5 categorías, 3 badges, 1 featured. Test antidrift verifica unicidad de nombres.

### `/live-match`
- Excluye partidos cuyos torneos estén TODOS en CANCELADO (no navegables).
- Switcher solo EN_VIVO; FINALIZADOS en `LiveFinalizedSection` separada (últimas 24h).
- Filter chips por liga arriba del switcher. Hook `useLigaFilter` en URL.

---

## 14. DECISIONES TÉCNICAS CLAVE (afectan futuro código)

- **Backend MVP en Next Route Handlers, NO Fastify:** `apps/api/` Fastify está congelado. Cuando el evento loop se sature post-Mundial, migrar. Mientras, todo en `apps/web/app/api/v1/*` con `auth()` directo.
- **WebSockets en custom Next server, NO proceso separado:** `apps/web/server.ts` monta Socket.io sobre el HTTP de Next. JWT HS256 5 min firmado con `AUTH_SECRET` (compartido con NextAuth). Trade-off: sin `output: "standalone"`; Dockerfile corre `tsx server.ts`.
- **Cron in-process (`instrumentation.ts` + setInterval 60s):** Railway corre 24/7, a diferencia de Vercel serverless. Sin deps externas, granularidad arbitraria. Caveat: si escalas a >1 réplica, mover a servicio dedicado con `replicas=1` o leader-lock en Redis. Endpoint `/api/cron/cerrar-torneos` queda como trigger manual opcional.
- **Temporada de ligas resuelta dinámicamente:** `seasons.cache.ts` llama `/leagues?id=X&current=true` cada 24h. Cuando Liga 1 pase de 2026 a 2027, sistema lo recoge sin deploy.
- **Poller idempotente:** unique natural key `(partidoId, tipo, minuto, equipo, COALESCE(jugador,''))` en `EventoPartido`. Atrapamos `P2002` como dup. Motor de puntuación es función pura; re-correrlo escribe los mismos números.
- **Ticket placeholder en inscripción:** se crea con preds default (LOCAL/0-0/todo false); primera edición del usuario lo ACTUALIZA sin re-cobrar entrada.
- **Colores de equipo por hash determinista** (`team-colors.ts`), no colores oficiales (evita trademark).
- **Filtros en URL, no client state:** `useMatchesFilters` + `useLigaFilter` con `useSearchParams` + `router.replace`. Permite deep-link y refresh estable.
- **Default `/matches` muestra "Todos", no "Hoy":** si no hay partidos hoy (día muerto), la página no se ve vacía.
- **Día chip con mes solo si sale del mes actual** (no por distancia), para desambiguar salto jul→ago o dic→ene.
- **DNI upload local filesystem:** MVP con 1 réplica Railway. Cuando escale multi-réplica, migrar a R2 (helper `getUploadDir()` es el único punto que toca path local).
- **Imágenes de premios con emoji fallback:** evita pipeline CDN en MVP. Cada premio tiene emoji (`🏟️`, `👕`, `🎧`).
- **Resend sin SDK:** wrapper minimal en `email.service.ts` hace POST directo a `api.resend.com/emails`. Sin `RESEND_API_KEY` → loggea y devuelve `{skipped:true}`; `NODE_ENV=test` → sink in-memory `__peekTestEmails()`.
- **Twilio sin SDK:** mismo patrón, fetch directo a REST API.
- **NextAuth v5 beta.30 con custom Prisma adapter:** mapea `Usuario.nombre` al contrato. Decisión de no migrar a stable hasta post-Mundial.
- **Registro formal con username obligatorio (Abr 2026):** OAuth Google crea usuarios con `username` temporal `new_<hex>` + `usernameLocked=false`; el middleware fuerza a `/auth/completar-perfil` antes de dejar entrar al grupo `(main)`. Email sign-up (POST `/api/v1/auth/signup`) crea con username real desde el vamos. Alternativa descartada: `username` nullable + chequeo null en middleware — elegimos NOT NULL + flag para que los payloads de ranking/inscritos siempre tengan handle garantizado sin special-casing.

---

## 15. MÉTRICA DE ÉXITO DEL MVP

Al 5 de junio, un usuario peruano cualquiera debe poder en una sola sesión:

1. Entrar a `habla-app-production.up.railway.app`
2. Ver torneos disponibles sin cuenta
3. Crear cuenta por Google o magic link + elegir @handle → recibir 500 Lukas de bienvenida
4. Comprar 100 Lukas con tarjeta sandbox (→ 615 con bonus) ⏳ pendiente SS2
5. Inscribirse en torneo de Liga 1 (10 Lukas)
6. Armar combinada de 5 predicciones
7. Ver puntos actualizándose en vivo durante el partido
8. Recibir Lukas de premio automáticamente si quedó en top
9. Recibir email del premio
10. Canjear Lukas por entrada en `/tienda`
11. Configurar notificaciones y límites en `/perfil`
12. Cerrar sesión y volver al día siguiente

Si estas 12 acciones funcionan end-to-end, **el MVP está listo para el Mundial**.
