# CLAUDE.md — Habla! App

> Cerebro del proyecto. Cargado en cada sesión: corto y denso. Historial detallado de cambios vive en commits y PRs.
> Última reescritura: 2 May 2026 (Pivot a v3.2 — roadmap K-P + paywall por nivel + rebrand Premium → Socios + 4 productos).
> Última actualización: 2 May 2026 — Lote L cerrado (Motor enriquecido + AnalisisPartido productivo). Cero migración: la entidad `AnalisisPartido` ya existía (Lote K). Nuevos servicios: `apps/web/lib/services/analisis-partido-prompts.ts` (PROMPT_VERSION="v3.2.0" + system prompt para objeto rico de 8 bloques + Zod `AnalisisRichResponseSchema` + parser tolerante), `analisis-partido-generador.service.ts` (`generarAnalisisParaPartido(partidoId, opts)` upsert idempotente con cero auto-publicación + `regenerarAnalisis()` para admin + `generarAnalisisDelDia()` cron red de seguridad cada 4h, persiste promptVersion+inputsJSON+latenciaMs+tokens), `analisis-partido-evaluador.service.ts` (`evaluarAnalisisFinalizados()` cada 1h evalúa 1X2/combinada/mercados secundarios/tarjetas/goles + maneja CANCELADO con NULO + snapshot in-memory 90d alimenta motor-salud), `motor-salud.service.ts` (`obtenerKPIsMotor(rango)` % aprobados sin edición + % acierto por mercado + EV+ realizado + latencia/costo Anthropic con cache TTL 5min + `obtenerTendenciaMotor()` chart 90d + `obtenerCausasRechazo()`). Endpoints admin nuevos: `PATCH /api/v1/admin/partidos/[id]/filtros` (mutación de Filtro 1+2+override con auditoría 100%, dispara generación fire-and-forget al activar Filtro 1, archiva análisis aprobado al desactivar Filtro 1), `POST /api/v1/admin/partidos/[id]/regenerar-analisis` (regeneración manual sincrónica + degrada estado a PENDIENTE), `GET /api/v1/admin/motor/salud` (consume motor-salud, query `?rango=7d|30d|90d&refresh=1`). Crons HTTP nuevos: `/api/v1/crons/generar-analisis` + `/api/v1/crons/evaluar-analisis` (Bearer CRON_SECRET o sesión ADMIN). `instrumentation.ts` cablea Job T (generar cada 4h, primer tick 300s) + Job U (evaluar cada 1h, primer tick 320s). Manejo partidos pospuestos/cancelados (decisiones §4.9.3+§4.9.4): `partidos-import.service.ts` extendido con `detectarYNotificarTransiciones()` que detecta cambio de fechaInicio (tolerancia 1min) y transición a CANCELADO en cada upsert; reset de `Torneo.cierreAt` en pospuestos para mantener combinadas editables; emails fire-and-forget a usuarios con tickets activos. Templates React Email nuevos: `PartidoPospuesto.tsx` + `PartidoCancelado.tsx` (con apuesta responsable + Línea Tugar 0800-19009). `puntuacion.service.ts` ya devolvía cero puntos cuando `golesLocal/Visita=null`, lo que cubre CANCELADO sin cambios. `PickPremium` (canal WhatsApp) sigue intacto del Lote E — coexiste con `AnalisisPartido` (web). Costo estimado Anthropic: $15/M tokens input + $75/M output (modelo Opus). Cero deps nuevas. tsc + lint pasan limpios. Branch `feat/lote-l-motor-enriquecido` → merge a `main` → push.

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

## Estado de lotes — Histórico (Lotes 0-11) + Roadmap v3.1 (A-J cerrados) + Roadmap v3.2 (K-P)

### Lotes 0-11 — Reciclables ✅

Toda la infraestructura previa al pivot v3.1 sigue válida. Lo construido en estos lotes es la base sobre la que se ejecuta el roadmap K-P del v3.2.

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
| 9 — Comparador de cuotas + odds cache | ✅ | `<CuotasComparator>` con cache Redis 30min. |
| 10 — Verificación MINCETUR weekly + newsletter | ✅ | Cron K verifica casas. Newsletter doble opt-in con digest semanal. |
| 11 — Home rediseñada + nav adjustments + UX editorial | ✅ | Home hub editorial 6 secciones. NavBar 5 links. |

