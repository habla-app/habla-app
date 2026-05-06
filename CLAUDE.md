# CLAUDE.md — Habla! App

> Cerebro del proyecto. Cargado en cada sesión: corto y denso. Historial detallado de cambios vive en commits y PRs.
> Última reescritura: 6 May 2026 (Lote V.15 — cleanup motor de cuotas + condensación CLAUDE.md).
> Última actualización: 6 May 2026 — Lote V.15 cerrado (cleanup post-V.14.5). El motor de captura de cuotas pasó por 15 iteraciones (V.1-V.14.5) hasta llegar a la arquitectura final: Railway orquesta + agente local del admin ejecuta scrapers Playwright vía Custom URL Protocol. V.15 es un cleanup quirúrgico que borra todo lo muerto: (a) **3 componentes UI**: `RefreshCasaBtn.tsx`, `RefreshPartidoBtn.tsx`, `VincularEventIdModal.tsx` — sin imports desde V.14.3; (b) **4 endpoints API**: `/admin/partidos/[id]/event-ids`, `/admin/partidos/[id]/cuotas/refresh`, `/admin/partidos/[id]/cuotas/refresh-casa`, `/admin/motor-cuotas/diagnostico-api` — sus únicos consumidores eran los componentes UI muertos y/o estaban diseñados para correr scrapers en Railway (imposible desde V.13 que requiere browser local del admin); (c) **1 servicio**: `lib/services/scrapers/alias-equipo.ts` — `aprenderAlias` se llamaba post-captura pero las funciones consumidoras (`matchearEquiposContraPartido`, `resolverNombreCanonico`) no tenían callers — los 5 scrapers V.12 hacen su matching internamente con `fuzzy-match.ts`; era un dead write chain; (d) **2 tablas BD**: `event_ids_externos` (vinculación manual de URLs de partido por casa, obsoleta desde V.11/V.12 cuando los scrapers descubren eventos por matching automático) y `alias_equipos` (auto-aprendizaje fuzzy nunca leído); migración `20260525000000_lote_v15_cleanup_motor_cuotas/migration.sql` con `DROP TABLE IF EXISTS` × 2; sin backup pre-deploy obligatorio porque las tablas no contienen data productiva; (e) **directorio**: `scripts/validacion-geo/` (23 tracked + ~510 untracked artefactos de prototipo Stake/análisis estructural pre-V.11); (f) **CLAUDE.md condensado**: removida la cascada de "Última actualización previa" para los 14 lotes V.X.X — el historial vive en commits/PRs. **`CapturaCuotasSection.tsx` simplificado**: eliminada columna "Event ID" (mostraba placeholder "auto"/"manual" sin valor real); los guards `fila.eventIdExterno ? <MercadoCelda> : "—"` en las 4 celdas de mercado se reemplazaron por checks directos de los valores de cuota (`fila.cuotaLocal || fila.cuotaEmpate || fila.cuotaVisita ?`). **`admin-cuotas.service.ts` simplificado**: removida la query `prisma.eventIdExterno.findMany`; el campo `metodoDiscovery` removido de `CapturaCuotasFila`; `eventIdExterno` ahora viene solo de `cuotas_casa.eventIdExterno` (string libre con valor `"manual"` para edición admin o liga canónica para capturas automáticas). **`cuotas-worker.ts`**: removidos `import { aprenderAlias }` + el bloque fire-and-forget de auto-aprendizaje (~25 líneas) + import de `prisma` (ya no se necesita en este archivo). **`captura-cuotas.service.ts`**: comentarios actualizados (eliminadas referencias a `EventIdExterno` como hint y al Lote V.6 discovery HTTP que nunca quedó en producción). **Pasos manuales para vos post-deploy**: (a) `git pull origin main` desde D:\habla-app; (b) la migración corre sola en Railway al boot vía `prisma migrate deploy` — no requiere acción manual. tsc + lint pasan limpios. Branch `feat/lote-v15-cleanup-motor-cuotas` → merge a `main` → push.

---

## Stack

Next.js 14 (App Router) + React 18 + Tailwind 3 · PostgreSQL 16 + Prisma · Redis 7 + Socket.io · Cloudflare R2 (backups) · Resend (email) · api-football.com · OpenPay BBVA (pasarela, Lote E) · WhatsApp Business API (Meta Cloud API, Lote E) · Anthropic Claude API (motor de análisis + bot FAQ, Lote E + Lote L) · Railway (Dockerfile multi-stage) · Cloudflare DNS+proxy. Monorepo pnpm 10 + Turborepo.

