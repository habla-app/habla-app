# CLAUDE.md — Habla! App

> Cerebro del proyecto. Cargado en cada sesión: corto y denso. Historial detallado de cambios vive en commits y PRs.
> Última reescritura: 3 May 2026 (Lote 6 — logs + analytics in-house).

---

## Stack

Next.js 14 (App Router) + React 18 + Tailwind 3 · PostgreSQL 16 + Prisma · Redis 7 + Socket.io · Cloudflare R2 (backups) · Resend (email) · api-football.com · OpenPay (BBVA, integración pendiente Lote 12) · Railway (Dockerfile multi-stage) · Cloudflare DNS+proxy. Monorepo pnpm 10 + Turborepo.

## Modelo actual

Pivot 28 Abr 2026: de plataforma de torneos con saldo interno y tienda → **plataforma editorial + comunidad gratuita + afiliación MINCETUR**. Sin operación de juego propio. Las inscripciones a torneos son gratuitas y los usuarios sólo compiten por ranking. Las capas Premium y Cursos van detrás de feature flags y se prenden en lotes posteriores. Deadline: lanzamiento **8 de junio de 2026**.

URL prod: `https://hablaplay.com` (alias `https://www.hablaplay.com`). El plan completo de 16 lotes vive en `plan-final-lotes.md`.

## Estado de lotes