### Lotes 12-16 originales — DEPRECADOS ❌

Reemplazados por el roadmap A-J (cerrado) y luego por el K-P (v3.2 vigente).

### Roadmap v3.1 A-J — Cerrados ✅

Toda la infraestructura del pivot v3.1 (mobile-first usuario + admin desktop-only + Premium WhatsApp Channel + microcopy + PWA + QA + runbooks lanzamiento) está cerrada. Detalle completo del trabajo se preserva en commits y los archivos de specs `docs/ux-spec/` que documentaban cada lote.

| Lote | Estado | 1-línea |
|---|---|---|
| A — Design system v3.1 + tokens | ✅ | Tokens Tailwind nuevos + átomos UI compartidos. |
| B — Reauditoría móvil capa pública | ✅ | Layouts `(public)`/`(main)` unificados mobile-first + 11 vistas refactor. |
| C — Reauditoría móvil capa autenticada | ✅ | URLs autenticadas mobile-first + Liga/perfil refactor + redirects 301. |
| D — UI Premium WhatsApp | ✅ | Vistas `/premium`, `/premium/checkout`, `/premium/exito`, `/premium/mi-suscripcion` + `<PickWrapper>`. |
| E — Backend Premium completo | ✅ | Modelos suscripciones + OpenPay + WhatsApp Cloud API + Anthropic + 3 jobs (gen/eval/sync). |
| F — Admin desktop operación | ✅ | Layout admin desktop-only + sidebar + cola validación picks + suscripciones + auditoría 100%. |
| G — Admin desktop análisis | ✅ | KPIs/cohortes/vitals/finanzas/alarmas/auditoría + 2 jobs (alarmas/lighthouse). |
| H — Microcopy + emails + WhatsApp | ✅ | 10 archivos copy + 11 templates React Email + 7 templates HSM + sonner toasts. |
| I — Mobile-first audit + PWA | ✅ | PWA installable + service worker custom + iconos dinámicos + CLS prevention. |
| J — QA + soft launch + runbooks | ✅ | Auditoría exhaustiva + 2 hot-fixes SEO + k6 reescrito + 3 runbooks. |

### Roadmap v3.2 K-P — En curso