## Modelo actual

**Pivot 28 Abr 2026:** de plataforma de torneos con saldo interno y tienda → **plataforma editorial + comunidad gratuita + afiliación MINCETUR**. Sin operación de juego propio.

**Pivot 30 Abr 2026 (v3.1):** se ejecuta el roadmap A-J con Premium WhatsApp Channel + admin desktop-only. Lanzamiento productivo el 8 mayo 2026.

**Pivot 2 May 2026 (v3.2):** rebrand y profundización del modelo. Premium pasa a llamarse **Socios** (con paywall por nivel sobre vista única `/las-fijas/[slug]`). Se introducen **4 productos visibles** + filtros admin formales + el motor de análisis pasa a producir un **objeto rico único** por partido. Roadmap K-P documentado en `docs/plan-trabajo-claude-code-v3.2.md` para alcanzar el alcance completo del mockup v3.2 hacia el 8 mayo.

### Cuatro productos del modelo v3.2

- **Las Fijas** — vista crítica con paywall por nivel: pronóstico Habla! + análisis básico (Free) + combinada óptima + razonamiento detallado + análisis profundo de goles + análisis profundo de tarjetas + mercados secundarios (Socios). Reemplaza a `/cuotas` + `/partidos/[slug]`.
- **La Liga Habla!** — competencia comunitaria gratuita con S/1,250 mensuales en premios. Una combinada por jugador por partido elegible, editable hasta el kickoff. Top 10 del mes pagado por Yape como premio publicitario.
- **Reviews y guías** — biblioteca soporte (reviews casas autorizadas MINCETUR + guías editoriales). Hub `/reviews-y-guias` con tabs.
- **Socios** — suscripción mensual/trimestral/anual. Entrega vía WhatsApp Channel privado broadcast + bot FAQ 1:1 + bloques avanzados desbloqueados sobre `/las-fijas/[slug]`.

URL prod: `https://hablaplay.com` (alias `https://www.hablaplay.com`).

## Estado de lotes

### Lotes 0-11 — Reciclables ✅

Toda la infraestructura previa al pivot v3.1 sigue válida.

| Lote | Estado | Qué hace |
|---|---|---|
| 0 — Base previa al pivot | ✅ | Auth NextAuth v5 (Google + magic link Resend), torneos+tickets+ranking, backups R2 a Cloudflare, infra Railway+Cloudflare. |
| 1 — Cleanup servicios externos | ✅ | Quita Sentry, PostHog, Twilio + verificación teléfono/DNI. Cookie banner adaptado. |
| 2 — Demolición Lukas + wallet | ✅ | Drop completo del sistema de saldo interno + tienda en mantenimiento. |
| 3 — Demolición tienda + canjes + verif + límites | ✅ | Drop tablas Premio/Canje/LimitesJuego/VerificacionTelefono/VerificacionDni + 4 enums. BottomNav reescrito a 5 items. |
| 4 — Demolición contabilidad + eliminación total de Culqi | ✅ | Drop 8 tablas contables + Culqi. Pasarela neutral. |
| 5 — Leaderboard mensual + premios en efectivo | ✅ | Tablas `leaderboards` + `premios_mensuales`. Cierre idempotente S/1,250. Job J cierra mes anterior. |
| 6 — Logs + analytics in-house | ✅ | Reemplaza Sentry+PostHog. Tablas `log_errores` + `eventos_analitica`. |
| 7 — Afiliación MINCETUR | ✅ | Tablas `afiliados` + `clicks_afiliados` + `conversiones_afiliados`. Endpoint `/go/[casa]`. |
| 8 — Editorial + provider MDX | ✅ | Pipeline editorial completo basado en `.mdx`. |
| 9 — Comparador de cuotas + odds cache | ✅ | `<CuotasComparator>` con cache Redis 30min (Job N). Coexiste con motor V.5 — `<CuotasComparator>` lee primero `CuotasCasa`, fallback al cache. |
| 10 — Verificación MINCETUR weekly + newsletter | ✅ | Cron K verifica casas. Newsletter doble opt-in con digest semanal. |
| 11 — Home rediseñada + nav adjustments + UX editorial | ✅ | Home hub editorial 6 secciones. NavBar 5 links. |

