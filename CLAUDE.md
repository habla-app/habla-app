# CLAUDE.md — Habla! App

> Cerebro del proyecto. Cargado en cada sesión: corto y denso. Historial detallado de cambios vive en commits y PRs.
> Última reescritura: 30 Apr 2026 (Pivot a v3.1 — roadmap A-J + Premium WhatsApp Channel + admin desktop-only).

---

## Stack

Next.js 14 (App Router) + React 18 + Tailwind 3 · PostgreSQL 16 + Prisma · Redis 7 + Socket.io · Cloudflare R2 (backups) · Resend (email) · api-football.com · OpenPay BBVA (pasarela, Lote E) · WhatsApp Business API (Meta Cloud API, Lote E) · Anthropic Claude API (picks Premium + bot FAQ, Lote E) · Railway (Dockerfile multi-stage) · Cloudflare DNS+proxy. Monorepo pnpm 10 + Turborepo.

## Modelo actual

**Pivot 28 Abr 2026:** de plataforma de torneos con saldo interno y tienda → **plataforma editorial + comunidad gratuita + afiliación MINCETUR**. Sin operación de juego propio.

**Pivot 30 Abr 2026 (v3.1):** se descartan los lotes 12-16 originales (Premium con feature flag, Cursos, etc.) y se reemplazan por el **roadmap A-J** documentado en `Habla_Plan_de_Negocios_v3.1.md`. El nuevo Premium ya no es paywall genérico — es **suscripción con entrega vía WhatsApp Channel privado** ("Habla! Picks") + bot FAQ 1:1. Deadline: lanzamiento **8 de mayo de 2026**.

### Tres productos del modelo v3.1 (jerarquía explícita)

- **Producto B** — Cobertura dinámica de partidos. Cara visible #1.
- **Producto C** — Liga Habla! comunitaria gratuita con S/1,250 mensuales en premios. Cara visible #2.
- **Producto A** — Biblioteca soporte (guías, reseñas, glosario). Auxiliar invisible.
- **Premium** — 4to producto. WhatsApp Channel privado broadcast (NO grupo) + Business API bot. Slogan: *"Habla! Todas las fijas en una"*.

URL prod: `https://hablaplay.com` (alias `https://www.hablaplay.com`).

## Estado de lotes — Histórico (Lotes 0-11) + Roadmap nuevo (A-J)

### Lotes 0-11 — Reciclables ✅

Toda la infraestructura previa al pivot v3.1 sigue válida. Lo construido en estos lotes es la base sobre la que se ejecuta el roadmap A-J.

| Lote | Estado | Qué hace |
|---|---|---|
| 0 — Base previa al pivot | ✅ | Auth NextAuth v5 (Google + magic link Resend), torneos+tickets+ranking, backups R2 a Cloudflare, infra Railway+Cloudflare. |
| 1 — Cleanup servicios externos | ✅ | Quita Sentry, PostHog, Twilio + verificación teléfono/DNI. Cookie banner adaptado. Eventos canónicos cableados en Lote 6. |
| 2 — Demolición Lukas + wallet | ✅ | Drop completo del sistema de saldo interno + tienda en mantenimiento. |
| 3 — Demolición tienda + canjes + verif + límites | ✅ | Drop tablas Premio/Canje/LimitesJuego/VerificacionTelefono/VerificacionDni + 4 enums. BottomNav reescrito a 5 items. |
| 4 — Demolición contabilidad + eliminación total de Culqi | ✅ | Drop 8 tablas contables + Culqi. Pasarela queda como esqueleto neutral (`types.ts` con 2 métodos + `mock-pasarela.ts`). |
| 5 — Leaderboard mensual + premios en efectivo | ✅ | Tablas `leaderboards` + `premios_mensuales`. Service `leaderboard.service.ts` con cierre idempotente y tabla S/1,250 (1°S/500 · 2°S/200 · 3°S/200 · 4°-10°S/50 c/u). Job J cierra mes anterior. |
| 6 — Logs + analytics in-house | ✅ | Reemplaza Sentry+PostHog. Tablas `log_errores` + `eventos_analitica`. Pages `/admin/dashboard`, `/admin/logs`. Job M alertas críticos. |
| 7 — Afiliación MINCETUR (schema + tracker + admin) | ✅ | Tablas `afiliados` + `clicks_afiliados` + `conversiones_afiliados`. Endpoint `/go/[casa]`. Componentes MDX `<CasaCTA>`, `<CasaReviewCard>`, `<TablaCasas>`, `<DisclaimerLudopatia>`. |
| 8 — Editorial + provider MDX | ✅ | Pipeline editorial completo basado en `.mdx`. Pages `/blog`, `/casas`, `/guias`, `/pronosticos`, `/partidos/[slug]`. JSON-LD por tipo. |
| 9 — Comparador de cuotas + odds cache | ✅ | `<CuotasComparator>` con cache Redis 30min. `LIGAS_TOP_PARA_ODDS` + `BOOKMAKER_MAPPING`. Job N cron 30min. |
| 10 — Verificación MINCETUR weekly + newsletter automation | ✅ | Cron K verifica casas vs registro MINCETUR. Newsletter doble opt-in con digest semanal. `<NewsletterCTA>` embedded. |
| 11 — Home rediseñada + nav adjustments + UX editorial | ✅ | Home hub editorial 6 secciones. NavBar 5 links. `/comunidad/[username]` con perfil público. Stats 6 columnas en `/perfil`. |

