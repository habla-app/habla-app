# CLAUDE.md — Habla! App

> Contexto operativo del proyecto. El historial detallado de bugs vive en `CHANGELOG.md` y en `git log`.
> Última actualización: 26 Abr 2026 (Lote 6B-fix2 — hotfix balance sistémico + homogenización ancho páginas + rediseño wallet según mockup).

---

## Política de validación: producción primero, no local

**No correr la app, ni hacer migraciones, ni levantar la base de datos en local.** El entorno de desarrollo único es producción en Railway + base de datos en Railway. Hacer cualquier validación en local consume tokens y tiempo sin valor agregado, porque no replica el entorno real.

**Reglas concretas:**

- **NO correr** `pnpm dev`, `pnpm start`, `next dev`, `next build` (salvo cuando el typecheck/lint lo requiera implícitamente).
- **NO correr** `prisma migrate dev` ni `prisma db push` localmente.
- **NO levantar** Postgres ni Redis en local con Docker, docker-compose, ni equivalente.
- **NO ejecutar scripts** que requieran conexión a BD ni a Redis.
- **NO simular** webhooks ni endpoints contra una BD ficticia local.

**Lo que SÍ se hace antes de cada push:**

- `pnpm tsc --noEmit` (typecheck en memoria, sin levantar nada).
- `pnpm lint` (estático, sin levantar nada).
- Inspección estática del código (leer archivos, validar imports, verificar tipos).
- Preparar migraciones de Prisma con `prisma migrate dev --create-only` si aplica (genera el SQL pero NO lo aplica).

**Validación funcional:**

- Ocurre POST-DEPLOY en Railway producción.
- Es responsabilidad del usuario (Gustavo) ejecutar los checks manuales reportados al final de cada lote.
- Si Claude Code necesita "verificar" algo de comportamiento dinámico, lo describe textualmente en el reporte para que el usuario lo pruebe en producción.

**Excepción única:** si el usuario solicita explícitamente probar algo en local, Claude Code puede hacerlo. Sin solicitud explícita, asumir prod-first.

---

## 1. QUÉ ES HABLA!

WebApp de torneos de predicciones sobre partidos de fútbol, mercado peruano. Los usuarios compran **Lukas** (moneda virtual, 1 Luka = S/ 1) para inscribirse en torneos. Gana quien más puntos acumule. Premios en Lukas canjeables por productos en la tienda integrada.

**Posicionamiento:** NO es apuesta — los Lukas no se retiran como efectivo. Es un torneo de habilidad.

**Fecha límite inamovible:** 11 de junio de 2026 — Día 1 del Mundial FIFA 2026.

**URL producción:** `https://hablaplay.com` (Cloudflare DNS + proxy → Railway). Host alterno activo: `https://www.hablaplay.com`.

---

## 2. MECÁNICA DEL JUEGO

### Flujo del usuario
1. Compra Lukas con Culqi/Yape
2. Elige torneo, paga entrada, arma combinada de 5 predicciones
3. Torneo cierra al kickoff (predicciones selladas)
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
- **Entrada uniforme: 3 Lukas** para todos los torneos (Plan v6 / Lote 4). Constante `ENTRADA_LUKAS` en [lib/config/economia.ts](apps/web/lib/config/economia.ts). Torneos preexistentes con entrada distinta (5/10/30/100) conservan su valor — el cambio solo aplica a torneos creados desde Lote 4.
- **Rake 12%** del pozo bruto → ingreso de la plataforma.
- **Distribución del pozo neto:** paga al **10% de inscritos** (cortes: 2-9→1, 10-19→2, 20-29→3, 30-49→5, 50-99→10, 100+→`round(N×0.10)`). Curva top-heavy: 1° recibe **45%**, el 55% restante decae geométricamente entre el resto.
- **Tablas fijas para M≤5:** M=1 [1.00], M=2 [0.65, 0.35], M=3 [0.50, 0.30, 0.20], M=5 [0.40, 0.25, 0.18, 0.10, 0.07].
- **Redondeo (Plan v6):** cada premio = `floor(porcentaje × pozoNeto)`. El residual por redondeo se suma al **1°** para que `sum(premios) === pozoNeto`.
- **Empates:** tickets con mismo puntaje reparten equitativamente los premios de las posiciones que ocupan como grupo. **Split acotado al último puesto pagado M:** si el grupo se extiende más allá de M, la suma de shares se acota a `posStart..M` (no se incluyen shares con índice ≥ M); el monto resultante se divide entre todos los miembros del grupo. Sin desempate adicional.
- **Implementación:** `lib/utils/premios-distribucion.ts:distribuirPremios()` (función pura).
- **Margen en premios físicos:** ~30%.
- Bonus de bienvenida: **15 Lukas** (BONUS, sin vencimiento). Constante `BONUS_BIENVENIDA_LUKAS`.
- Lukas **comprados** vencen a los **36 meses**; **ganados** no vencen. Constante `MESES_VENCIMIENTO_COMPRA`.

### 3 bolsas de Lukas (Lote 6A)
Los Lukas se dividen en 3 bolsas lógicas. La suma siempre iguala `balanceLukas` (compat hacia atrás).

| Bolsa | Campo | Origen | Vence | Canjeable |
|-------|-------|--------|-------|-----------|
| **Compradas** | `balanceCompradas` | Compra con Culqi/Yape | Sí, 36 meses por lote FIFO | No |
| **Bonus** | `balanceBonus` | Bienvenida + bonus de pack | No | No |
| **Ganadas** | `balanceGanadas` | Premio de torneo | No | **Sí** |

**Reglas de descuento:** Bonus → FIFO Compradas (más antiguas primero via `saldoVivo`) → Ganadas.  
**Canjes en /tienda:** solo usa bolsa Ganadas (`getBalanceCanjeable`). Si Ganadas < coste → `BalanceInsuficiente`.  
**Reembolsos:** se restaura a la bolsa de origen (guardada en `metadata.composicion` de la ENTRADA_TORNEO).  
**Cron vencimiento:** job en `vencimiento-lukas.job.ts`, tick cada 1h vía `instrumentation.ts`. Envía avisos 30d y 7d antes; ejecuta descuento el día 0. Endpoint manual: `POST /api/cron/vencimiento-lukas`.  
**Backfill post-deploy:** `POST /api/v1/admin/backfill/bolsas` (Bearer CRON_SECRET). Idempotente.

### Tipos de torneo (Plan v6: solo informativos)
Las etiquetas `EXPRESS / ESTANDAR / PREMIUM / GRAN_TORNEO` se mantienen como **badge visual** para que el usuario distinga torneos casuales vs grandes finales. **No afectan reglas económicas** (entrada, rake, distribución, cierre — todos uniformes).

| Tipo | Partido típico |
|------|----------------|
| EXPRESS | Liga 1, Premier, La Liga |
| ESTANDAR | Champions, Libertadores |
| PREMIUM | Clásicos, Mundial (fase de grupos) |
| GRAN_TORNEO | Final del Mundial |

### Catálogo de ligas (Lote 5 — Plan v6 §4.4)

19 ligas/competiciones soportadas. Fuente única de verdad: [`lib/config/ligas.ts`](apps/web/lib/config/ligas.ts) → `LIGAS`. El job de auto-import recorre `LIGAS_ACTIVAS = LIGAS.filter(l => l.activa)`. `liga-slugs.ts` deriva de `LIGAS` (no duplicar).

| # | Liga (slug) | api-football | Estado Abr 2026 |
|---|---|---|---|
| 1  | Liga 1 Perú (`liga-1-peru`) | 281 | en temporada |
| 2  | Mundial 2026 (`mundial`) | 1 | en temporada |
| 3  | Premier League (`premier`) | 39 | en temporada |
| 4  | La Liga (`la-liga`) | 140 | en temporada |
| 5  | Serie A Italia (`serie-a`) | 135 | en temporada |
| 6  | Bundesliga (`bundesliga`) | 78 | en temporada |
| 7  | Ligue 1 (`ligue-1`) | 61 | en temporada |
| 8  | Brasileirão (`brasileirao`) | 71 | en temporada |
| 9  | Argentina Primera (`argentina-primera`) | 128 | en temporada |
| 10 | Champions League (`champions`) | 2 | en temporada |
| 11 | Europa League (`europa-league`) | 3 | en temporada |
| 12 | Conference League (`conference-league`) | 848 | en temporada |
| 13 | Copa Libertadores (`libertadores`) | 13 | en temporada |
| 14 | Copa Sudamericana (`sudamericana`) | 11 | en temporada |
| 15 | Mundial de Clubes (`mundial-clubes`) | 15 | off-season → 2029 |
| 16 | Eliminatorias CONMEBOL (`eliminatorias-conmebol`) | 34 | off-season → ciclo 2030 |
| 17 | Copa América (`copa-america`) | 9 | off-season → 2027 |
| 18 | Eurocopa (`eurocopa`) | 4 | off-season → 2028 |
| 19 | UEFA Nations League (`nations-league`) | 5 | en temporada |