### Roadmap v3.1 A-J — Cerrados ✅

Toda la infraestructura del pivot v3.1 (mobile-first usuario + admin desktop-only + Premium WhatsApp Channel + microcopy + PWA + QA + runbooks lanzamiento) está cerrada.

| Lote | 1-línea |
|---|---|
| A — Design system v3.1 + tokens | Tokens Tailwind nuevos + átomos UI compartidos. |
| B — Reauditoría móvil capa pública | Layouts unificados mobile-first + 11 vistas refactor. |
| C — Reauditoría móvil capa autenticada | URLs autenticadas mobile-first + Liga/perfil + redirects 301. |
| D — UI Premium WhatsApp | Vistas `/premium`, `/premium/checkout`, `/premium/exito`, `/premium/mi-suscripcion`. |
| E — Backend Premium completo | Modelos suscripciones + OpenPay + WhatsApp Cloud API + Anthropic + 3 jobs. |
| F — Admin desktop operación | Layout admin desktop-only + sidebar + cola validación picks + auditoría 100%. |
| G — Admin desktop análisis | KPIs/cohortes/vitals/finanzas/alarmas/auditoría + 2 jobs. |
| H — Microcopy + emails + WhatsApp | 10 archivos copy + 11 templates React Email + 7 templates HSM + sonner toasts. |
| I — Mobile-first audit + PWA | PWA installable + service worker custom + iconos + CLS prevention. |
| J — QA + soft launch + runbooks | Auditoría exhaustiva + hot-fixes SEO + k6 + 3 runbooks. |

### Roadmap v3.2 K-V — Cerrados ✅

| Lote | Pista | Qué hace |
|---|---|---|
| K — Foundation v3.2 + URLs nuevas + redirects | Ambas | Migración aditiva (`AnalisisPartido`, `EstadoAnalisis`+`VisibilidadOverride`, columnas Filtro 1/2 en Partido, `Usuario.yapeNumero`, `Ticket.numEdiciones`+unique). 22 redirects 301 a URLs v3.2. `lib/config/paywall.ts` hardcoded. `<AuthGate>` + `<AuthStateProvider>` + `useAuthState()`. |
| L — Motor enriquecido + AnalisisPartido | Backend | Generador Claude API con `PROMPT_VERSION="v3.2.0"` + Zod schema + parser tolerante. Estado PENDIENTE (cero auto-publicación, regla 18). Evaluador post-partido. Manejo pospuestos/cancelados con email a usuarios con tickets activos. Job T (4h) gen + Job U (1h) eval. |
| M — Las Fijas + La Liga | Usuario | Servicios `las-fijas.service.ts` + `liga.service.ts`. Helper `partido-slug.ts`. `tickets.service.ts` extendido (editar/eliminar). PUT/DELETE `/api/v1/tickets/[id]`. Vistas `/las-fijas`, `/las-fijas/[slug]`, `/liga`, `/liga/[slug]` con paywall por bloque vía `<AuthGate>`. |
| N — Home + Socios + Reviews y Guías + Perfiles | Usuario | Port literal del mockup v3.2 para 6 vistas: `/`, `/socios`, `/socios-hub`, `/reviews-y-guias`, `/perfil`, `/jugador/[username]`. |
| O — Admin operación | Admin | Port literal de 8 vistas admin: `/admin/dashboard`, `/admin/partidos`, `/admin/picks`, `/admin/liga-admin`, `/admin/liga-verificacion`, `/admin/usuarios`, `/admin/logs`, `/admin/auditoria`. `<AdminLayoutShell>` + counters dinámicos. Endpoints `aprobar-analisis`/`rechazar-analisis`. |
| P — Admin analítica | Ambas | Port literal de 6 vistas: `/admin/motor`, `/admin/paywall`, `/admin/embudo`, `/admin/vinculaciones`, `/admin/kpis`, `/admin/cohortes`. |
| Q-T | Usuario | Fidelidad 1:1 mockup sobre vistas Lote M + CSS literal en `mockup-styles.css` + componentes globales (NavBar/Footer/BottomNav) literales del mockup. |
| U | Ambas | Pulido funcional: 12 ítems UX/auth/SEO sobre lo cerrado. Auto-redirect Socio→/socios-hub via middleware (claim `esSocio` en JWT). FAQ Socios expandible. Editar inline cuenta. Toggle perfil público. Eliminar cuenta inline modal. Banner Yape Top 10. |
| **V — Motor de captura de cuotas** | **Backend** | **Arquitectura final V.14.5+V.15**: Railway orquesta (encola jobs BullMQ + endpoints HTTP `/agente/jobs/{proximos,resultado}` + `/agente/sesion/{iniciar,estado}`) y agente local del admin ejecuta scrapers Playwright. Custom URL Protocol `habla-agente://run?token=X` lanza el agente desde el browser via setup `setup-agente-windows.bat`. 5 casas: Apuesta Total (Kambi), Doradobet (Altenar), Betano (Danae), Inkabet (Octonovus), Te Apuesto (Coreix). Auto-shutdown del agente tras 2 polls vacíos consecutivos. Auto-refresh UI vía polling de `/agente/sesion/estado`. Edición manual via `EditarCuotasManualModal` (PATCH `/cuotas/manual`). Cron Job V (5am Lima) sigue encolando refresh global; espera al agente. |