### Lotes 12-16 originales — DEPRECADOS ❌

Los lotes 12 (Premium con paywall), 13 (Cursos), 14-16 (QA, beta, lanzamiento) **se descartan** y se reemplazan por el roadmap A-J.

### Roadmap nuevo A-J — Pendiente ⏳

| Lote | Pista | Carpeta specs | Qué hace |
|---|---|---|---|
| **A** — Design system v3.1 + tokens nuevos | Ambas | `00-design-system/` | Tokens Premium, WhatsApp, admin. `<MobileHeader>`, `<BottomNav>`, `<CrossProductBanner>`. |
| **B** — Reauditoría móvil capa pública | Usuario | `02-pista-usuario-publica/` | Refactor mobile-first de home, partidos, blog, casas, guías, pronósticos, auth, suscribir. Sticky CTAs, BottomNav consistente. |
| **C** — Reauditoría móvil capa autenticada | Usuario | `03-pista-usuario-autenticada/` | Refactor mobile-first de comunidad, perfil, mis-predicciones, live-match, perfil público. URLs renombradas. |
| **D** — Premium WhatsApp UI usuario | Usuario | `04-pista-usuario-premium/` | Vistas `/premium`, `/premium/checkout`, `/premium/exito`, `/premium/mi-suscripcion`. Componente reusable `<PickWrapper>`. |
| **E** — Premium backend automatización | Backend | `04-pista-usuario-premium/` | Modelos `Suscripcion`/`PagoSuscripcion`/`PickPremium`/`MiembroChannel`. OpenPay adapter. WhatsApp Business client. Bot FAQ con Claude API. Cron sync membresía. |
| **F** — Admin desktop operación | Admin | `05-pista-admin-operacion/` | Sidebar lateral fijo 240px reemplaza topbar. Dashboard con 5 categorías KPI. `/admin/picks-premium` con atajos teclado. Channel WhatsApp, suscripciones, refactors Lotes 5/7/10. |
| **G** — Admin desktop KPIs análisis | Admin | `06-pista-admin-analisis/` | KPIs detallado, cohortes, mobile-vitals, finanzas, alarmas, sistema (logs+auditoría+usuarios). |
| **H** — Microcopy + emails + WhatsApp templates | Usuario | `07-microcopy-emails-whatsapp/` | Catálogo microcopy i18n-ready, 11 emails React Email, 7 templates WhatsApp Business para aprobación Meta, sistema toast/banner basado en sonner. |
| **I** — Mobile-first audit + PWA | Usuario | dentro de `00-design-system/` | Auditoría final mobile + manifest.json + service worker básico. |
| **J** — QA + soft launch + lanzamiento 8 mayo | Ambas | (no requiere specs) | Smoke, k6, soft-launch con 5-10 testers, lanzamiento. |

**Ruta crítica:** A → B → C → D → E → J. F/G/H/I pueden paralelo después de D.

**Decisión clave:** ejecutar Lote E (backend Premium) antes que Lote D (frontend Premium) si Meta Business y OpenPay BBVA tardan en aprobar. Esto evita que D quede con muchos fallbacks visibles.

## docs/ux-spec/ — Fuente de verdad UX

Esta carpeta es lo que Claude Code lee al ejecutar cada lote del roadmap A-J. **Antes de empezar cualquier lote, leer:**

1. El `README.md` raíz de `docs/ux-spec/`.
2. El `README.md` de la carpeta del lote correspondiente.
3. Cada `.spec.md` de vista en orden recomendado.

```
docs/ux-spec/
├── README.md
├── 00-design-system/                    ← Lote A
│   ├── tokens.md, tipografia.md, componentes-{base,mobile,admin}.md
│   └── mockup-actualizado.html
├── 01-arquitectura/                     ← contextual (todos los lotes)
│   ├── inventario-vistas.md, mapa-rutas.md, flujos-navegacion.md
│   └── auditoria-repo-actual.md
├── 02-pista-usuario-publica/            ← Lote B (14 archivos)
├── 03-pista-usuario-autenticada/        ← Lote C (11 archivos)
├── 04-pista-usuario-premium/            ← Lotes D + E (16 archivos)
├── 05-pista-admin-operacion/            ← Lote F (11 archivos + 2 mockups)
├── 06-pista-admin-analisis/             ← Lote G (7 archivos)
└── 07-microcopy-emails-whatsapp/        ← Lote H (7 archivos)
```