Las 4 ligas en off-season permanecen `activa: true`; el poller las consulta cada 6h y devuelve 0 fixtures hasta que api-football active la nueva temporada (entonces `seasons.cache` la recoge automáticamente sin intervención).

**Categorías** (campo `categoria` por liga, para targeting de bots de marketing en Lote 10):
- `liga-1-peru` (1) — Liga 1 Perú.
- `liga-extranjera-top` (7) — Premier, La Liga, Serie A IT, Bundesliga, Ligue 1, Brasileirão, Argentina Primera.
- `champions-clasicos-mundial-grupos` (6) — UCL, UEL, UECL, Libertadores, Sudamericana, Mundial Clubes.
- `etapas-finales` (5) — Eliminatorias, Copa América, Eurocopa, Nations League, Mundial 2026.

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
│   │   │   ├── config/     ← ligas, liga-slugs, economia (constantes Plan v6), usernames-reservados
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

- **Usuario** — email, `username` (@handle, **NOT NULL + unique**, 3-20 chars, `^[a-zA-Z0-9_]+$`, unicidad **case-insensitive** — `Gustavo` y `gustavo` colisionan), `usernameLocked` (true tras completar-perfil, inmutable), `tycAceptadosAt`, `balanceLukas` (total suma de las 3 bolsas), `balanceCompradas/Bonus/Ganadas` (Lote 6A — las 3 bolsas individuales), rol (JUGADOR|ADMIN), telefonoVerif, dniVerif, deletedAt (soft delete), relaciones a tickets/transacciones/canjes/preferenciasNotif/limites.
- **Partido** — externalId (api-football), liga, equipoLocal/Visita, fechaInicio, estado (PROGRAMADO|EN_VIVO|FINALIZADO|CANCELADO), golesLocal/Visita, flags btts/mas25Goles/huboTarjetaRoja, round, venue.
- **EventoPartido** — tipo (GOL|TARJETA_AMARILLA|TARJETA_ROJA|FIN_PARTIDO|SUSTITUCION), minuto, equipo, jugador. Unique natural key `(partidoId, tipo, minuto, equipo, COALESCE(jugador,''))` para upsert idempotente del poller.
- **Torneo** — tipo (EXPRESS|ESTANDAR|PREMIUM|GRAN_TORNEO), entradaLukas, partidoId, estado (ABIERTO|CERRADO|EN_JUEGO|FINALIZADO|CANCELADO), totalInscritos, pozoBruto, pozoNeto, rake, cierreAt, distribPremios (Json).
- **Ticket** — 5 predicciones (predResultado, predBtts, predMas25, predTarjetaRoja, predMarcadorLocal, predMarcadorVisita), puntos desglosados, posicionFinal, premioLukas. Unique compuesto de las 5 preds + usuarioId + torneoId.
- **TransaccionLukas** — tipo (COMPRA|ENTRADA_TORNEO|PREMIO_TORNEO|CANJE|BONUS|VENCIMIENTO|REEMBOLSO), monto (±), refId, venceEn (solo COMPRA). **Lote 6A:** `bolsa BolsaLukas?` (COMPRADAS|BONUS|GANADAS), `saldoVivo Int?` (solo COMPRA, para FIFO), `metadata Json?` (composición de descuento en ENTRADA_TORNEO), `vencAvisado30d/7d Boolean`.
- **Premio** — categoria (ENTRADA|CAMISETA|GIFT|TECH|EXPERIENCIA), badge (POPULAR|NUEVO|LIMITADO), featured, requiereDireccion, costeLukas, stock, valorSoles (audit interno).
- **Canje** — estado (PENDIENTE|PROCESANDO|ENVIADO|ENTREGADO|CANCELADO), direccion (Json).
- **PreferenciasNotif** — 8 toggles (7 previos + `notifVencimientos` default true, Lote 6A). Lazy create con defaults.
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
- Bonus de bienvenida: **15 Lukas** (BONUS, sin vencimiento). Plan v6 — antes 500.
- Vencimiento Lukas comprados: **36 meses** desde la compra. Plan v6 — antes 12.
- Packs de compra: 20 (+0), 50 (+5), 100 (+15), 250 (+50).

#### Reglas de descuento entre bolsas (Lote 6A)
- Orden de descuento: **Bonus → FIFO Compradas → Ganadas** (ver `descontarEntrada` en `torneos.service.ts`).
- FIFO en Compradas: se consumen por `creadoEn` asc, decrementando `saldoVivo` hasta agotar el monto. No rompe en mitad de un lote.
- Reembolsos restauran a la bolsa de origen. La composición de la entrada se guarda en `metadata.composicion` de la `TransaccionLukas ENTRADA_TORNEO`. Si el lote de compra original ya expiró, se crea una nueva COMPRA con TTL 36m.
- Canjes solo permiten gastar bolsa **Ganadas**. Usar `getBalanceCanjeable(u)` de `lib/lukas-display.ts`.
- Lecturas de balance: **siempre** vía `lib/lukas-display.ts`. Mutaciones directas solo en los 6 services autorizados (torneos, canjes, ranking, compras, vencimiento, wallet-view).

### Torneos y Tickets
- **Entrada uniforme: 3 Lukas** para todos los torneos (Plan v6). El tipo es solo metadato visual.
- Cierre inscripciones: **al kickoff** del partido (Plan v6 — antes T-5min). Automático e irreversible. El cron solo cierra torneos con `estado === 'ABIERTO'`; si ya están EN_VIVO/CERRADO/FINALIZADO/CANCELADO, no se tocan.
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
- **Distribución (Plan v6):** cada premio = `floor(porcentaje × pozoNeto)`. Residual al **1°** para preservar `sum(premios) === pozoNeto`.
- **Empates (Plan v6):** split equitativo **acotado al último puesto pagado M**. Si el grupo se extiende más allá de M, la suma se acota a `posStart..M` antes de dividirla entre todos los miembros.

### Juego responsable
- Edad mínima 18. Verificación al registro.
- Límite mensual de compra: **default S/ 300/mes, configurable hasta S/ 1.000** (Plan v6). Bloqueante. Constantes `LIMITE_MENSUAL_DEFAULT` y `LIMITE_MENSUAL_MAX` en `lib/config/economia.ts`.
- Límite diario de tickets: default 10/día. Bloqueante.
- Auto-exclusión: solo **7, 30 o 90 días** (constante `AUTOEXCLUSION_DIAS_VALIDOS`).
- Mostrar siempre rake y distribución del pozo antes de inscribir.

### Eliminación de cuenta
- Derecho ARCO de Cancelación según Ley 29733. Mini-lote 7.6: el flujo principal es in-app inmediato, con confirmación typing literal `"ELIMINAR"` en un input. Endpoint: `POST /api/v1/usuarios/me/eliminar/inmediato`. Sirve a la UI desde `/perfil` zona peligro.
- El service `eliminarCuentaInmediato` decide automáticamente:
  - **Hard delete** si NO hay actividad histórica (tickets ni canjes). Borra el `Usuario`; el cascade del schema se encarga de Account, Session, PreferenciasNotif, LimitesJuego, VerificacionTelefono, VerificacionDni, SolicitudEliminacion. Email + identidad OAuth quedan libres para re-registro limpio.
  - **Soft delete (anonimización)** si tiene tickets o canjes. Anonimiza PII (`nombre`/`email`/`username`/`telefono`/`ubicacion`/`image`), marca `deletedAt`, **borra explícito `Account` + `Session`** (libera el OAuth para re-registro) + dependencias cascade en una transacción atómica. Preserva tickets/transacciones/canjes para audit + integridad de torneos.
- En ambos modos se manda email de confirmación al email original ANTES de la mutación (fire-and-forget), template `cuentaEliminadaTemplate` + wrapper `notifyCuentaEliminada`.
- El flujo legacy email-token (`POST /me/eliminar` + `POST /me/eliminar/confirmar`) sigue existiendo en el backend pero la UI ya no lo invoca. Queda como fallback admin si se necesita.

### Navegación
- Navegación libre sin login (torneos, ranking, tienda).
- Login solo al intentar: inscribirse, canjear, ver wallet/perfil.
- Tras login continúa al destino (`pendingTorneoId`, `callbackUrl`).
- Middleware bloquea el grupo `(main)` si `session.user.usernameLocked === false` → redirect a `/auth/completar-perfil?callbackUrl=<ruta>` (OAuth primera vez sin @handle definitivo).