**Ruta crítica v3.2 cerrada:** K → L → M → Q → R → S → T → N → O → P → U → V. Roadmap completo. Listo para deploy productivo del 8 mayo.

## Enfoque "fidelidad 1:1 mockup"

Desde el Lote Q el enfoque de implementación es **portar HTML del mockup a JSX** preservando estructura, clases CSS, textos y comportamientos.

> **El mockup HTML es código de referencia, no concepto de diseño.**

Las clases del mockup viven en `apps/web/app/mockup-styles.css` (Lote R cubrió las 24 vistas). NO inventar clases nuevas — agregarlas a `mockup-styles.css` si faltan. Solo se permiten estos puntos de divergencia:

1. **Datos**: `Brentford` → `{partido.equipoLocal}`.
2. **Navegación**: `data-nav="..."` → `<Link href="...">` de Next.
3. **Estado de auth**: `visitor-only`/`free-only`/`socios-only` → `<AuthGate state="...">`.
4. **Lógica de negocio**: validaciones, llamadas a API, server actions.

PROHIBIDO:
- Reinterpretar visualmente el mockup. Si tiene 9 columnas, son 9 columnas.
- Usar clases Tailwind utility cuando el mockup usa una clase nombrada.
- "Mejorar" el copy. Los textos del mockup son los textos finales.
- Omitir ítems, columnas, badges, CTAs por considerarlos secundarios.

## Documentos de referencia v3.2

**Verdad absoluta del UX e inmodificable:**
- `docs/habla-mockup-v3.2.html` — 24 vistas (10 públicas + 14 admin) en 2 viewports (mobile ~380px + desktop ~1400px) y 3 estados de auth.

**Estrategia de negocio:**
- `Habla_Plan_de_Negocios_v3_2.md` (raíz).

**Decisiones técnicas cerradas:**
- `docs/analisis-repo-vs-mockup-v3.2.md`.

**Roadmap operativo:**
- `docs/plan-trabajo-claude-code-v3.2.md`.

**Operación motor de cuotas:**
- `docs/agente-cuotas.md` — instrucciones del agente local.

**Legacy v3.1 (referencia histórica, no usar para nueva implementación):**
- `docs/legacy/Habla_Plan_de_Negocios_v3.1.md`, `docs/legacy/mockup-actualizado-v3.1.html`, `docs/ux-spec/`.

## Servicios externos vigentes

- **Cloudflare** — DNS + proxy + Email Routing (`@hablaplay.com` → Gmail).
- **Railway** — hosting (Dockerfile, 1 réplica web, Postgres, Redis, backups nativos).
- **Resend** — emails transaccionales (dominio `hablaplay.com` verificado).
- **api-football.com** — datos deportivos. Header `x-apisports-key`.
- **OpenPay (BBVA)** — pasarela de pagos. **Lote E.** Adapter REST con HMAC-SHA256.
- **WhatsApp Business API (Meta Cloud)** — bot FAQ 1:1 + envío de picks Socios 1:1. **Lote E.** Channel privado se gestiona manualmente.
- **Anthropic Claude API** — motor de análisis (objeto rico por partido) + bot FAQ conversacional. **Lote E + Lote L.** Modelo default `claude-opus-4-7`.
- **Cloudflare R2** — backups `pg_dump` diarios + mensual.
- **Google OAuth** — provider de NextAuth.
- **Google Search Console** — SEO ownership.
- **Google PageSpeed Insights API** — Lighthouse semanal contra rutas críticas. **Lote G.**
- **Uptime Robot** — monitor `/api/health`.
- **Registro MINCETUR** — `https://apuestasdeportivas.mincetur.gob.pe/`. Sólo lectura: cron K (Lote 10).
- **5 sportsbooks peruanos** — Apuesta Total (Kambi), Doradobet (Altenar), Betano (Danae), Inkabet (Octonovus), Te Apuesto (Coreix). Scrapeados por el agente local del admin desde su PC con perfil persistente.