| Lote | Pista | Documento referencia | Qué hace |
|---|---|---|---|
| **K** — Foundation v3.2 + URLs nuevas + redirects ✅ | Ambas | `docs/plan-trabajo-claude-code-v3.2.md` § Lote K | Migración aditiva con `AnalisisPartido` (objeto rico con `promptVersion`+`inputsJSON`), enums `EstadoAnalisis`+`VisibilidadOverride`, columnas Filtro 1+2+override en `Partido`, `Usuario.yapeNumero`, `Ticket.numEdiciones` + unique `(usuarioId,torneoId)`. URLs nuevas: cuotas+partidos→las-fijas, casas+guias→reviews-y-guias, comunidad→liga, comunidad/[username]→jugador, premium→socios, premium/mi-suscripcion→socios-hub. 22 redirects 301 en `next.config.js`. Eliminadas `/perfil/eliminar` y `/suscribir`. Auto-redirect Socio→/socios-hub server-side. Archivos nuevos: `lib/config/paywall.ts` (política hardcodeada), `lib/services/auth-state.service.ts`, `components/auth/AuthStateProvider.tsx`, `hooks/useAuthState.ts`, `components/auth/AuthGate.tsx`. Layouts cablean `<AuthStateProvider>` server-side. CLAUDE.md reescrito a v3.2. Docs legacy v3.1 movidos a `docs/legacy/`. Cero deps nuevas. |
| **L** — Motor enriquecido + AnalisisPartido productivo ✅ | Backend | `docs/plan-trabajo-claude-code-v3.2.md` § Lote L | Prompt curado con `PROMPT_VERSION="v3.2.0"` + Zod schema estricto + parser tolerante. Generador (`analisis-partido-generador.service.ts`) produce objeto rico de 8 bloques en una sola llamada Claude API con estado PENDIENTE (cero auto-publicación), persiste promptVersion+inputsJSON+latencia+tokens, idempotente sobre análisis APROBADO, restaura ARCHIVADO sin regenerar. Worker fire-and-forget dispara generación inmediata al activar Filtro 1 vía `PATCH /api/v1/admin/partidos/[id]/filtros` (con auditoría 100% y archivado de análisis APROBADO al desactivar Filtro 1). Evaluador (`analisis-partido-evaluador.service.ts`) cubre 1X2/combinada/mercados secundarios/tarjetas/goles, maneja CANCELADO con NULO, snapshot in-memory 90d. Manejo de partidos pospuestos (cambio de fechaInicio con tolerancia 1min) y cancelados extendido en `partidos-import.service.ts` con email a usuarios con tickets activos (templates React Email `PartidoPospuesto`+`PartidoCancelado` con apuesta responsable + Línea Tugar) y reset de `Torneo.cierreAt` para mantener combinadas editables. `motor-salud.service.ts` con cache TTL 5min produce KPIs (% aprobados sin edición, % acierto por mercado, EV+ realizado, costo Anthropic estimado), tendencia 90d y causas de rechazo. Endpoints: `GET /api/v1/admin/motor/salud`, `POST /api/v1/admin/partidos/[id]/regenerar-analisis`, crons HTTP `/api/v1/crons/generar-analisis` + `evaluar-analisis`. `instrumentation.ts` cablea Job T (generar cada 4h) + Job U (evaluar cada 1h). `PickPremium` del Lote E (canal WhatsApp) sigue intacto y coexiste. Cero deps nuevas. Cero migración. |
| **M** — Las Fijas + La Liga ⏳ | Usuario | `docs/plan-trabajo-claude-code-v3.2.md` § Lote M | Las dos vistas centrales del usuario con paywall por nivel, reglas integrales de combinada (9 sub-decisiones §4.9), validación servidor antes del kickoff, sincronía Las Fijas ↔ Liga, ranking en vivo paginado con sticky-bottom. |
| **N** — Home + Socios + Socios Hub + Reviews y Guías + Perfiles ⏳ | Usuario | `docs/plan-trabajo-claude-code-v3.2.md` § Lote N | Home con 3 estados consolidados, /socios + /socios-hub rebrand sin webinars, /reviews-y-guias unificado con tabs, /perfil con cuenta inline, /jugador/[username] perfil público. |
| **O** — Admin operación: refactor + 4 vistas nuevas ⏳ | Admin | `docs/plan-trabajo-claude-code-v3.2.md` § Lote O | /admin/dashboard +2 secciones KPI, /admin/picks (renombre con tabs Free/Socios), /admin/partidos NUEVO (pipeline filtros), /admin/liga-admin rework, /admin/liga-verificacion NUEVO (Yape Top 10 simple). |
| **P** — Admin analítica + pulido + cierre ⏳ | Ambas | `docs/plan-trabajo-claude-code-v3.2.md` § Lote P | /admin/motor + /admin/paywall + /admin/embudo + /admin/vinculaciones, pulidos transversales, CLAUDE.md cierre v3.2, smoke runbook v3.2. |

**Ruta crítica v3.2:** **K ✅** → **L ✅** → M → N → O → P. K es prerequisito de todo (schema, URLs, paywall config, AuthGate). L es prerequisito de M, N, O, P (datos del motor alimentan vistas).

## Documentos de referencia v3.2

**Verdad absoluta del UX e inmodificable:**
- `docs/habla-mockup-v3.2.html` — 24 vistas (10 públicas + 14 admin) en 2 viewports (mobile ~380px + desktop ~1400px) y 3 estados de auth (Visitante / Free / Socio).

**Estrategia de negocio:**
- `Habla_Plan_de_Negocios_v3_2.md` (raíz) — productos, KPIs, modelo de negocio, jerarquía visible.