### Seguridad
- Rate limiting en middleware edge (Lote 1) con tiers: `/api/auth/*` 30/min·IP (Mini-lote 7.6 — antes 10), tickets + inscribir 30/min·usuario, resto `/api/*` 60/min·IP. Excluidos: `/api/health`, `/api/debug/*`, webhooks **y `/api/auth/signout`** (el logout debe poder ejecutarse siempre). Detalle en §16.
- Headers de seguridad globales (HSTS, XFO, XCTO, Referrer-Policy, Permissions-Policy, CSP en Report-Only). Detalle en §16.
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
- **Sprint 1 — Auth:** NextAuth v5 magic link (Resend `hablaplay.com`), custom Prisma adapter, middleware protegido (`/wallet`, `/perfil`, `/admin`), bonus de bienvenida al registro (monto vigente en `lib/config/economia.ts`). Ver registro formal (Abr 2026) para el flujo actual con Google OAuth + username obligatorio.
- **Fase 2 — UI desde mockup:** primitivos (`Button`, `Chip`, `Alert`, `Toast`, `Modal`), NavBar/BottomNav/UserMenu, MatchCard con 4 tiers de urgencia. Cero hex hardcodeados fuera de `tailwind.config.ts` + `globals.css`.
- **Sub-Sprint 3 + 3.5 — Torneos + Auto-import:** CRUD de torneos, inscripción atómica, cancelación por <2 inscritos. Cron in-process en `instrumentation.ts`. Auto-import de temporadas (`seasons.cache.ts`) y partidos cada 6h para ligas whitelisteadas en `lib/config/ligas.ts` (Liga 1 Perú EXPRESS, Champions ESTANDAR, Libertadores ESTANDAR, Premier EXPRESS, La Liga EXPRESS, Mundial 2026 PREMIUM). Cada partido nuevo crea su torneo automáticamente.
- **Fase 3 — UX de /matches:** filtros en URL (`?liga=&dia=`), scroll horizontal de días con `useScrollIndicators`, MatchCard compacta 150px, colores hash por equipo (`team-colors.ts`), zona horaria `America/Lima`.
- **Sub-Sprint 4 — Combinadas:** `ComboModal` centrado, 5 PredCards + ScorePicker, placeholder-ticket que se actualiza al primer envío sin re-cobrar, `/mis-combinadas` con 3 tabs (Activas/Ganadas/Historial), stats pills, chips resueltos por `tickets/adapter.ts`.
- **Sub-Sprint 5 — Motor + Ranking en vivo:** custom Next server con Socket.io (`apps/web/server.ts`), handshake JWT HS256 5 min via `GET /api/v1/realtime/token`, rooms `torneo:{id}`, eventos `ranking:update`/`partido:evento`/`torneo:cerrado`/`torneo:finalizado`. Motor puro `puntuacion.service.ts`. Poller cada 30s con backoff 429. Redis sorted sets (opcional). `/live-match` con hero + switcher + tabs Ranking/Stats/Events + `LiveFinalizedSection` + filter chips por liga. Hook `useMinutoEnVivo` consume `{ statusShort, minuto, extra, elapsedAgeMs }` y delega en `getMinutoLabel` puro — avanza el reloj localmente en 1H/2H/ET, congela en HT/BT/NS/FT/etc. El snapshot del minuto se persiste en `Partido.liveStatusShort/liveElapsed/liveExtra/liveUpdatedAt` (L2 BD) con un Map in-memory como L1 — sobrevive restarts y cubre multi-réplica.
- **Sub-Sprint 6 — Tienda + Canjes + Emails:** catálogo de 25 premios en `packages/db/src/catalog.ts` (5 categorías, 3 badges, 1 featured). Endpoint admin idempotente `POST /api/v1/admin/seed/premios`. Máquina de estados de canjes (`TRANSICIONES: Record<EstadoCanje, EstadoCanje[]>`). 8 templates de email transaccional en `lib/emails/templates.ts`, wrappers `notifyXxx` en `notificaciones.service.ts`. **Crédito automático de Lukas** al `finalizarTorneo` + auto-reconciliación de torneos FINALIZADOS con crédito incompleto + endpoint admin `POST /api/v1/admin/torneos/:id/reconciliar`.
- **Sub-Sprint 7 — Perfil + Juego responsable:** `/perfil` completo (verificación teléfono/DNI, 7 toggles de notif, límites de compra/tickets, auto-exclusión, eliminar cuenta soft-delete, exportar datos). Niveles 🥉/🥈/🥇/👑 por torneos jugados (`lib/utils/nivel.ts`). Rediseño motivacional de `/torneo/:id` con lista de inscritos, pozo sin tecnicismos, CTA estelar adaptativo.
- **Rediseño mockup v1 (Abr 2026):** re-alineamiento visual 1:1 de `/wallet`, `/tienda`, `/mis-combinadas`, tabs de `/live-match` y `/perfil` al mockup. Tokens `medal.silver/bronze` actualizados al mockup (`#C0C0C0`, `#CD7F32`). Nuevo service `wallet-view.service.ts` (SSR: totales por tipo + próximo vencimiento + historial). Componentes nuevos: `WalletView`/`TxList`/`MovesFilter`/`BuyPacksPlaceholder` en wallet, `HistoryList` (tab historial expandible) en tickets, `SectionShell` + `ProfileFooterSections` en perfil (absorbe `DatosYPrivacidadPanel`). Delta de posición ↑↓= en `RankingTable` vía `useRef` local. Backend, stores, WS y endpoints intactos.
- **Registro formal + rediseño `/perfil` (Abr 2026):** dos rutas separadas `/auth/signin` y `/auth/signup` + `/auth/completar-perfil` para OAuth nuevo. Google provider sumado a NextAuth v5. `username` pasa a NOT NULL + unique, con flag `usernameLocked` (true tras elegir @handle) y `tycAceptadosAt` para audit de T&C. Middleware bloquea `(main)` si `usernameLocked=false` → forza a `/auth/completar-perfil`. Endpoints nuevos: `GET /auth/username-disponible`, `POST /auth/signup`, `POST /auth/completar-perfil`. `/perfil` fue reescrito desde cero (nuevos componentes `VerificacionSection`/`DatosSection`/`NotificacionesSection`/`JuegoResponsableSection`/`FooterSections`); servicios, endpoints y modelos preservados. `@username` reemplaza a `nombre` en NavBar/UserMenu/RankingTable/InscritosList. `PATCH /usuarios/me` ya NO acepta username (inmutable post-registro). Migración destructiva — reset de BD acordado.
- **Lote 1 — Observabilidad y seguridad base (Abr 2026):** dominio propio `hablaplay.com` + `www.hablaplay.com` vía Cloudflare (SSL Full Strict, proxied, WebSockets OK). `/api/health` con checks paralelos de Postgres + Redis (timeout 3s) para Uptime Robot. `@sentry/nextjs` integrado en browser/server/edge leyendo `SENTRY_DSN`; endpoint `/api/debug/sentry-test` con guard por header secret. Headers de seguridad globales en `next.config.js` (HSTS preload, XFO DENY, nosniff, Referrer-Policy, Permissions-Policy, CSP en Report-Only con whitelist de PostHog/Sentry/Google/Culqi/api-football/Resend). Rate limiting in-memory en middleware edge con 3 tiers (auth 10/min·IP, críticos 30/min·usuario, resto 60/min·IP). `public/.well-known/security.txt` para disclosure. Detalles operacionales en §16, env vars en §17.
- **Lote 2 — Analytics y SEO (Abr 2026):** PostHog integrado vía `lib/analytics.ts` (helper único) + `PostHogProvider` client con pageview manual, `identify()` en login, `reset()` en logout, opt-out en `/legal/*`. 13 eventos canónicos cableados (detalle en §18). SEO completo: `sitemap.ts` dinámico, `robots.ts`, metadata con OG + Twitter + `metadataBase`, `opengraph-image.tsx` edge-generado, `icon.tsx` + `apple-icon.tsx` placeholders, `manifest.ts` PWA con colores brand correctos (reemplaza `public/manifest.json` legacy). JSON-LD `SportsEvent` en `/torneo/[id]`. Detalle en §18 + §19, funnels en `docs/analytics-funnels.md`.
- **Ajustes UX sidebar + wallet + perfil (Abr 2026):** Sidebar de `/matches` y `/` reordenado — widget #2 es **"Los Pozos más grandes de la semana"** (torneos de la semana calendario ordenados por `pozoBruto` DESC, TOP 5) y widget #5 es **"Los más pagados de la semana"** (suma de `TransaccionLukas.monto` con tipo `PREMIO_TORNEO` por usuario en la semana, TOP 10); ventana lunes→domingo via `datetime.ts:getWeekBounds`. Balance widget rediseñado (tipografía 52px + border gold + CTA único a `/wallet`). En `/torneo/:id` el CTA desktop vive en la sidebar derecha sobre `RulesCard`. Modal post-envío de combinada invierte énfasis: primario = "Crear otra combinada" (reset), secundario = "Ver mis combinadas" (link). `/wallet` — filtro "Inscripciones" ahora enriquece cada transacción con `partido` (vía `refId → Torneo → Partido`) y muestra el resumen `Local 2-1 Visita` en la lista. Usernames case-sensitive para display, unicidad case-insensitive en BD (regex `^[a-zA-Z0-9_]+$`); filtro `lib/utils/username-filter.ts:esUsernameOfensivo` bloquea slurs + leet-speak básico en los 3 endpoints de auth. `VerificacionSection` actualiza copy DNI a "Requerido para canjear cualquier premio.". `DatosSection` muestra "Por completar" cuando `nombre` está vacío o coincide con el `username`; adapter OAuth ya no copia email/username al nombre. Minuto en vivo simplificado: `getMinutoLabel({ statusShort, minuto, extra })` + propagación de `status.extra` (injury time "45+3'") desde api-football al cache, WS y endpoints REST.
- **Lote 4 — Hotfixes económicos del Plan v6 (Abr 2026):** centralización de constantes económicas en [`lib/config/economia.ts`](apps/web/lib/config/economia.ts) (`BONUS_BIENVENIDA_LUKAS=15`, `MESES_VENCIMIENTO_COMPRA=36`, `ENTRADA_LUKAS=3`, `LIMITE_MENSUAL_DEFAULT=300`, `LIMITE_MENSUAL_MAX=1000`, `LIMITE_DIARIO_TICKETS_DEFAULT=10`). Cambios: bonus bienvenida 500→15, vencimiento Lukas comprados 12→36 meses, cierre de torneos T-5min→al kickoff (`CIERRE_MIN_BEFORE=0` en `torneos.service.ts`), entrada uniforme **3 Lukas** para todos los torneos (el panel admin perdió el input numérico, se muestra como badge readonly). Tipos `EXPRESS/ESTANDAR/PREMIUM/GRAN_TORNEO` quedan como **etiqueta visual** (no afectan reglas). `LigaConfig` perdió el campo `entradaLukas`. La distribución FLOOR + residual al 1° y los empates con split equitativo acotado a M ya estaban implementados en `lib/utils/premios-distribucion.ts`; sólo se ampliaron los comentarios para que coincidan con el wording del Plan v6. Límite mensual cap subido de 10000 a 1000 (en realidad reducido — antes el Zod aceptaba hasta 10000, ahora 1000). Endpoint temporal `/api/debug/sentry-test` (Lote 1) eliminado. Migración de datos: NINGUNA — los torneos existentes con entrada 5/10/30/100 conservan su valor; las TransaccionLukas con `venceEn` calculado a 12m se mantienen. Solo aplica a creaciones futuras.
- **Mini-lote 7.6 — Modal post-combinada + logout + eliminación in-app (Abr 2026):** (a) `POST /api/v1/tickets` ahora devuelve `data.torneo` con `{ id, totalInscritos, pozoBruto, pozoNeto, entradaLukas, cierreAt }` leído dentro de la misma `$transaction`; el `ComboModal` lo guarda en un state local que sobreescribe los valores derivados del prop original al pintar el header de éxito (Bug A — datos del pozo/jugadores quedaban congelados pre-mutación). Helper compartido `derivePozosDisplay()` en [`combo-info.mapper.ts`](apps/web/components/combo/combo-info.mapper.ts) extraído para reusar la fórmula de primer-premio entre el load inicial y el repintado. (b) Tier AUTH del rate limit subido de 10→30/min/IP y `/api/auth/signout` **completamente exento** del rate limit (Bug B — signout silenciosamente 429 dejaba la cookie sin borrar). Handlers de `signOut` en [UserMenu](apps/web/components/layout/UserMenu.tsx) + [FooterSections](apps/web/components/perfil/FooterSections.tsx) refactor a `signOut({ redirect: false }) + window.location.href = "/"` para garantizar hard reload con la cookie ya rotada. (c) Feature C — eliminación de cuenta in-app: nuevo endpoint `POST /api/v1/usuarios/me/eliminar/inmediato` con confirmación typing literal `"ELIMINAR"`. El service `eliminarCuentaInmediato` decide hard vs soft según actividad (`ticketsCount + canjesCount`). Hard: `tx.usuario.delete()` con cascade del schema. Soft: anonimización idéntica a la del flujo email-token + **borrado explícito de `Account` y `Session`** (libera identidad OAuth para re-registro) + cleanup de `VerificacionTelefono`/`VerificacionDni`/`PreferenciasNotif`/`LimitesJuego`/`SolicitudEliminacion`/`VerificationToken`. En ambos casos email de confirmación post-mutación al email original (`cuentaEliminadaTemplate` + `notifyCuentaEliminada`). El flujo legacy email-token (`/me/eliminar` + `/me/eliminar/confirmar`) sigue existiendo en el backend pero la UI ya no lo invoca. Modal nuevo en [FooterSections.tsx](apps/web/components/perfil/FooterSections.tsx) con input "ELIMINAR" + botón rojo + auto-signout post-éxito. Sin schema migration: `deletedAt IS NOT NULL` ya cumplía la función de "cuenta eliminada".
- **Lote 6A — 3 bolsas de Lukas + vencimiento automático (Abr 2026):** Refactor backend completo sin cambio visible en UI. Schema: nuevo enum `BolsaLukas (COMPRADAS|BONUS|GANADAS)`, campos `balanceCompradas/Bonus/Ganadas` en `Usuario`, campos `bolsa/saldoVivo/metadata/vencAvisado30d/7d` en `TransaccionLukas`, campo `notifVencimientos` en `PreferenciasNotif`. Helper central `lib/lukas-display.ts` (lectura) — 4 funciones: `getBalanceTotal/Canjeable/DisponibleParaJugar/Desglosado`. Services refactorizados: `torneos.service` (descuento FIFO Bonus→Compradas→Ganadas + restauración por composicion), `canjes.service` (solo Ganadas), `ranking.service` (premios a Ganadas), `wallet-view.service` (desglose + proxVencimiento via saldoVivo), `compras.service` (nuevo, preview Culqi). Cron Job F en `instrumentation.ts`: `vencimientoLukasJob` tick cada 1h (skip si corrió <23h), vence compras expiradas, envía avisos 30d/7d con `notifyLukasVencidos/PorVencer`. 3 templates de email nuevos. Backfill post-deploy: `lib/services/backfill-bolsas.service.ts` + endpoint `POST /api/v1/admin/backfill/bolsas`. Endpoint cron manual: `POST /api/cron/vencimiento-lukas`. Migration SQL escrita manualmente (no aplicada localmente). `prisma generate` corrido para actualizar tipos. `obtenerBalance` en `lib/usuarios.ts` suma las 3 bolsas (sesión NextAuth compat). 6 test files AST. `pnpm tsc --noEmit` y `pnpm lint` sin errores.
- **Lote 6B — UX de 3 bolsas (Abr 2026):** UI-only, sin schema migrations. `/wallet`: nuevo `WalletBalanceDesglose` (3 tarjetas dark-card — Comprados/Bonus/Ganados — con border-l coloreado, tooltips nativos, subtexto de vencimiento); `Alert` extendida con variantes `warning` y `error` para banner de próximo vencimiento (≤60d → warning, ≤7d → error); chip de bolsa (Comprados/Bonus/Ganados) en cada fila de `TxList`; `WalletView` reemplaza `WalletBalanceHero` por `WalletBalanceDesglose`. `/tienda`: stat "Canjeables" (🏆, verde) usa solo `balanceGanadas` en lugar del total; `FeaturedPrize` y `PrizeCardV2` reciben `balanceGanadas` + `onCanjeado` para affordability y descuento optimista; `CanjearModal` detecta `json.error.code === "BALANCE_INSUFICIENTE"` y delega a `onBalanceInsuficiente`; nuevo `ModalSinGanadas` explica el déficit y CTA a `/matches`; `TiendaContent` gestiona `ganadas` como `useState` local (SSR initial + decremento optimista). 3 eventos PostHog: `wallet_desglose_viewed`, `tienda_canje_bloqueado_sin_ganadas`, `tienda_sin_ganadas_cta_partidos_clicked`. 3 test files AST. `pnpm tsc --noEmit` y `pnpm lint` sin errores.
- **Lote 6B-fix2 — Hotfix balance sistémico + wallet redesign (26 Abr 2026):** Bug: `backfill-bolsas.service.ts` actualizaba las 3 bolsas individuales pero omitía `balanceLukas` en la misma operación, dejando el total desincrónizado. Corregido: se agrega `balanceLukas: compradas + bonus + ganadas` al `prisma.usuario.update`. `TipoTransaccion` ampliado con `AJUSTE` (migración SQL manual `20260426000000`). Endpoints de auditoría: `GET /api/v1/admin/auditoria/balance` (compara almacenado vs suma bolsas para todos los usuarios activos) + `POST .../corregir` (sincroniza divergentes en `$transaction` con registro `AJUSTE`). Ambos guard por `CRON_SECRET`. Ancho homogenizado a `max-w-[960px]` en `/wallet`, `/tienda`, `/live-match`. Wallet redesign: `WalletBalanceDesglose` eliminado; restaurado `WalletBalanceHero` (hero grande gold + shimmer + badge vencimiento); nota explicativa entre hero y stats; `WalletStats` rediseñado con 3 cards: Ganadas en premios (`balanceGanadas`, verde), Lukas compradas (`balanceCompradas+Bonus`, gold), Gastadas en combinadas (`totales.inscripciones`, purple); grid 1→2+1→3 según breakpoint. Chips de bolsa removidos de `TxList`. `WalletBalanceHero` trackea `wallet_desglose_viewed` desde `WalletView`.

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
| `/auth/signup` | Crear cuenta nueva. Google OAuth (botón) + form email + username (`@handle` único, 3-20 chars) + checkbox T&C / mayor de 18. Cierra creando usuario + bonus de bienvenida (`BONUS_BIENVENIDA_LUKAS`) y dispara magic link via `signIn("resend")`. |
| `/auth/completar-perfil` | Post-OAuth Google primera vez. Usuario elige su @handle definitivo (inmutable después) + acepta T&C. Middleware redirige aquí hasta `usernameLocked=true`. |
| `/` y `/matches` | Filter chips (liga + día scroll horizontal) + match cards por urgencia + sidebar sticky. Sidebar (top→bottom): **1)** En vivo ahora · **2)** Los Pozos más grandes de la semana · **3)** Tu balance · **4)** Cómo se pagan los premios · **5)** Los más pagados de la semana. Título derivado de filtros via `buildMatchesPageTitle`. |
| `/live-match` | Filter chips por liga + LiveSwitcher (solo EN_VIVO) + LiveHero (dark, score dorado, 4 stats, timeline) + mi ticket destacado + tabs Ranking/Stats/Events + LiveFinalizedSection abajo (últimas 24h). |
| `/torneo/:id` | Hero motivacional: "Pozo" único (sin "bruto/neto/rake" en copy visible), stats pills, lista de inscritos con nivel + @handle (predicciones ocultas hasta el cierre), CTA estelar adaptativo por estado + back button. |
| `/mis-combinadas` | 5 stats pills (Jugadas, Ganadas, Acierto%, Balance, Mejor puesto) + tabs Activas/Ganadas/Historial + match groups con tickets. |
| `/tienda` | Stat "Canjeables" (solo `balanceGanadas`, 🏆 verde) + stat "Disp. ahora" + stat "Ya canjeados" + featured prize + category chips + prize grid v2 con progress bars si no afordable. `ModalSinGanadas` si API retorna `BALANCE_INSUFICIENTE`. |
| `/wallet` | Desglose de 3 bolsas (`WalletBalanceDesglose`): Comprados (azul), Bonus (dorado), Ganados (verde) — tarjetas dark-card con border-l coloreado, subtexto vencimiento, banner `Alert` warning/error si vence pronto. Chip de bolsa en cada tx del historial. 4 pack cards + legal note + filter chips + tx-list. |
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