Eliminados: Sentry+PostHog+Twilio (Lote 1), Culqi (Lote 4).

## Feature flags

Los flags `PREMIUM_HABILITADO` y `CURSOS_HABILITADO` del modelo previo **se eliminaron**. Socios es producto productivo. Cursos no existe en v3.2.

**v3.2:** la política del paywall NO usa feature flags dinámicas. Está hardcodeada en `apps/web/lib/config/paywall.ts`. La vista `/admin/paywall` (Lote P) es de monitoreo y preview, no de configuración. Si en el futuro hace falta toggles dinámicos, agregamos una tabla `FeatureFlag` sin reescribir la implementación.

## Reglas duras

1. **Prod-first, no local.** No correr `pnpm dev`/`next build`/migrar BD/levantar Postgres en local. Validación pre-push: solo `pnpm tsc --noEmit` + `pnpm lint`. Validación funcional la hace Gustavo en `hablaplay.com` post-deploy.
2. **Migraciones con `--create-only`.** Generar el SQL pero no aplicar local. Aplicación pasa por `prisma migrate deploy` en el `CMD` del Dockerfile al arrancar.
   - **Backup manual pre-deploy sólo si la migración compromete integridad de Postgres**: renombres de columna, cambios de tipo, conversiones JSONB↔relacional, FKs movidas, drops de tabla con data productiva. `CREATE TABLE` / `ALTER TABLE ADD COLUMN` / `UPDATE` de backfill puro **no** requieren backup.
3. **Branch por lote.** `feat/lote-<letra>-<slug>` (ej: `feat/lote-k-foundation-v32`). Migraciones y merges a `main` los aplica Claude Code directamente al cerrar el lote, sin gate de OK escrito de Gustavo. **Cierre incluye `git push origin main`** — Railway deploya desde `origin/main`, no desde local; merge sin push = deploy invisible.
4. **Commits Conventional.** `feat:`, `fix:`, `chore:`, `docs:`.
5. **Cero servicios externos nuevos** sin discutir antes. Las dependencias del v3.1 (OpenPay, WhatsApp Business, Anthropic, PageSpeed Insights) ya están aprobadas y son las únicas externas. Cualquier otra requiere discusión previa.
6. **TypeScript strict + Zod en entrada + Pino para logs** (no `console.log`).
7. **Cero hex hardcodeados en JSX.** Tokens Tailwind del Lote A (`brand-*`, `gold-*`, `premium-*`, `whatsapp-*`, `admin-*`).
8. **Fechas con timezone explícito.** Helpers en `lib/utils/datetime.ts`. Default `America/Lima`.
9. **`authedFetch` para `/api/v1/*`** desde el cliente. Centraliza `credentials: 'include'`.
10. **Modales con `createPortal(document.body)`** (`components/ui/Modal.tsx`).
11. **Operaciones admin one-shot** como endpoints `POST /api/v1/admin/*` con auth ADMIN o `Bearer CRON_SECRET`. Nunca en `startCommand`/`Dockerfile`.
12. **UX alineado al mockup v3.2.** Cualquier cambio de UX (copy, layout, componente, rebrand) respeta lo definido en `docs/habla-mockup-v3.2.html`. **El mockup v3.2 manda en cualquier ambigüedad y NO se modifica para acomodar la implementación** — al revés: la implementación se adapta al mockup. Si una decisión no está cubierta en el mockup, leer también `docs/analisis-repo-vs-mockup-v3.2.md` y el `Habla_Plan_de_Negocios_v3_2.md` antes de inventar.
13. **Paridad mobile + desktop según mockup para pista usuario; desktop-only para pista admin.** El mockup v3.2 define explícitamente cómo se ve cada vista en mobile (~380px) y en desktop (~1400px). Ambos viewports son ciudadanos de primera clase. Targets: Lighthouse Mobile ≥90 y Lighthouse Desktop ≥95 en rutas críticas. LCP móvil <2.5s / desktop <2s; INP móvil <200ms / desktop <150ms; CLS <0.1 ambos. Pista admin desktop-only (1280px+, mobile bloqueado con `<MobileGuard>`).