Cada `.spec.md` sigue 8 secciones canónicas: Lote responsable / Estado actual repo / Cambios necesarios / Datos / Estados UI / Componentes que reutiliza / Reglas / Mockup referencia.

`Habla_Plan_de_Negocios_v3.1.md` (raíz del repo) es la fuente de verdad estratégica detrás de todas las specs.

## Servicios externos vigentes

- **Cloudflare** — DNS + proxy + Email Routing (`@hablaplay.com` → Gmail).
- **Railway** — hosting (Dockerfile, 1 réplica web, Postgres, Redis, backups nativos).
- **Resend** — emails transaccionales (dominio `hablaplay.com` verificado).
- **api-football.com** — datos deportivos. Header `x-apisports-key`.
- **OpenPay (BBVA)** — pasarela de pagos. **Lote E.** Adapter real reemplaza el esqueleto neutral del Lote 4.
- **WhatsApp Business API (Meta Cloud)** — bot FAQ 1:1 + envío de picks Premium 1:1. **Lote E.** Channel privado se gestiona manualmente desde la app (Meta no expone API de Channels al momento de este spec).
- **Anthropic Claude API** — generación de picks Premium con razonamiento estadístico + bot FAQ conversacional. **Lote E.** Modelo default `claude-opus-4-7`.
- **Cloudflare R2** — backups `pg_dump` diarios + mensual.
- **Google OAuth** — provider de NextAuth.
- **Google Search Console** — SEO ownership.
- **Google PageSpeed Insights API** — Lighthouse semanal contra rutas críticas. **Lote G.**
- **Uptime Robot** — monitor `/api/health`.
- **Registro MINCETUR** — `https://apuestasdeportivas.mincetur.gob.pe/`. Sólo lectura: cron K (Lote 10) scrapea HTML cada lunes ≥06:00 PET.

Eliminados en Lote 1: Sentry, PostHog, Twilio. Eliminado en Lote 4: Culqi.

## Feature flags

Los flags `PREMIUM_HABILITADO` y `CURSOS_HABILITADO` del modelo previo **se eliminan**. Premium ahora es producto productivo desde Lote D/E. Cursos no existe en v3.1.

Si alguna vista usa estos flags todavía: refactor en Lote D para eliminarlos.

## Reglas duras

1. **Prod-first, no local.** No correr `pnpm dev`/`next build`/migrar BD/levantar Postgres en local. Validación pre-push: solo `pnpm tsc --noEmit` + `pnpm lint`. Validación funcional la hace Gustavo en `hablaplay.com` post-deploy.
2. **Migraciones con `--create-only`.** Generar el SQL pero no aplicar local. Aplicación pasa por `prisma migrate deploy` en el `CMD` del Dockerfile al arrancar.
   - **Backup manual pre-deploy sólo si la migración compromete integridad de Postgres**: renombres de columna, cambios de tipo, conversiones JSONB↔relacional, FKs movidas, drops de tabla con data productiva. `CREATE TABLE` / `ALTER TABLE ADD COLUMN` / `UPDATE` de backfill puro **no** requieren backup.
3. **Branch por lote.** `feat/lote-<letra>-<slug>` (ej: `feat/lote-d-premium-frontend`). Migraciones y merges a `main` los aplica Claude Code directamente al cerrar el lote, sin gate de OK escrito de Gustavo. **Cierre incluye `git push origin main`** — Railway deploya desde `origin/main`, no desde local; merge sin push = deploy invisible.
4. **Commits Conventional.** `feat:`, `fix:`, `chore:`, `docs:`.
5. **Cero servicios externos nuevos** sin discutir antes. Las nuevas dependencias del v3.1 (OpenPay, WhatsApp Business, Anthropic, PageSpeed Insights) están aprobadas en el plan v3.1 y son las únicas. Cualquier otra requiere discusión previa.
6. **TypeScript strict + Zod en entrada + Pino para logs** (no `console.log`).
7. **Cero hex hardcodeados en JSX.** Tokens Tailwind del Lote A (`brand-*`, `gold-*`, `premium-*`, `whatsapp-*`, `admin-*`).
8. **Fechas con timezone explícito.** Helpers en `lib/utils/datetime.ts`. Default `America/Lima`.
9. **`authedFetch` para `/api/v1/*`** desde el cliente. Centraliza `credentials: 'include'`.
10. **Modales con `createPortal(document.body)`** (`components/ui/Modal.tsx`).
11. **Operaciones admin one-shot** como endpoints `POST /api/v1/admin/*` con auth ADMIN o `Bearer CRON_SECRET`. Nunca en `startCommand`/`Dockerfile`.
12. **UX alineado a `docs/ux-spec/`.** Cualquier cambio de UX (copy, layout, componente, rebrand) respeta lo definido en las specs del lote correspondiente. **Si una decisión no está cubierta en la spec del lote, leer también el `00-design-system/` y los lotes adyacentes antes de inventar.** El mockup `docs/habla-mockup-completo.html` es legacy del modelo previo — el mockup vigente es `docs/ux-spec/00-design-system/mockup-actualizado.html`.
13. **Mobile-first riguroso para pista usuario.** Lighthouse Mobile >90, LCP <2.5s, INP <200ms, CLS <0.1. **Desktop-only para pista admin** (1280px+, mobile bloqueado con `<MobileGuard>`). Esta separación es decisión arquitectónica del v3.1.