### Bolsas de Lukas — lectura y mutación (Lote 6A)
- **Lectura:** todo código que necesite el balance total, canjeable o desglosado usa `lib/lukas-display.ts` (`getBalanceTotal`, `getBalanceCanjeable`, `getBalanceDesglosado`). Prohibido leer `balanceCompradas/Bonus/Ganadas` directo fuera de los services autorizados.
- **Mutación directa autorizada** solo en: `torneos.service` (descuento inscripción + reembolso), `canjes.service` (descuento canje + reembolso), `ranking.service` (premio torneo), `compras.service` (acreditación Culqi), `vencimiento-lukas.job` (vencimiento + avisos), `wallet-view.service` (lectura desglose para UI). Los demás módulos usan `getBalanceTotal()` de `lukas-display.ts`.
- **`balanceLukas` sigue siendo la suma de las 3 bolsas** (compat con sesión NextAuth y store Zustand). Toda mutación actualiza las 3 bolsas afectadas Y `balanceLukas` en la misma `$transaction`.
- **`notifVencimientos`** toggle en `PreferenciasNotif` (default true). Los wrappers `notifyLukasVencidos` y `notifyLukasPorVencer` lo respetan.

### Modales
- Modales DEBEN renderizar con `createPortal(overlay, document.body)` (`components/ui/Modal.tsx`). Sin esto, cualquier ancestor con `transform`/`filter`/`opacity` rompe el `position: fixed`.