### Reglas adicionales del v3.1 (vigentes en v3.2)

14. **Cero datos de tarjeta tocan el servidor de Habla!.** Tokenización con OpenPay.js client-side. Backend recibe solo el token.
15. **Verificación de firma obligatoria** en TODO webhook. Sin firma válida → 401. OpenPay HMAC-SHA256, WhatsApp X-Hub-Signature-256.
16. **Idempotencia obligatoria** en webhooks (pueden reintentar mismo evento). Verificar estado actual antes de procesar.
17. **Retry con backoff exponencial** para envíos críticos (emails, WhatsApp). 3 intentos: 1s, 2s, 4s. Después → log critical.
18. **Cero auto-publicación de análisis.** Cada análisis generado por Claude API DEBE pasar por aprobación humana del editor antes de publicarse. Aplica a `PickPremium` (Lote E) y a `AnalisisPartido` (Lote L).
19. **Watermark con email del usuario** en cada pick que llega al bot 1:1 (dificulta forwarding masivo).
20. **Atajos de teclado** en vistas operativas admin (validar picks: A/R/E/↑↓/Esc). Inputs activos suprimen los atajos.
21. **Auditoría 100%** en acciones admin destructivas (helper `logAuditoria()` invocado desde cada server action). Logs pueden samplearse, auditoría nunca.
22. **Tono según `tono-de-voz.spec.md`** del Lote H. Persona "tú" (no "usted"), informal-friendly, español neutro Perú. Cero promesas legales.
23. **Apuesta responsable** mencionada en cualquier comunicación que invite a apostar. Línea Tugar 0800-19009.

### Reglas nuevas del v3.2

24. **Mockup v3.2 HTML como verdad absoluta e inmodificable.** El archivo `docs/habla-mockup-v3.2.html` define las 24 vistas en sus dos viewports y los 3 estados de auth. El mockup **no se modifica para acomodar la implementación** — al revés.
25. **Política del paywall hardcodeada** en `apps/web/lib/config/paywall.ts`. Cero configuración dinámica vía DB. La vista `/admin/paywall` es de monitoreo y preview, no de toggles dinámicos.
26. **Una combinada por jugador editable hasta el kickoff.** Validación obligatoria en servidor (no solo cliente). Unique constraint `(usuarioId, torneoId)` en `Ticket`.
27. **`promptVersion` + `inputsJSON` obligatorios** en cada `AnalisisPartido` generado por Claude API. Sin esto, el motor opera a ciegas.
28. **Premios Liga Habla! pagados por Yape como premio publicitario.** Datos mínimos: `nombre` + `yapeNumero` (capturado al ganar Top 10, no antes). Sin DNI, sin cuenta bancaria.
29. **Hook `useAuthState` + componente `<AuthGate>` para gating del paywall.** Server components resuelven via `obtenerEstadoAuthServer()` y propagan al `<AuthStateProvider>`.
30. **Fidelidad 1:1 al mockup como criterio de cierre + CSS literal en `mockup-styles.css`.** Cada vista debe ser visualmente indistinguible de la sección correspondiente del mockup HTML, en mobile y desktop. Una vista que cumple la funcionalidad pero difiere visualmente del mockup **no está terminada**.

### Reglas operativas del motor de cuotas (V.14+)

