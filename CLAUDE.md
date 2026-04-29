# CLAUDE.md — Habla! App

> Cerebro del proyecto. Cargado en cada sesión: corto y denso. Historial detallado de cambios vive en commits y PRs.
> Última reescritura: 30 Abr 2026 (Lote 3 — demolición de tienda + canjes + verificaciones + límites).

---

## Stack

Next.js 14 (App Router) + React 18 + Tailwind 3 · PostgreSQL 16 + Prisma · Redis 7 + Socket.io · Cloudflare R2 (backups) · Resend (email) · api-football.com · Railway (Dockerfile multi-stage) · Cloudflare DNS+proxy. Monorepo pnpm 10 + Turborepo.

## Modelo actual

Pivot 28 Abr 2026: de plataforma de torneos con saldo interno y tienda → **plataforma editorial + comunidad gratuita + afiliación MINCETUR**. Sin operación de juego propio. Las inscripciones a torneos son gratuitas y los usuarios sólo compiten por ranking. Las capas Premium y Cursos van detrás de feature flags y se prenden en lotes posteriores. Deadline: lanzamiento **8 de junio de 2026**.

URL prod: `https://hablaplay.com` (alias `https://www.hablaplay.com`). El plan completo de 16 lotes vive en `plan-final-lotes.md`.

## Estado de lotes

| Lote | Estado | Qué hace |
|---|---|---|
| 0 — Base previa al pivot | ✅ | Auth NextAuth v5 (Google + magic link Resend), torneos+tickets+ranking, contabilidad partida doble, backups R2, infra Railway+Cloudflare. |
| 1 — Cleanup servicios externos | ✅ | Quita Sentry, PostHog, Twilio + verificación teléfono/DNI. Cookie banner adaptado. Eventos analytics archivados en `docs/eventos-analytics-pendientes.md` para Lote 6. |
| 2 — Demolición Lukas + wallet | ✅ | Drop completo del sistema de saldo interno: 4 columnas de balance en Usuario, columnas económicas del Torneo, tabla TransaccionLukas, enums. UI sin balance: NavBar limpio, sidebar de 3 widgets, "Predecir gratis", ranking sin premio. Tienda en mantenimiento. |
| 3 — Demolición tienda + canjes + verif + límites | ✅ | Drop tablas Premio/Canje/LimitesJuego/VerificacionTelefono/VerificacionDni + 4 enums + columnas Usuario.telefono/telefonoVerif/dniVerif + PreferenciasNotif.notifVencimientos. Borradas pages /tienda y /admin/canjes, endpoints /api/v1/{canjes,premios,admin/canjes,admin/seed/premios,usuarios/limites}, services canjes/premios/premios-seed/limites, JuegoResponsableSection. BottomNav reescrito a 5 items (Inicio · Partidos · Pronósticos · Comunidad · Perfil) con placeholders "Próximamente" en /pronosticos y /comunidad. |
| 4-5 — Editorial | ⏳ | Branding final + Modelo Articulo/Categoria + CMS interno + render público. |
| 6 — Analytics in-house | ⏳ | Reemplazo de PostHog: eventos a Postgres + dashboard interno. Input: `docs/eventos-analytics-pendientes.md`. |
| 7 — Comunidad | ⏳ | Comentarios y suscripción a categorías. |
| 8-10 — Afiliación MINCETUR | ⏳ | Catálogo de operadores autorizados + tracking de conversión. |
| 11-13 — Premium + Cursos | ⏳ | Paywalls (flag `PREMIUM_HABILITADO`, `CURSOS_HABILITADO`). |
| 14-16 — QA, beta, lanzamiento | ⏳ | Smoke, k6, soft-launch, lanzamiento 8 jun. |

## Servicios externos vigentes

- **Cloudflare** — DNS + proxy + Email Routing (`@hablaplay.com` → Gmail).
- **Railway** — hosting (Dockerfile, 1 réplica web, Postgres, Redis, backups nativos).
- **Resend** — emails transaccionales (dominio `hablaplay.com` verificado).
- **api-football.com** — datos deportivos. Header `x-apisports-key`.
- **Culqi** — pasarela de pagos (tipos en `lib/services/pasarela-pagos`, sandbox, detrás de flag `PAGOS_HABILITADOS`). Reusable en Lote 11+ para Premium/Cursos.
- **Cloudflare R2** — backups `pg_dump` diarios + mensual.
- **Google OAuth** — provider de NextAuth.
- **Google Search Console** — SEO ownership.
- **Uptime Robot** — monitor `/api/health`.

Eliminados en Lote 1: Sentry, PostHog, Twilio.

## Feature flags

- `PAGOS_HABILITADOS=false` — pasarela de pagos. OFF actualmente; se reactiva en Lote 11+.
- `PREMIUM_HABILITADO=false` — capa Premium (Lote 11+).
- `CURSOS_HABILITADO=false` — capa Cursos (Lote 12+).

## Reglas duras

1. **Prod-first, no local.** No correr `pnpm dev`/`next build`/migrar BD/levantar Postgres en local. Validación pre-push: solo `pnpm tsc --noEmit` + `pnpm lint`. Validación funcional la hace Gustavo en `hablaplay.com` post-deploy.
2. **Migraciones con `--create-only`.** Generar el SQL pero no aplicar local. Aplicación pasa por `prisma migrate deploy` en el `CMD` del Dockerfile al arrancar. Migraciones destructivas requieren backup manual a R2 antes del deploy.
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
CULQI_PUBLIC_KEY  CULQI_SECRET_KEY  CULQI_WEBHOOK_SECRET  PAGOS_HABILITADOS
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