### Emails y notificaciones
- SIEMPRE pasar por wrappers `notifyXxx` de `lib/services/notificaciones.service.ts` (10: `notifyPremioGanado`, `notifyCanjeSolicitado`, `notifyCanjeEnviado`, `notifyCanjeEntregado`, `notifyTorneoCancelado`, `notifyVerifCodigoEmail`, `notifySolicitudEliminar`, `notifyDatosDescargados`, `notifyLukasVencidos`, `notifyLukasPorVencer`). Prohibido llamar `enviarEmail` directo.
- Cada wrapper: (1) chequea `debeNotificar(usuarioId, tipo)`, (2) skippea si `deletedAt` o sin email, (3) renderiza template puro, (4) dispara `enviarEmail`. try/catch con `logger.error` — email fallido NO rompe flujo.
- `PreferenciasNotif` lazy-create con defaults. 5 toggles `true` por default (incluye `notifVencimientos`, Lote 6A); `notifPromos` y `emailSemanal` son opt-in.
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

1. Entrar a `hablaplay.com`
2. Ver torneos disponibles sin cuenta
3. Crear cuenta por Google o magic link + elegir @handle → recibir 15 Lukas de bienvenida
4. Comprar 100 Lukas con tarjeta sandbox (→ 115 con bonus) ⏳ pendiente SS2
5. Inscribirse en torneo de Liga 1 (3 Lukas)
6. Armar combinada de 5 predicciones
7. Ver puntos actualizándose en vivo durante el partido
8. Recibir Lukas de premio automáticamente si quedó en top
9. Recibir email del premio
10. Canjear Lukas por entrada en `/tienda`
11. Configurar notificaciones y límites en `/perfil`
12. Cerrar sesión y volver al día siguiente

Si estas 12 acciones funcionan end-to-end, **el MVP está listo para el Mundial**.

---

## 16. INFRAESTRUCTURA DE PRODUCCIÓN

Baseline operacional activo tras Lote 1 (Abr 2026).

| Servicio | Propósito | Config |
|---|---|---|
| Cloudflare (DNS + proxy) | SSL Full Strict, WAF, WebSockets sobre `hablaplay.com` y `www.hablaplay.com` | Proxied, DNS auto vía integración Railway |
| Sentry | Error tracking browser / server / edge | `SENTRY_DSN` en env, proyecto `habla-web-prod`, 3 alertas base |
| Uptime Robot | Uptime monitoring cada 5 min | 3 monitores: `/`, `/api/health`, `/auth/signin` |
| PostHog | Analytics (integración pendiente Lote 2) | Keys en env, no cableado aún |
| Cloudflare Email Routing | Email entrante `@hablaplay.com` | `soporte@`, `hola@`, `legal@`, catch-all → `hablaplay@gmail.com` |
| Railway Backups nativos | DB recovery | 3 schedules: Daily / Weekly / Monthly |
| R2 `habla-db-backups` (Lote 7) | Backup externo automatizado | `pg_dump` + gzip 1x/día desde el cron in-process; ventana objetivo 03:00 UTC. Retención: 30 daily + 1/mes indefinido. Restauración en [docs/runbook-restore.md](docs/runbook-restore.md). |
| Google Search Console | SEO + ownership | `hablaplay.com` verificado via Cloudflare |

### Endpoints de infra
- `GET /api/health` — para Uptime Robot. Chequea Postgres (`SELECT 1`) y Redis (`PING`) en paralelo con timeout 3s. Adicionalmente reporta el check `backup` (ok/stale/missing/unconfigured) leyendo state in-memory del job (no llama a R2). Respuesta `200 {"status":"ok"}` o `503 {"status":"error",...}` identificando el check caído. **Backup stale (>26h) NO degrada el status** — se loggea warning y Sentry alerta aparte. `Cache-Control: no-store`. Excluido del rate limit.
- `POST /api/cron/backup-db` — dispara backup ad-hoc. Auth `Authorization: Bearer <CRON_SECRET>`. `GET` con misma auth devuelve estado + listado de últimos 10 backups en R2.
- `POST /api/cron/vencimiento-lukas` — dispara job de vencimiento de Lukas ad-hoc (Lote 6A). Auth `Authorization: Bearer <CRON_SECRET>`. En producción corre automáticamente cada 1h en `instrumentation.ts` (Job F); este endpoint es para pruebas/debug.
- `POST /api/v1/admin/backfill/bolsas` — dispara backfill de las 3 bolsas post-deploy (Lote 6A). Auth `Authorization: Bearer <CRON_SECRET>`. Idempotente: si ya corrió (todas las txs tienen bolsa), retorna inmediatamente.