31. **Captura de cuotas corre en la PC del admin, no en Railway.** Los WAFs de Betano/Inkabet/etc bloquean IPs datacenter US. El agente local (`scripts/agente-cuotas.ts` + `setup-agente-windows.bat`) abre Chrome real con el perfil persistente del admin desde su IP residencial peruana, ejecuta los 5 scrapers Playwright + reporta vía HTTP. Railway solo orquesta (BullMQ + endpoints `/agente/jobs/{proximos,resultado}` + `/agente/sesion/{iniciar,estado}`).
32. **Refresh on-demand vía Custom URL Protocol.** El admin click "↻ Actualizar cuotas" en `/admin/partidos` o `/admin/partidos/[id]` → backend genera token UUID Redis (TTL 5min) + encola jobs en BullMQ → browser navega a `habla-agente://run?token=X` → Windows lanza el launcher.cmd → agente local pollea jobs filtrados por sesión + procesa + auto-exit. UI auto-refresh detecta `terminada=true` vía polling `/agente/sesion/estado`.
33. **Filtro 1 require 3 prerequisitos para activar.** `estadoCaptura === "COMPLETA"` (5/5 casas con 4 mercados cada una) + análisis Free APROBADO + algún `PickPremium` APROBADO. Backend valida en `PATCH /partidos/[id]/filtros`; UI deshabilita el toggle con tooltip si falta algo.
34. **Edición manual de cuotas por casa** vía `<EditarCuotasManualModal>` (botón "✏ manual" en cada fila de `CapturaCuotasSection`). Permite completar mercados que el motor no captura (ej. ±2.5 de Doradobet en WebSocket). PATCH `/cuotas/manual` con auth ADMIN + auditoría 100%.

## Variables de entorno relevantes

Lista de nombres (valores en Railway vault, no acá). Detalle en `.env.example`.

```
# Existentes (Lotes 0-11)
DATABASE_URL  REDIS_URL
AUTH_SECRET  NEXTAUTH_URL  GOOGLE_CLIENT_ID  GOOGLE_CLIENT_SECRET
API_FOOTBALL_KEY  API_FOOTBALL_HOST
RESEND_API_KEY
NEXT_PUBLIC_APP_URL  JWT_SECRET  NODE_ENV
CRON_SECRET  ADMIN_ALERT_EMAIL  ADMIN_EMAIL
R2_ACCOUNT_ID  R2_ACCESS_KEY_ID  R2_SECRET_ACCESS_KEY  R2_BUCKET_BACKUPS  R2_ENDPOINT
LEGAL_RAZON_SOCIAL  LEGAL_RUC  LEGAL_PARTIDA_REGISTRAL  LEGAL_DOMICILIO_FISCAL
LEGAL_DISTRITO  LEGAL_TITULAR_NOMBRE  LEGAL_TITULAR_DNI

# v3.1 — OpenPay BBVA (Lote E)
OPENPAY_MERCHANT_ID  OPENPAY_PRIVATE_KEY  OPENPAY_PUBLIC_KEY
OPENPAY_PRODUCTION  OPENPAY_WEBHOOK_SECRET

# v3.1 — WhatsApp Business API (Lote E)
META_BUSINESS_ID  WHATSAPP_PHONE_NUMBER_ID  WHATSAPP_ACCESS_TOKEN
WHATSAPP_VERIFY_TOKEN  WHATSAPP_APP_SECRET
WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK
WHATSAPP_BUSINESS_PHONE_NUMBER

# v3.1 — Anthropic API (Lote E + Lote L)
ANTHROPIC_API_KEY  ANTHROPIC_MODEL

# v3.1 — PageSpeed Insights (Lote G, opcional)
PAGESPEED_API_KEY

# v3.1 — Resend webhook (opcional)
RESEND_WEBHOOK_SECRET

# Lote V — Agente local de cuotas (configurado en la PC del admin)
HABLA_API_BASE        # ej. https://hablaplay.com
HABLA_AGENTE_TOKEN    # mismo CRON_SECRET de Railway
```

## Formato de reporte post-lote

Cada lote cierra con un reporte de 6 secciones, en este orden:

1. **Resumen 1 línea** del cambio.
2. **Archivos** creados / modificados / eliminados.
3. **Migración aplicada** (o "ninguna"). SQL completo si la migración existe.
4. **Pasos manuales para Gustavo post-deploy**, paso a paso, asumiendo cero contexto previo.
5. **Pendientes** que quedaron fuera del lote.
6. **CLAUDE.md actualizado** según esta estructura.

## Autonomía y cierre del lote

- **Autonomía total.** Claude Code decide sin preguntar, documenta decisiones en el reporte.
- **Cierre con merge a main + push** (Railway deploya automático).
- **Validación post-deploy es del usuario** en `hablaplay.com`. Claude Code NO hace `pnpm dev` ni `next build` local.
- **Pasos manuales para Gustavo explícitos y atómicos** asumiendo cero conocimiento técnico.