| Lote | Estado | Qué hace |
|---|---|---|
| 0 — Base previa al pivot | ✅ | Auth NextAuth v5 (Google + magic link Resend), torneos+tickets+ranking, backups R2 a Cloudflare, infra Railway+Cloudflare. |
| 1 — Cleanup servicios externos | ✅ | Quita Sentry, PostHog, Twilio + verificación teléfono/DNI. Cookie banner adaptado. Eventos canónicos cableados en Lote 6 (lista vive en `apps/web/lib/analytics.ts`). |
| 2 — Demolición Lukas + wallet | ✅ | Drop completo del sistema de saldo interno: 4 columnas de balance en Usuario, columnas económicas del Torneo, tabla TransaccionLukas, enums. UI sin balance: NavBar limpio, sidebar de 3 widgets, "Predecir gratis", ranking sin premio. Tienda en mantenimiento. |
| 3 — Demolición tienda + canjes + verif + límites | ✅ | Drop tablas Premio/Canje/LimitesJuego/VerificacionTelefono/VerificacionDni + 4 enums + columnas Usuario.telefono/telefonoVerif/dniVerif + PreferenciasNotif.notifVencimientos. Borradas pages /tienda y /admin/canjes, endpoints /api/v1/{canjes,premios,admin/canjes,admin/seed/premios,usuarios/limites}, services canjes/premios/premios-seed/limites, JuegoResponsableSection. BottomNav reescrito a 5 items (Inicio · Partidos · Pronósticos · Comunidad · Perfil) con placeholders "Próximamente" en /pronosticos y /comunidad. |
| 4 — Demolición contabilidad + eliminación total de Culqi | ✅ | Drop 8 tablas (asientos, asientos_lineas, cuentas_contables, movimientos_banco_{esperados,reales}, cargas_extracto_banco, auditoria_contable_logs, eventos_culqi) + enum TipoCuenta. Borrados services contabilidad/conciliacion-banco/extracto-interbank.parser/auditoria-contable, pages /admin/{contabilidad,conciliacion,ingresos,reportes}, endpoints /api/v1/admin/contabilidad/*, componente PreviewBanner, Job I de instrumentation, alerta backup 2-fallos, templates email auditoría/backup, CulqiAdapter+stubs apps/api/modules/pagos, CSP de *.culqi.com. Pasarela queda como esqueleto neutral (`types.ts` con 2 métodos + `mock-pasarela.ts`). Flag `pagosHabilitados()` se reemplaza por `premiumHabilitado()` + `cursosHabilitado()`. Adapter real OpenPay se construye en Lote 12. |
| 5 — Leaderboard mensual + premios en efectivo | ✅ | Nuevas tablas `leaderboards` + `premios_mensuales` + columna `tickets.puntosFinales` (snapshot al FT). Service `leaderboard.service.ts` con `cerrarLeaderboard` idempotente y tabla fija S/ 1,250 (1°S/500 · 2°S/200 · 3°S/200 · 4°-10°S/50 c/u). Job J de instrumentation cierra el mes anterior cada día 1 ≥01:00 PET. Email `premioMensualGanado` + wrapper `notifyPremioMensualGanado`. Pages `/comunidad` (Top 100 mes en curso + Mi posición + reparto + meses cerrados), `/comunidad/mes/[mes]`, `/admin/leaderboard` (forzar cierre), `/admin/premios-mensuales` (CRUD estado + datosPago + notas + copiar template respuesta). Endpoints `POST /api/v1/admin/leaderboard/cerrar` (auth ADMIN o Bearer CRON_SECRET) + `GET/PATCH /api/v1/admin/premios-mensuales`. `/mis-combinadas`: stat pills nuevas (Pos. del mes · Mejor mes) + tab "Mes en curso". `finalizarTorneo` graba `puntosFinales` además de `posicionFinal`. |
| 6 — Logs + analytics in-house | ✅ | Reemplaza Sentry+PostHog. Tablas `log_errores` + `eventos_analitica` con FK opcional a `usuarios` (SET NULL). Services `logs.service.ts` (registrar, paginar, stats 24h, resumen críticos última hora) y `analytics.service.ts` (track con país via `cf-ipcountry`, IP nunca persistida, queries de visitas/registros/funnel/top eventos). Helper cliente `apps/web/lib/analytics.ts` (track, capturePageview, identify, reset) que respeta toggle "Analíticas" del cookie banner antes de hacer POST. Endpoint `POST /api/v1/analytics/track` con rate-limit 60/min por IP, responde 204. Logger Pino enganchado vía `hooks.logMethod`: error→`error`, fatal→`critical` se persisten async fire-and-forget (anti-recursión: skip si source comienza con `analytics`/`logs`). Job M cada 1h en `instrumentation.ts`: si hay críticos > 0 en última hora, manda email a ADMIN_ALERT_EMAIL (anti-spam: 1 alerta/h en memoria). Email `criticosResumen` + wrapper `notifyCriticosResumen`. Pages `/admin/dashboard` (cards visitas/registros/críticos + funnel + series diarias + top eventos, selector 1d/7d/30d) y `/admin/logs` (tabla paginada con filtros level/source/fechas, expandible con stack+metadata). Endpoints lectura `GET /api/v1/admin/{analytics/overview,logs}`. Componente `TrackOnMount` reutilizable para server-pages. Eventos cableados: `signup_started` (mount /auth/signup), `signup_completed`+`profile_completed` (POST /auth/signup ok email · POST /auth/completar-perfil ok google · events.signIn google), `email_verified` (events.signIn cualquier provider), `match_viewed` (mount /torneo/[id]), `prediccion_enviada` (POST /tickets ok), `comunidad_leaderboard_visto` (mount /comunidad). TODOs sembrados en `lib/analytics.ts` para `articulo_visto`, `casa_click_afiliado`, `cuotas_comparator_visto`, `newsletter_suscripcion`, `referido_invitacion_compartida`. |
| 7 — Comunidad (comentarios) | ⏳ | Comentarios sobre torneos/artículos + suscripción a categorías. |
| 8-10 — Afiliación MINCETUR | ⏳ | Catálogo de operadores autorizados + tracking de conversión. |
| 11-13 — Premium + Cursos | ⏳ | Paywalls (flag `PREMIUM_HABILITADO`, `CURSOS_HABILITADO`). |
| 14-16 — QA, beta, lanzamiento | ⏳ | Smoke, k6, soft-launch, lanzamiento 8 jun. |
| Editorial | ⏳ | Branding final + Modelo Articulo/Categoria + CMS interno + render público. Sin número asignado — se intercala según prioridad post-Lote 5. |

## Servicios externos vigentes

- **Cloudflare** — DNS + proxy + Email Routing (`@hablaplay.com` → Gmail).
- **Railway** — hosting (Dockerfile, 1 réplica web, Postgres, Redis, backups nativos).
- **Resend** — emails transaccionales (dominio `hablaplay.com` verificado).
- **api-football.com** — datos deportivos. Header `x-apisports-key`.
- **OpenPay (BBVA)** — pasarela de pagos (pendiente). Esqueleto neutral en `lib/services/pasarela-pagos` (2 métodos: `crearCobroUnico`, `crearSuscripcion`). Adapter real se construye en Lote 12 detrás de flags `PREMIUM_HABILITADO` / `CURSOS_HABILITADO`.
- **Cloudflare R2** — backups `pg_dump` diarios + mensual.
- **Google OAuth** — provider de NextAuth.
- **Google Search Console** — SEO ownership.
- **Uptime Robot** — monitor `/api/health`.

Eliminados en Lote 1: Sentry, PostHog, Twilio. Eliminado en Lote 4: Culqi (reemplazado por OpenPay BBVA, pendiente Lote 12).

## Feature flags

- `PREMIUM_HABILITADO=false` — capa Premium (Lote 11+).
- `CURSOS_HABILITADO=false` — capa Cursos (Lote 12+).

## Reglas duras

1. **Prod-first, no local.** No correr `pnpm dev`/`next build`/migrar BD/levantar Postgres en local. Validación pre-push: solo `pnpm tsc --noEmit` + `pnpm lint`. Validación funcional la hace Gustavo en `hablaplay.com` post-deploy.
2. **Migraciones con `--create-only`.** Generar el SQL pero no aplicar local. Aplicación pasa por `prisma migrate deploy` en el `CMD` del Dockerfile al arrancar.
   - **Backup manual pre-deploy sólo si la migración compromete integridad de Postgres**: renombres de columna, cambios de tipo, conversiones JSONB↔relacional, FKs movidas, drops de tabla con data productiva. `CREATE TABLE` / `ALTER TABLE ADD COLUMN` / `UPDATE` de backfill puro **no** requieren backup. Regla establecida en Lote 5 (May 2026), válida desde entonces.
3. **Branch por lote.** `feat/lote-N-<slug>`. Merge a `main` al cerrar — sólo con OK explícito de Gustavo (incluye OK del SQL de la migración).
4. **Commits Conventional.** `feat:`, `fix:`, `chore:`, `docs:`.
5. **Cero servicios externos nuevos** sin discutir antes. La política del pivot es minimizar dependencias externas y pagos recurrentes.
6. **TypeScript strict + Zod en entrada + Pino para logs** (no `console.log`).
7. **Cero hex hardcodeados en JSX.** Tokens Tailwind (`brand-*`, `urgent-*`, `accent-*`, `dark-*`, `pred-*`).
8. **Fechas con timezone explícito.** Helpers en `lib/utils/datetime.ts`. Default `America/Lima`.
9. **`authedFetch` para `/api/v1/*`** desde el cliente. Centraliza `credentials: 'include'`.
10. **Modales con `createPortal(document.body)`** (`components/ui/Modal.tsx`).
11. **Operaciones admin one-shot** como endpoints `POST /api/v1/admin/*` con auth ADMIN o `Bearer CRON_SECRET`. Nunca en `startCommand`/`Dockerfile`.
12. **UX alineado al mockup.** Cualquier cambio de UX (copy, layout, componente, rebrand) respeta el estilo definido en `docs/habla-mockup-completo.html`: paleta, tipografías, espaciados, componentes y tono de copy. Leer el mockup antes de tocar UI; si una decisión no está cubierta ahí, preguntar antes de inventar.

## Variables de entorno relevantes

Lista de nombres (valores en Railway vault, no acá). Detalle en `.env.example`.

```
DATABASE_URL  REDIS_URL
AUTH_SECRET  NEXTAUTH_URL  GOOGLE_CLIENT_ID  GOOGLE_CLIENT_SECRET
API_FOOTBALL_KEY  API_FOOTBALL_HOST
PREMIUM_HABILITADO  CURSOS_HABILITADO
RESEND_API_KEY
NEXT_PUBLIC_APP_URL  JWT_SECRET  NODE_ENV
CRON_SECRET  ADMIN_ALERT_EMAIL
R2_ACCOUNT_ID  R2_ACCESS_KEY_ID  R2_SECRET_ACCESS_KEY  R2_BUCKET_BACKUPS  R2_ENDPOINT
LEGAL_RAZON_SOCIAL  LEGAL_RUC  LEGAL_PARTIDA_REGISTRAL  LEGAL_DOMICILIO_FISCAL
LEGAL_DISTRITO  LEGAL_TITULAR_NOMBRE  LEGAL_TITULAR_DNI
```

## Formato de reporte post-lote

Cada lote cierra con un reporte de 6 secciones, en este orden:

1. **Resumen 1 línea** del cambio.
2. **Archivos** creados / modificados / eliminados.
3. **Migración aplicada** (o "ninguna"). SQL completo si la migración existe — Gustavo aprueba antes de aplicar.
4. **Pasos manuales para Gustavo post-deploy**, paso a paso, asumiendo cero contexto previo. Cubrir backup pre-deploy, variables Railway, suscripciones a cancelar, DNS, configs en proveedores externos, smoke en `hablaplay.com`.
5. **Pendientes** que quedaron fuera del lote.
6. **CLAUDE.md actualizado** según esta estructura.