### Headers de seguridad
Aplicados globalmente vía `next.config.js` → `headers()`:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: niega `camera`, `microphone`, `geolocation`, `interest-cohort`
- `Content-Security-Policy-Report-Only` con whitelist: PostHog, Sentry, Google OAuth, Culqi, api-football, Resend, WSS propios. Migrar a enforcing en lote futuro tras validar reportes.
- `public/.well-known/security.txt` → `legal@hablaplay.com` para vulnerabilidades.

Objetivo: A+ en securityheaders.com.

### Rate limiting
Middleware edge (`apps/web/middleware.ts` + `lib/rate-limit.ts`) con sliding-window in-memory. Ventana 1 min:
- `/api/auth/*`: 30 req/min por IP (Mini-lote 7.6 — antes 10; `useSession()` golpea `/api/auth/session` en cada mount + window-focus, 10 era insuficiente para navegación normal y disparaba 429 silencioso al hacer signOut)
- `/api/v1/tickets/*` y `/api/v1/torneos/*/inscribir`: 30 req/min por usuario
- Resto `/api/*`: 60 req/min por IP
- Excluidos: `/api/health`, `/api/v1/webhooks/*` (HMAC en su handler), **`/api/auth/signout`** (logout siempre debe poder ejecutarse, sin rate limit — Mini-lote 7.6)

Respuesta 429 con `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`. Violaciones se reportan a Sentry como `warning`. CAVEAT: store in-memory → correcto solo con 1 réplica (realidad hoy). Al escalar, migrar a Redis (ioredis con INCR+EXPIRE o Upstash via HTTP).

---

## 17. ENV VARS DE PRODUCCIÓN

Ya pobladas en Railway (valores en el service vault — no acá):