**Decisiones técnicas cerradas:**
- `docs/analisis-repo-vs-mockup-v3.2.md` — 5 decisiones críticas + 11 operativas (incluye 9 sub-decisiones de §4.9 sobre la combinada).

**Roadmap operativo:**
- `docs/plan-trabajo-claude-code-v3.2.md` — alcance + criterios de cierre por lote (K-P).

**Legacy v3.1 (referencia histórica, no usar para implementación nueva):**
- `docs/legacy/Habla_Plan_de_Negocios_v3.1.md`
- `docs/legacy/mockup-actualizado-v3.1.html`
- `docs/ux-spec/` — specs por carpeta del v3.1. Siguen siendo referencia para componentes que se reciclan tal cual (átomos del Lote A, microcopy, etc.) pero **el mockup v3.2 manda en cualquier conflicto**.

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
12. **UX alineado al mockup v3.2.** Cualquier cambio de UX (copy, layout, componente, rebrand) respeta lo definido en `docs/habla-mockup-v3.2.html`. **El mockup v3.2 manda en cualquier ambigüedad y NO se modifica para acomodar la implementación** — al revés: la implementación se adapta al mockup. Si una decisión no está cubierta en el mockup, leer también `docs/analisis-repo-vs-mockup-v3.2.md` y el `Habla_Plan_de_Negocios_v3_2.md` antes de inventar. Las specs `docs/ux-spec/` v3.1 siguen sirviendo como referencia para componentes que se reciclan tal cual, pero el mockup v3.2 prevalece. El mockup `docs/habla-mockup-completo.html` es legacy del modelo previo al v3.1.
13. **Paridad mobile + desktop según mockup para pista usuario; desktop-only para pista admin.** El mockup v3.2 (`docs/habla-mockup-v3.2.html`) define explícitamente cómo se ve cada vista en mobile (~380px) y en desktop (~1400px). Ambos viewports son ciudadanos de primera clase y ambos layouts deben implementarse con la misma calidad UX — **NO existe la lógica "mobile-first se construye y desktop se adapta"**, los dos diseños están planeados deliberadamente y son específicos. Targets: Lighthouse Mobile ≥90 y Lighthouse Desktop ≥95 en rutas críticas (`/`, `/las-fijas/[slug]`, `/socios`, `/liga`). LCP móvil <2.5s / desktop <2s; INP móvil <200ms / desktop <150ms; CLS <0.1 ambos. Pista admin se mantiene desktop-only (1280px+, mobile bloqueado con `<MobileGuard>`); esa decisión arquitectónica no cambia.

### Reglas adicionales del v3.1 (vigentes en v3.2)

14. **Cero datos de tarjeta tocan el servidor de Habla!.** Tokenización con OpenPay.js client-side. Backend recibe solo el token.
15. **Verificación de firma obligatoria** en TODO webhook. Sin firma válida → 401. OpenPay HMAC-SHA256, WhatsApp X-Hub-Signature-256.
16. **Idempotencia obligatoria** en webhooks (pueden reintentar mismo evento). Verificar estado actual antes de procesar.
17. **Retry con backoff exponencial** para envíos críticos (emails, WhatsApp). 3 intentos: 1s, 2s, 4s. Después → log critical.
18. **Cero auto-publicación de análisis.** Cada análisis generado por Claude API DEBE pasar por aprobación humana del editor antes de publicarse al sitio o al canal. En v3.1 esto aplicaba a `PickPremium`; en v3.2 aplica también a `AnalisisPartido` (decisión §1.1 del análisis-repo-vs-mockup-v3.2).
19. **Watermark con email del usuario** en cada pick que llega al bot 1:1 (dificulta forwarding masivo).
20. **Atajos de teclado** en vistas operativas admin (validar picks: A/R/E/↑↓/Esc). Inputs activos suprimen los atajos.
21. **Auditoría 100%** en acciones admin destructivas (helper `logAuditoria()` invocado desde cada server action). Logs pueden samplearse, auditoría nunca.
22. **Tono según `tono-de-voz.spec.md`** del Lote H. Persona "tú" (no "usted"), informal-friendly, español neutro Perú. Cero promesas legales.
23. **Apuesta responsable** mencionada en cualquier comunicación que invite a apostar. Línea Tugar 0800-19009.