### Reglas adicionales del v3.1

14. **Cero datos de tarjeta tocan el servidor de Habla!.** Tokenización con OpenPay.js client-side. Backend recibe solo el token.
15. **Verificación de firma obligatoria** en TODO webhook. Sin firma válida → 401. OpenPay HMAC-SHA256, WhatsApp X-Hub-Signature-256.
16. **Idempotencia obligatoria** en webhooks (pueden reintentar mismo evento). Verificar estado actual antes de procesar.
17. **Retry con backoff exponencial** para envíos críticos (emails, WhatsApp). 3 intentos: 1s, 2s, 4s. Después → log critical.
18. **Cero auto-publicación de picks Premium.** Cada pick generado por Claude API DEBE pasar por aprobación humana del editor antes de salir al Channel.
19. **Watermark con email del usuario** en cada pick que llega al bot 1:1 (dificulta forwarding masivo).
20. **Atajos de teclado** en vistas operativas admin (validar picks: A/R/E/↑↓/Esc). Inputs activos suprimen los atajos.
21. **Auditoría 100%** en acciones admin destructivas (helper `logAuditoria()` invocado desde cada server action). Logs pueden samplearse, auditoría nunca.
22. **Tono según `tono-de-voz.spec.md`** del Lote H. Persona "tú" (no "usted"), informal-friendly, español neutro Perú. Cero promesas legales.
23. **Apuesta responsable** mencionada en cualquier comunicación que invite a apostar. Línea Tugar 0800-19009.

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

# Nuevas v3.1 — OpenPay BBVA (Lote E)
OPENPAY_MERCHANT_ID  OPENPAY_PRIVATE_KEY  OPENPAY_PUBLIC_KEY
OPENPAY_PRODUCTION  OPENPAY_WEBHOOK_SECRET

# Nuevas v3.1 — WhatsApp Business API (Lote E)
META_BUSINESS_ID  WHATSAPP_PHONE_NUMBER_ID  WHATSAPP_ACCESS_TOKEN
WHATSAPP_VERIFY_TOKEN  WHATSAPP_APP_SECRET
WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK
WHATSAPP_BUSINESS_PHONE_NUMBER

# Nuevas v3.1 — Anthropic API (Lote E)
ANTHROPIC_API_KEY  ANTHROPIC_MODEL

# Nuevas v3.1 — PageSpeed Insights (Lote G, opcional)
PAGESPEED_API_KEY

# Nuevas v3.1 — Resend webhook (Lote F newsletter, opcional)
RESEND_WEBHOOK_SECRET
```

**Tasks paralelas externas que requieren lead time:**

- OpenPay BBVA: cuenta + verificación KYC (1-3 días hábiles) + crear 3 planes (mensual/trimestral/anual) en dashboard.
- Meta Business Account + WhatsApp Business API: verificación de negocio (2-7 días) + número dedicado verificado + System User Token.
- Anthropic Console: cuenta + método de pago + límite gasto $50/mes.
- WhatsApp Channel privado: crear manualmente desde la app + subir 3-5 picks históricos.
- WhatsApp templates: submit 7 templates a Meta para aprobación (1-3 días por cada una).
- Resend: verificar dominio `hablaplay.com` con DNS records (SPF, DKIM, DMARC).

Ejecutar estas tasks en paralelo a los lotes para no bloquear el lanzamiento del 8 mayo.

## Formato de reporte post-lote

Cada lote del roadmap A-J cierra con un reporte de 6 secciones, en este orden:

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
- **Pasos manuales para Gustavo explícitos y atómicos** asumiendo cero conocimiento técnico (especialmente para OpenPay BBVA, Meta Business Manager, Anthropic Console, rotación del Channel cada 6 meses).