```
NEXTAUTH_URL=https://hablaplay.com
NEXT_PUBLIC_APP_URL=https://hablaplay.com
SENTRY_DSN=<configured>
NEXT_PUBLIC_POSTHOG_KEY=<configured>
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Lote 4 (Abr 2026): el endpoint temporal `/api/debug/sentry-test` (Lote 1) y su env var `SENTRY_DEBUG_TOKEN` se eliminaron. La var puede borrarse de Railway sin impacto.

Lote 7 (Abr 2026) — credenciales R2 para backups automatizados (vault 1Password "Habla! Infra"):
```
R2_ACCESS_KEY_ID=<configured>
R2_SECRET_ACCESS_KEY=<configured>
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET=habla-db-backups
```
Si falta cualquiera de las 4, el job se autodeshabilita (`/api/health` reporta `checks.backup: "unconfigured"`). `CRON_SECRET` ya existía para `/api/cron/cerrar-torneos`; se reutiliza para `/api/cron/backup-db`.

Nuevas en Lote 3 — datos legales (se completarán cuando llegue el RUC y la partida SUNARP). Mientras estén ausentes, los placeholders `{{LEGAL_*}}` aparecen literales en los documentos públicos:
```
LEGAL_RAZON_SOCIAL=<not configured yet>
LEGAL_RUC=<not configured yet>
LEGAL_PARTIDA_REGISTRAL=<not configured yet>
LEGAL_DOMICILIO_FISCAL=<not configured yet>
LEGAL_DISTRITO=<not configured yet>
LEGAL_TITULAR_NOMBRE=<not configured yet>
LEGAL_TITULAR_DNI=<not configured yet>
```

El listado completo de vars (incluidas las de dev) vive en `.env.example`.

---

## 18. ANALYTICS

PostHog Cloud (proyecto `habla-production`). Init solo en producción con `NEXT_PUBLIC_POSTHOG_KEY` presente — dev/preview no disparan eventos.

### Regla de integración
**Todo pasa por `apps/web/lib/analytics.ts`.** Ningún componente importa `posthog-js` directo. Helper expone `track(event, props)`, `identify(userId, traits)`, `reset()`, `capturePageview(path)`. Así cambiar de sink (Mixpanel, GA4, Meta Pixel) es un solo archivo.

### Eventos canónicos

| Evento | Dónde | Props |
|---|---|---|
| `signup_started` | Mount `/auth/signup` | `source` |
| `signup_completed` | POST signup ok (email) o mount completar-perfil (google) | `method` (email\|google) |
| `email_verified` | Magic link vuelta (email) o mount completar-perfil (google) | — |
| `profile_completed` | POST completar-perfil ok (google) o junto a signup (email) | — |
| `lukas_purchase_started` | Click pack en `/wallet` | `pack_id`, `amount` |
| `lukas_purchase_completed` | ⏳ SS2 Culqi | `pack_id`, `amount_lukas`, `amount_soles` |
| `lukas_purchase_failed` | ⏳ SS2 Culqi | `pack_id`, `reason` |
| `torneo_viewed` | Mount `/torneo/:id` | `torneo_id`, `partido`, `pozo_actual`, `inscritos` |
| `torneo_inscripto` | POST inscribir ok / ComboModal sin placeholder | `torneo_id`, `ticket_id`, `costo_lukas`, `es_primer_ticket_usuario` |
| `ticket_submitted` | POST `/tickets` ok | `torneo_id`, `ticket_id`, `predicciones_completadas` |
| `premio_ganado` | Mount `/mis-combinadas` tab ganadas (dedup localStorage) | `torneo_id`, `posicion`, `lukas_ganados` |
| `canje_solicitado` | POST canjear ok | `premio_id`, `costo_lukas` |
| `tienda_viewed` | Mount `/tienda` | — |
| `wallet_desglose_viewed` | Mount `WalletBalanceDesglose` en `/wallet` | `compradas`, `bonus`, `ganadas`, `total` |
| `tienda_canje_bloqueado_sin_ganadas` | `ModalSinGanadas` se abre (BALANCE_INSUFICIENTE) | `ganadas_actuales`, `coste_premio`, `deficit` |
| `tienda_sin_ganadas_cta_partidos_clicked` | Click "Ver partidos" en `ModalSinGanadas` | — |

### Política
- `person_profiles: "identified_only"` — no perfilamos anónimos.
- Rutas `/legal/*` — no capturamos nada (opt-out en el helper).
- `identify()` en callback de session authenticated; `reset()` en logout.
- Pageview manual vía `PostHogProvider` (App Router no dispara `$pageview` automático).
- **Consent (Lote 3):** PostHog respeta el consentimiento de cookies. Init solo si el usuario aceptó analytics en el banner; si revoca, llamamos `opt_out_capturing()`. Lógica en `components/CookieBanner.tsx` + `lib/cookie-consent.ts`. Storage key: `habla_cookie_consent_v1`. El banner se muestra una sola vez por dispositivo hasta que el usuario decide.

### Funnels + cohortes
Referencia en `docs/analytics-funnels.md`. Configuración práctica (armar funnels, cohortes) se hace en el dashboard PostHog aparte.

---

## 19. SEO

### Artefactos
- `apps/web/app/sitemap.ts` → `/sitemap.xml` dinámico: home, matches, tienda, legales (placeholder Lote 3), torneos ABIERTO\|EN_JUEGO.
- `apps/web/app/robots.ts` → `/robots.txt` con allow/disallow + Sitemap declarado.
- `apps/web/app/layout.tsx` — `metadataBase`, title template `%s | Habla!`, Open Graph completo (`es_PE`), Twitter `summary_large_image`.
- `apps/web/app/opengraph-image.tsx` → imagen OG 1200×630 edge-generada (placeholder brand).
- `apps/web/app/icon.tsx` (192×192) + `app/apple-icon.tsx` (180×180) — favicons placeholder.
- `apps/web/app/manifest.ts` → PWA manifest con colores brand correctos.
- JSON-LD `SportsEvent` embed en `/torneo/[id]` para rich snippets en Google.

### Rutas indexables
Allow: `/`, `/matches`, `/tienda`, `/torneo/*`, `/live-match`, `/legal/*`.
Disallow: `/admin`, `/wallet`, `/perfil`, `/mis-combinadas`, `/api/*`, `/auth/*`, `/uploads/*`.

### Regla operacional
Al sumar una ruta pública nueva, actualizar `app/sitemap.ts` y (si corresponde) `app/robots.ts`. El sitemap revalida cada 1h; torneos se pullean en vivo desde BD.

### TODO brand assets
Los favicons + OG image actuales son placeholders generados dinámicamente (ImageResponse edge). Reemplazar con PNGs finales dropeados en `apps/web/public/`:
- `favicon.ico` (multi-res 16/32/48)
- `icon-192.png`, `icon-512.png`
- `apple-touch-icon.png` (180×180)
- `opengraph-image.png` (1200×630)

Cuando los assets entren, eliminar `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx` y actualizar `app/manifest.ts` + `app/layout.tsx` para referenciar los PNGs estáticos.

---

## 20. GOTCHAS Y DECISIONES TÉCNICAS

### CSP y servicios third-party
Cada vez que se integre un nuevo servicio externo (PostHog, Sentry, Culqi, Cloudflare, etc.), verificar los dominios REALES que usa antes de agregarlos al CSP. Los dominios "marketing" (ej: `posthog.com`) a veces difieren de los dominios técnicos (`*.i.posthog.com` para US, `*.eu.i.posthog.com` para EU). Confirmar con DevTools → Network en el primer deploy de staging/prod antes de asumir que funciona.

### Cómo validar que un servicio third-party realmente funciona
No confiar en "el script se cargó" sin validar el request de datos real. Proceso: DevTools → Network con filtro del servicio → ver al menos 1 request POST/GET con status 200 al endpoint de ingesta (ej: `us.i.posthog.com/e/` para PostHog, `*.ingest.sentry.io` para Sentry). Si solo hay requests al CDN de assets pero ninguno al endpoint de ingesta, el servicio NO está capturando.

### NEXT_PUBLIC_* + Railway + Dockerfile
Next.js inlinea las vars `NEXT_PUBLIC_*` en el bundle cliente DURANTE `next build`, no en runtime. Railway con builder=DOCKERFILE solo las pasa al `docker build` si el Dockerfile las declara explícitamente como `ARG` + `ENV` antes del `RUN ... build`. Sin eso, Next inlinea `undefined` y cualquier `if (!process.env.NEXT_PUBLIC_X) return` en un provider del cliente dispara silenciosamente — sin errores, sin warnings, sin requests. Regla: al sumar una `NEXT_PUBLIC_*` nueva, tocar SIEMPRE el `Dockerfile` (ARG+ENV) junto con el código que la lee, y los guards condicionales de providers del cliente deben loggear su config ANTES de cualquier early-return para ser debuggeables.

### Placeholders {{LEGAL_*}} visibles en producción
Los documentos legales contienen placeholders `{{RAZON_SOCIAL}}`, `{{RUC}}`, `{{PARTIDA_REGISTRAL}}` (y similares) que se resuelven en runtime leyendo `process.env.LEGAL_*`. Mientras esas env vars no estén configuradas en Railway, los placeholders aparecen literales en el render público (ej: en `/legal/terminos`). Esto es **intencional**: visibiliza datos faltantes en lugar de ocultarlos con valores inventados. Cuando llegue el RUC y la partida SUNARP, setear las vars en Railway y el render se actualiza al siguiente request (lectura de fs en cada SSR). El reemplazo vive en `lib/legal-content.ts:resolvePlaceholders()`.

### Webpack 5 no maneja imports `node:` en server bundle de Next.js
Webpack 5 lanza `UnhandledSchemeError: Reading from "node:child_process" is not handled by plugins (Unhandled scheme)` cuando algún módulo importado desde un Route Handler / RSC usa el prefix `node:` para módulos sin polyfill de browser (típicamente `child_process`). Para `node:fs` y `node:path` Webpack tiene polyfills nativos y no rompe — para todo lo demás hay que **quitar el prefix** (`import { spawn } from "child_process"`). Misma funcionalidad, builtin de Node, queda externo en el server bundle. Aplicar la regla a cualquier módulo nuevo que use APIs de Node solo-server (Lote 7: backup.service.ts).

### `pg_dump` + Postgres major version mismatch
El binario `pg_dump` debe ser **versión >= servidor**. Postgres 16 server con un cliente 15 falla con "server version mismatch". El Dockerfile instala `postgresql16-client` (no `postgresql-client` a secas, que en algunas Alpine pinea a 15). Si se actualiza el Postgres de Railway a v17, también hay que bumpear el paquete del Dockerfile.

### Refresh de sesión cliente con NextAuth (`update({})` — el arg es obligatorio)
NextAuth v5 con strategy JWT cachea los datos del usuario (id, rol, username, usernameLocked) dentro del token firmado en la cookie. Cuando un endpoint muta esos datos en BD (ej. `POST /api/v1/auth/completar-perfil` setea `username` + `usernameLocked=true`), el cliente debe forzar el re-emit del JWT llamando `await update({})` de `useSession()` con un objeto **no-undefined**. **Crítico:** `update()` SIN args hace GET a `/api/auth/session` y NO dispara el callback `jwt({ trigger: 'update' })` — el token nunca se relee de BD ni se reemite la cookie. Solo `update({...})` con cualquier objeto (incluso vacío) hace POST y dispara el trigger; el callback ya está implementado para releer y reemitir. El comportamiento está en `node_modules/next-auth/lib/client.js:fetchData` — solo agrega `body` si lo recibe explícitamente. Después del `await update({})`, hard reload con `window.location.href = callbackUrl` en vez de `router.push + router.refresh`, porque los Server Components (NavBar, layout RSC) leen el JWT desde la cookie en el render SSR — el hard reload garantiza una request HTTP fresca con la cookie ya rotada. Patrón completo en [`auth.ts`](apps/web/lib/auth.ts) + [`CompletarPerfilForm.tsx`](apps/web/components/auth/CompletarPerfilForm.tsx).

### Invalidación de cache tras mutaciones (App Router)
En App Router, los Server Components fetchean datos en cada SSR pero el navegador mantiene un **Router Cache** que sirve la versión renderizada hasta que algo lo invalida. Tras una mutación que afecte data renderizada en SSR (crear ticket, inscribir, cancelar canje), hay que invalidar en dos niveles: (1) el endpoint llama `revalidatePath(ruta)` o `revalidateTag(tag)` de `next/cache` para purgar el cache del data fetcher en el servidor; (2) el cliente, si se mantiene en una página afectada, llama `router.refresh()` de `next/navigation` para invalidar el Router Cache local y forzar un re-fetch del Server Component. Sin (1) los nuevos requests SSR reciclan datos viejos; sin (2) el cliente que ya tenía la página renderizada no la re-pide. Patrón aplicado en `POST /api/v1/tickets`, `POST /api/v1/torneos/:id/inscribir` y `ComboModal.tsx`.

### Modales con snapshot de datos congelado
Cuando un modal muestra datos que cambian con la mutación que lo dispara (ej. el `ComboModal` muestra pozo + 1er premio del torneo), el endpoint debe devolver la entidad actualizada en su response y el modal usar esos datos para repintar — NO confiar en `router.refresh()` ni en datos pre-mutación que ya viven en el state del padre. `router.refresh()` solo invalida el Router Cache del cliente para futuras navegaciones; no muta props que ya están en memoria. Patrón aplicado: `POST /api/v1/tickets` devuelve `data.torneo` con `{ totalInscritos, pozoBruto, pozoNeto, ... }` y el modal lo guarda en un state local que sobreescribe los valores derivados del prop original. Helper compartido `derivePozosDisplay()` en `combo-info.mapper.ts` evita duplicar la fórmula de primer-premio entre el load inicial y el repintado post-mutación.

### Rate limiting de NextAuth — `useSession()` y `signOut`
NextAuth v5 con `useSession()` golpea `/api/auth/session` en cada mount de Client Component que lo usa, en cada window-focus, y al llamar `update({})` (post-completar-perfil). Sumado a `/api/auth/csrf` (1× por flujo OAuth) y `/api/auth/callback/google`, un usuario que navega varias páginas + cambia de tab fácilmente excede 10 req/min. Por eso el tier AUTH del middleware está en **30/min/IP** (Mini-lote 7.6 — antes 10), y `/api/auth/signout` está **completamente exento del rate limit** (cerrar sesión debe funcionar siempre, un 429 silencioso ahí deja la cookie sin borrar y el botón "no responde"). Si en el futuro escalamos a >1 réplica, este caveat se agrava (cada réplica tiene su propia ventana → límite efectivo N×); migrar a Redis con INCR+EXPIRE o Upstash.

### Logout robusto: `redirect: false` + hard reload manual
El default de NextAuth (`signOut({ callbackUrl: "/" })`) hace POST a `/api/auth/signout` y redirige automáticamente, sin retornar control al cliente. Si ese POST falla (429, red rota, edge runtime que cuelga) la cookie no se borra y la redirección bounce trae al usuario logueado de nuevo — síntoma "el botón no responde". Patrón en uso: `await signOut({ redirect: false, callbackUrl: "/" })` + `window.location.href = "/"` para hacer hard reload (mismo patrón que el `update({})` post-completar-perfil documentado más arriba). El hard reload garantiza que el SSR vea la cookie nueva y los Server Components renderen como visitante. Aplicado en `UserMenu.tsx`, `FooterSections.tsx` y el modal de eliminar cuenta tras eliminación exitosa.

### Bolsas de Lukas — `balanceLukas` como total compat (Lote 6A)
La sesión NextAuth, el store Zustand y los endpoints que devuelven `nuevoBalance` siempre trabajan con el total de las 3 bolsas. `balanceLukas` en `Usuario` es redundante con `balanceCompradas + balanceBonus + balanceGanadas` pero se mantiene para que todos los callers que ya existen sigan funcionando sin cambio de interfaz. En Lote 6B, cuando la UI empiece a mostrar el desglose, los endpoints pueden devolver además `desglose: { compradas, bonus, ganadas }`. Por ahora la regla es: toda mutación actualiza AMBOS (las bolsas afectadas Y `balanceLukas`) en la misma transacción.

### Por qué el service de backfill está en `apps/web/lib/services/` y no en `packages/db/scripts/`
El script `packages/db/scripts/backfill-bolsas.ts` es para ejecución directa (`tsx`). Para exponerlo como endpoint HTTP necesitamos importar desde `apps/web`; el package `@habla/db` no exporta subpaths de `scripts/` y crear un path alias cross-package añade fragilidad. La solución pragmática es un service equivalente en `apps/web/lib/services/backfill-bolsas.service.ts` que usa la instancia prisma compartida del app. El script tsx permanece como herramienta de emergencia si hay acceso shell directo al container.

---

## 21. CONTENIDO LEGAL E INSTITUCIONAL

Lote 3 (Abr 2026). 6 documentos legales + Centro de Ayuda público + Footer global + banner de consentimiento de cookies.

### Rutas y archivos fuente

| Ruta | Archivo fuente | Propósito |
|---|---|---|
| `/legal/terminos` | `apps/web/content/legal/terminos-y-condiciones.md` | Términos y Condiciones del servicio |
| `/legal/privacidad` | `apps/web/content/legal/politica-de-privacidad.md` | Política de Privacidad — Ley 29733 (Perú) |
| `/legal/cookies` | `apps/web/content/legal/politica-de-cookies.md` | Política de Cookies (categorías, tabla, gestión) |
| `/legal/juego-responsable` | `apps/web/content/legal/juego-responsable.md` | Compromiso, herramientas de control, recursos |
| `/legal/canjes` | `apps/web/content/legal/canjes-y-devoluciones.md` | Procedimiento de canjes, reembolsos, vencimientos |
| `/legal/aviso` | `apps/web/content/legal/aviso-legal.md` | Aviso legal del sitio (titularidad, IP, jurisdicción) |
| `/ayuda/faq` | `apps/web/content/legal/faq.md` | Centro de Ayuda público — 5 categorías, 20 preguntas |

Las 6 rutas legales son `generateStaticParams` con `LEGAL_SLUGS` en `lib/legal-content.ts`. El parser de FAQ (`lib/faq-content.ts`) lee el .md y arma una estructura tipada `FaqCategory[]` que el `<FaqClient>` consume con buscador + acordeón.

### Renderizado
- Markdown vía `react-markdown` + `remark-gfm` (única dep nueva del lote). Componente único `<MarkdownContent>` con clases Tailwind por elemento. Sanitización por default del lib (sin `dangerouslySetInnerHTML`).
- Layout legal (`app/legal/layout.tsx`) y Ayuda (`app/ayuda/layout.tsx`) heredan NavBar + Footer pero NO BottomNav (mobile bottom nav rompería la legibilidad de documentos largos).
- Cada página legal tiene TOC sticky desktop, collapsable mobile, y botón "Volver arriba" flotante.

### Cómo actualizar contenido
1. Editar el .md correspondiente en `apps/web/content/legal/`.
2. Si el cambio es sustancial, actualizar la línea `*Versión X.Y — Vigente desde: ...*` al final del documento y `legalLastMod` en `app/sitemap.ts`.
3. Commit + deploy automático.
4. Para cambios de razón social, RUC, partida registral, etc., actualizar las env vars `LEGAL_*` en Railway (no se tocan los .md — los placeholders se resuelven en runtime).

### Footer global
`components/layout/Footer.tsx` integrado en `app/(main)/layout.tsx`, `app/legal/layout.tsx` y `app/ayuda/layout.tsx`. Excluido del flow de auth (`app/auth/layout.tsx` mantiene su pantalla minimalista) y del panel admin. 4 columnas en desktop (Marca · Producto · Legal · Contacto), apilado en mobile.

### Cookie consent
`components/CookieBanner.tsx` montado en root layout — aparece en TODA ruta hasta que el usuario decide. Persistencia en localStorage `habla_cookie_consent_v1` con shape `{ status, preferences, analytics, decidedAt }`. Lógica del estado en `lib/cookie-consent.ts`. PostHog respeta el consent: init solo si `analytics === true`, y `opt_out_capturing()` si revoca. Ver §18.

---

## 22. LUKAS JUEGO Y LUKAS PREMIOS

Implementado en **Lote 6C** (26 Abr 2026). Cambio 100% de display — cero cambios de schema Prisma ni de lógica de negocio.

### Definición

| Concepto | Fórmula | Descripción |
|---|---|---|
| **Lukas Juego** | `balanceLukas` (= suma de las 3 bolsas) | Todo el saldo disponible para inscribirse en torneos y ganar |
| **Lukas Premios** | `balanceGanadas` | Subconjunto de Lukas Juego — solo los ganados en torneos, únicos canjeables en /tienda |

**Lukas Premios siempre es ≤ Lukas Juego.** El display deja eso visualmente claro como subconjunto con el patrón `↳`.

### Fuente única de verdad

Toda lectura pasa por **`lib/lukas-display.ts`**:
- `getLukasJuego(u)` — alias de `getBalanceTotal` (suma de las 3 bolsas)
- `getLukasPremios(u)` — alias de `getBalanceCanjeable` (solo `balanceGanadas`)
- `LUKAS_JUEGO_LABEL = "Lukas Juego"`, `LUKAS_JUEGO_DESC = "Todo tu saldo · Para jugar y ganar"`
- `LUKAS_PREMIOS_LABEL = "Lukas Premios"`, `LUKAS_PREMIOS_DESC = "Ganadas en torneos · Canjeables en Tienda"`

### Patrón visual de subconjunto

En todos los puntos de display que muestren ambos balances:

```
⚽ Lukas Juego     250 🪙
   ↳ 🏆 100 son Lukas Premios · canjeables en Tienda
```

Si Lukas Premios es 0: `↳ 🏆 0 son Lukas Premios · canjeables en Tienda` (se muestra igual).

### Páginas donde aplica el patrón

| Página / Componente | Implementación |
|---|---|
| **Header (NavBar)** | `BalanceBadge`: dos líneas en desktop (Lukas Juego + `↳` Lukas Premios), solo total en mobile para no romper layout |
| **`/matches` sidebar** | `SidebarBalanceWidget`: chip verde `↳ 🏆 X son Lukas Premios` bajo el monto principal |
| **`/wallet` hero** | `WalletBalanceHero`: label "⚽ Lukas Juego" + chip inline `↳ 🏆 X son Lukas Premios` |
| **`/wallet` info box** | Texto `¿Cómo se calcula cada balance?` explica cada concepto |
| **`/tienda`** | Sin 3-card stats; muestra solo chip de `balanceGanadas` con label "Disponibles para canjear" |
| **`/mis-combinadas`** | `LukasPremiosPill` reemplaza `BalancePill` — muestra `balanceGanadas` con stripe verde |

### Propagación del dato `balanceGanadas`

`balanceGanadas` **no está en el JWT de sesión** (solo `balanceLukas` total). Flujo para cada punto de display:

1. **`(main)/layout.tsx`** — llama `obtenerBalanceGanadas(userId)` en paralelo con `contarLiveMatches()` → pasa a `NavBar` como `initialBalanceGanadas`.
2. **`MatchesSidebar.tsx`** — llama `obtenerBalanceGanadas(userId)` en su `Promise.all` → pasa a `SidebarBalanceWidget`.
3. **`/wallet`** — `WalletView` ya recibe `desglose.ganadas` (del `wallet-view.service`) → pasa a `WalletBalanceHero`.
4. **`/tienda`** — página ya lee `initialBalanceGanadas` del server → pasa a `TiendaContent`.
5. **`/mis-combinadas`** — página llama `obtenerBalanceGanadas()` en su `Promise.all` → pasa a `LukasPremiosPill`.

`obtenerBalanceGanadas(userId)` vive en `lib/usuarios.ts` (un `findUnique` con `select: { balanceGanadas: true }`).

### Reactividad

- **Lukas Juego (total)**: reactivo — el store Zustand (`useLukasStore`) se actualiza tras inscripción/canje/compra.
- **Lukas Premios (ganadas)**: valor SSR — solo cambia cuando un torneo finaliza y acredita premios (evento server-side). Se refresca en la siguiente navegación completa. No requiere reactividad client-side para el MVP.

### Corrección visual simultánea

El token Tailwind `bg-hero-blue` se corrigió en Lote 6C para coincidir exactamente con el mockup `.balance-hero-v2`:
- Antes: `linear-gradient(135deg, #0052CC 0%, #0038B8 100%)` (terminaba en azul-mid)
- Después: `linear-gradient(135deg, #0052CC 0%, #001050 100%)` (termina en azul-dark navy, per mockup)