### Reglas nuevas del v3.2

24. **Mockup v3.2 HTML como verdad absoluta e inmodificable.** El archivo `docs/habla-mockup-v3.2.html` define las 24 vistas en sus dos viewports (desktop ~1400px y mobile ~380px) y los 3 estados de auth (Visitante / Free / Socio). El mockup **no se modifica para acomodar la implementación** — al revés. El plan de negocios v3.2 (`Habla_Plan_de_Negocios_v3_2.md`) aporta contexto estratégico. El análisis (`docs/analisis-repo-vs-mockup-v3.2.md`) registra todas las decisiones técnicas. Estos tres documentos reemplazan al mockup viejo `docs/ux-spec/00-design-system/mockup-actualizado.html` y al `Habla_Plan_de_Negocios_v3.1.md` (movidos a `docs/legacy/`).
25. **Política del paywall hardcodeada** en `apps/web/lib/config/paywall.ts`. Cero configuración dinámica vía DB. La vista `/admin/paywall` es de monitoreo y preview, no de toggles dinámicos.
26. **Una combinada por jugador editable hasta el kickoff.** Validación obligatoria en servidor (no solo cliente). Unique constraint `(usuarioId, torneoId)` en `Ticket` (en v3.2 cada Torneo representa exactamente un Partido elegible de la Liga del mes, por lo que esto implica el "uno por partido" del mockup).
27. **`promptVersion` + `inputsJSON` obligatorios** en cada `AnalisisPartido` generado por Claude API. Sin esto, el motor opera a ciegas (no se puede comparar performance entre versiones de prompt ni reproducir/debuggear un análisis individual).
28. **Premios Liga Habla! pagados por Yape como premio publicitario.** Datos mínimos solamente: `nombre` (ya existe en `Usuario`) + `yapeNumero` (capturado al ganar Top 10, no antes). Sin DNI, sin cuenta bancaria, sin Reniec, sin cifrado especial.
29. **Hook `useAuthState` + componente `<AuthGate>` para gating del paywall.** Server components resuelven via `obtenerEstadoAuthServer()` y propagan al `<AuthStateProvider>`. Client components leen via `useAuthState()` o gating declarativo `<AuthGate state="socios">…</AuthGate>` / `<AuthGate not="visitor">…</AuthGate>`.

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
```

**Tasks paralelas externas que requieren lead time:**

- OpenPay BBVA: cuenta + verificación KYC + crear 3 planes (mensual/trimestral/anual) en dashboard.
- Meta Business Account + WhatsApp Business API: verificación de negocio + número dedicado verificado + System User Token.
- Anthropic Console: cuenta + método de pago + límite gasto $50/mes.
- WhatsApp Channel privado: crear manualmente + subir picks históricos.
- WhatsApp templates: submit 7 templates a Meta para aprobación.
- Resend: verificar dominio `hablaplay.com` con DNS records (SPF, DKIM, DMARC).

## Formato de reporte post-lote

Cada lote del roadmap K-P cierra con un reporte de 6 secciones, en este orden:

1. **Resumen 1 línea** del cambio.
2. **Archivos** creados / modificados / eliminados.
3. **Migración aplicada** (o "ninguna"). SQL completo si la migración existe.
4. **Pasos manuales para Gustavo post-deploy**, paso a paso, asumiendo cero contexto previo. Cubrir backup pre-deploy, variables Railway, configuración en proveedores externos (OpenPay, Meta, Anthropic), DNS, smoke en `hablaplay.com`.
5. **Pendientes** que quedaron fuera del lote.
6. **CLAUDE.md actualizado** según esta estructura.

## Autonomía y cierre del lote

- **Autonomía total.** Claude Code decide sin preguntar, documenta decisiones en el reporte.
- **Cierre con merge a main + push** (Railway deploya automático).
- **Validación post-deploy es del usuario** en `hablaplay.com`. Claude Code NO hace `pnpm dev` ni `next build` local.
- **Pasos manuales para Gustavo explícitos y atómicos** asumiendo cero conocimiento técnico.
