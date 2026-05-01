# CLAUDE.md — Habla! App

> Cerebro del proyecto. Cargado en cada sesión: corto y denso. Historial detallado de cambios vive en commits y PRs.
> Última reescritura: 30 Apr 2026 (Pivot a v3.1 — roadmap A-J + Premium WhatsApp Channel + admin desktop-only).
> Última actualización: 1 May 2026 — Lote G cerrado (Admin desktop análisis profundo: vistas `/admin/kpis` (selector grid + drill-down `?metric=<id>` con line chart histórico SVG nativo + breakdown por dimensión + acciones sugeridas según status), `/admin/cohortes` (heatmap CSS grid 12 meses × 7 buckets D0/1/7/14/30/60/90 con 4 métricas seleccionables `prediccion`/`ftd`/`premium`/`activo` + 3 cards resumen + segmentos por source), `/admin/mobile-vitals` (4 cards P75 LCP/INP/CLS/Lighthouse + 3 mini line charts + tabla rutas peor performance + histórico Lighthouse 50 + botón corrida manual), `/admin/finanzas` (4 cards Revenue/MRR/Margen/LTV-CAC + bar chart stacked Premium vs Afiliación 12m + tablas editables costos/comisiones + cards CAC/LTV + selector mes), `/admin/alarmas` (3 secciones activas/config-thresholds/histórico + modal crear-manual + modal desactivar con motivo + form upsert config), `/admin/auditoria` (NUEVA, listing paginado 50/page con filtros entidad+actor+rango y modal expandible con metadata JSON), refactor `/admin/logs` (4 stats cards + tokens admin), `/admin/usuarios` (listing densa con search/rol/estado + 4 stats + paginación) y `/admin/usuarios/[id]` (detalle completo + acciones admin con confirmación BANEAR/ELIMINAR + auditoría como actor). Modelos nuevos: `MetricaVital`+`LighthouseRun`+`CostoOperativo`+`ComisionAfiliacion`+`Alarma`+`AlarmaConfiguracion` + 2 enums `TipoAlarma`/`SeveridadAlarma` (migración aditiva `20260522000000_lote_g_admin_analisis`). Servicios nuevos: `kpis-metadata.ts` (catálogo único 20 KPIs con causas/acciones curadas), `kpi-detalle.service.ts` (drill-down con cache 5min), `cohortes.service.ts` (queries SQL agregadas con cache 30min), `vitals.service.ts` (insert + agregadas P75 + charts + PageSpeed Insights API), `finanzas.service.ts` (revenue + MRR + costos + comisiones + CAC/LTV + proyección con cache 30min), `alarmas.service.ts` (CRUD + cron evaluador con idempotencia + auto-desactivación + email a CRITICAL). Componente cliente nuevo `<WebVitalsCollector>` cableado en `app/layout.tsx` con sample 10% (Math.random<0.1) y captura nativa via `PerformanceObserver` (zero deps `web-vitals`). Endpoint público `POST /api/v1/vitals` rate-limit 100/min/IP. 14 endpoints admin nuevos: `/api/v1/admin/{vitals/lighthouse,finanzas/{costos,comisiones},alarmas/{manual,[id]/desactivar,config},usuarios/[id]/{ban,soft-delete,cambiar-rol}}` + `/api/v1/crons/{evaluar-alarmas,lighthouse-weekly}`. 2 jobs nuevos in-process en `instrumentation.ts`: R (evaluar alarmas 1h, primer tick 260s tras boot), S (Lighthouse semanal 1h, lunes ≥06:00 PET, primer tick 280s). Sidebar actualizado con sección ANÁLISIS expandida + counter rojo de alarmas activas. Service `admin-kpis.service.ts.obtenerAlarmasActivas` ahora lee del modelo `Alarma` real (no stub). Variable nueva `PAGESPEED_API_KEY` opcional — si vacía, cron Lighthouse skip silencioso pero CWV reales del cliente igual se capturan. Reglas v3.1 cubiertas: cache pesada (TTL 5min KPIs, 30min cohortes/finanzas), sample 10% client-side vitals, auditoría 100% retention en acciones destructivas (ban/soft-delete/cambiar-rol/costos/comisiones/desactivar-alarma/config-threshold/lighthouse-manual), email solo en alarmas CRITICAL (anti-spam), motivo obligatorio + confirmación BANEAR/ELIMINAR para destructivas. Eventos analíticos nuevos: `admin_kpi_drill_down_visto`, `admin_kpi_rango_cambiado`, `admin_cohortes_visto`, `admin_cohorte_drill_down`, `admin_vitals_visto`, `admin_lighthouse_manual_disparado`, `admin_finanzas_visto`, `admin_costo_registrado`, `admin_comision_afiliacion_registrada`, `admin_alarma_visto`, `admin_alarma_desactivada`, `admin_alarma_manual_creada`, `admin_logs_visto`, `admin_auditoria_visto`, `admin_usuario_baneado`, `admin_usuario_rol_cambiado`, `admin_usuario_soft_deleted`).
> Última actualización previa: 30 Apr 2026 — Lote F cerrado (Admin desktop operación: layout admin desktop-only 1280px+ con `<AdminLayoutShell>` + sidebar lateral 240px + topbar simplificado + `<MobileGuard>` para mobile. `<AdminTopNav>` y `<AdminPageHeader>` legacy ELIMINADOS. Vistas reescritas: `/admin` redirect → dashboard, `/admin/dashboard` con 5 KPI sections + sistema semáforo + alarmas + selector de rango (servicio `admin-kpis.service.ts`), métricas Lote 6 movidas a `/admin/metricas`. **`/admin/picks-premium`** ⭐ vista crítica: 2 paneles cola+detalle + atajos teclado A/R/E/↑↓/Esc + modales rechazo/edición + preview WhatsApp real con `formatearPickPremium`. `/admin/channel-whatsapp` con stats membresía + gráfica engagement + alertas leak + botón forzar sync. `/admin/suscripciones` listing paginado + filtros + 4 stats; `/admin/suscripciones/[id]` detalle + cancelación inmediata override + reembolso fuera de garantía con confirmación adicional. Refactors visuales `/admin/{afiliados,conversiones,newsletter,leaderboard,logs,premios-mensuales,torneos,usuarios}` a `<AdminTopbar>` + breadcrumbs. Modelo `AuditoriaAdmin` (migración `20260521000000_lote_f_auditoria`) + helper `logAuditoria()` invocado desde toda acción admin destructiva (regla 21). Servicios nuevos: `auditoria.service.ts`, `admin-kpis.service.ts`, `channel-whatsapp.service.ts`, `picks-premium-admin.service.ts`. Suscripciones service extendido (listar/detalle/stats/cancelar inmediato/reembolsar manual). Endpoints nuevos: `POST /api/v1/admin/channel-whatsapp/forzar-sync`, `POST /api/v1/admin/suscripciones/[id]/cancelar`, `POST /api/v1/admin/suscripciones/[id]/reembolsar`, `POST /api/v1/admin/newsletter/test`. Eventos: `admin_suscripcion_cancelada_manual`, `admin_reembolso_procesado`, `admin_sync_membresia_forzado`).
> Última actualización previa: 30 Apr 2026 — Lote D cerrado (Premium WhatsApp UI usuario completo: vistas `/premium` (landing crítica) + `/premium/checkout` (form OpenPay con tokenización client-side) + `/premium/exito` (BigCTA WhatsApp + modo verificando con polling) + `/premium/mi-suscripcion` (estado + accesos + cambiar plan + historial pagos + cancelar/reactivar con modal honesto). Componente reusable `<PickWrapper>` que decide `<PickDesbloqueado>` (Premium) vs `<PickBloqueadoTeaser>` (free/anonimo/ftd) embebido en home, partido y comunidad/torneo. `<WhatsAppChannelMockup>`, `<PlanesPremium>` (con selección que actualiza sticky CTA), `<SocialProofPremium>`, `<InclusionesPremium>`, `<GarantiaCard>`, `<TestimoniosPremium>`, `<FAQPremium>`. Endpoint `GET /api/v1/suscripciones/me` para polling post-pago. Server actions `procesarCheckout` (sólo recibe token; nunca PAN/CVV), `cancelarMiSuscripcion`, `reactivarMiSuscripcion`. Refactor de `PremiumTeaserHome` y `PickBloqueadoSeccion` como fachadas finas que delegan en `<PickWrapper>`. Servicio `picks-premium-publicos.service.ts` lee `prisma.pickPremium` aprobados y los adapta al shape `PickWrapperData`. BottomNav suprimido en `/premium/exito`. OpenPay.js cargado dinámicamente desde CDN; deviceSessionId anti-fraude capturado client-side. Si OpenPay env vars no existen, sticky CTA cae a "⚡ Próximamente · Avísame" linkeando al newsletter. Eventos analíticos: `premium_landing_visto`, `premium_plan_seleccionado`, `premium_checkout_iniciado/completado_cliente/fallido`, `premium_post_pago_visto`, `premium_mi_suscripcion_visto`, `premium_cancelado`, `premium_reactivado`, `whatsapp_channel_link_clickeado`, `pick_premium_blocked_visto/clickeado`).
> Última actualización previa: 30 Apr 2026 — Lote E cerrado (Premium backend completo: modelos `Suscripcion`/`PagoSuscripcion`/`MiembroChannel`/`PickPremium`/`ConversacionBot`/`MensajeBot` + 9 enums + `Usuario.telefono` + 2 toggles en `PreferenciasNotif`. OpenPay BBVA adapter con HMAC-SHA256 webhook. WhatsApp Business Cloud API v22 client + bot FAQ 1:1 con Claude API + base-conocimiento + detección de ludopatía. Picks generador con Claude API (max 3 partidos/corrida, EV+ ≥5%, aprobación humana obligatoria) + evaluador post-partido. Sync-membresia cron (vencimientos / cancelaciones efectivas / pagos fallidos / reinvites / expirar garantía). Endpoints: `/api/v1/openpay/webhook`, `/api/v1/whatsapp/webhook` (GET handshake + POST con verify firma), `/api/v1/admin/picks-premium/[id]/{aprobar,rechazar,PATCH}`, `/api/v1/crons/{generar-picks-premium,evaluar-picks-finalizados,sync-membresia-channel}`. 3 jobs nuevos in-process: O (gen picks 4h), P (eval 1h), Q (sync 1h). Cero auto-publicación de picks. Cero datos de tarjeta en BD. Idempotencia obligatoria. Retry 1s/2s/4s. Watermark email en cada pick).

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
| **A** — Design system v3.1 + tokens nuevos ✅ | Ambas | `00-design-system/` | Tokens nuevos en `tailwind.config.ts` + `globals.css`: alert warning/danger, premium (surface/border/watermark + 3 gradients + 3 shadows), admin sidebar/content/status, whatsapp, vital, zIndex jerárquico (base→tooltip 0-90). Tipografías `text-display-*`/`text-body-*`/`text-label-*`/`text-num-*` (mobile) + `text-admin-*`/`text-kpi-value-*` (admin) en `@layer utilities`. Utilities `scrollbar-hide`/`touch-target`/`bg-whatsapp-chat`/`premium-watermark`. Helper `lib/utils/cn.ts`. Átomos compartidos nuevos en `components/ui/`: `<Card>` (7 variants), `<Badge>` (10 variants × 3 sizes), `<Spinner>`, `<Skeleton>` (text/lines/circle/rect), `<Avatar>` (5 sizes + initials fallback), `<Divider>` (solid/dashed/decorative), `<IconButton>`, `<Input>` (3 sizes × 3 states + slots). Scaffolds en `components/ui/mobile/` (`<MobileHeader>`, `<StickyCTABar>`, `<CrossProductBanner>` nuevos + re-exports `<BottomNav>`/`<HorizontalScrollChips>`) y `components/ui/admin/` (`<MobileGuard>`, `<AdminSidebar>`, `<AdminTopbar>`, `<AdminCard>`, `<AdminTable>` preview funcional). Carpeta `components/ui/premium/` con README, componentes vienen en Lote D. Cero migraciones. Cero refactor de vistas (eso es Lote B+). |
| **B** — Reauditoría móvil capa pública ✅ | Usuario | `02-pista-usuario-publica/` | Layout `(public)` + `(main)` unificado en shell mobile-first compartido (`<PublicHeaderV31>` con MobileHeader + desktop top-bar / `<BottomNav>` v3.1 5 ítems Inicio·Partidos·Liga·Premium·Perfil). `(main)/page.tsx` y `/matches` eliminados; home única en `(public)/page.tsx` con personalización por estado de usuario (`detectarEstadoUsuario`). `/partidos/[slug]` reescrito con `<PartidoHero>`, `<CuotasGridMobile>`, `<PickBloqueadoSeccion>` (pick Premium bloqueado/desbloqueado fallback null hasta Lote E), `<LigaWidgetInline>` cross-link a Producto C, `<SoporteFooter>`. `/cuotas` mobile-first usando `<CuotasGridMobile>` por partido. Refactor visual mobile-first de `/casas` (filtros bottom-sheet + buscador), `/casas/[slug]`, `/blog`, `/blog/[slug]`, `/guias`, `/guias/[slug]`, `/pronosticos`, `/pronosticos/[liga]`. Auth (`/auth/*`) con copy v3.1 + SocialProof en signup ("X tipsters compitiendo"). `/suscribir`, `/ayuda/faq`, `/legal/[slug]` alineados al shell público. Footer expandido a 5 columnas con sección Premium. Redirects 301 `/matches` → `/cuotas` en `next.config.js`. Robots/sitemap actualizados (premium incluido, matches removido). Servicio nuevo `lib/services/estado-usuario.service.ts` (devuelve `'free'` para autenticados hasta que Lote D/E agregue suscripción/FTD). Cero migraciones. |
| **C** — Reauditoría móvil capa autenticada ✅ | Usuario | `03-pista-usuario-autenticada/` | Nueva URL `/comunidad/torneo/[slug]` con `<TorneoHero>` (gradient navy + countdown + cross-link C→B), `<PrediccionForm>` (5 mercados resultado/BTTS/+2.5/roja/marcador con `<MarketRow>` reusable), `<PremiumInline>` (banner promo si no Premium), `<AffiliateInline>` (sincroniza cuota mejor casa con predicción 1X2), `<LeaderboardTorneoPreview>` (Top 5 + posición viewer + línea de premio). `/perfil` refactor mobile-first vertical con `<NivelProgressBar>` extraído, `<PremiumStatusCard>` (3 estados: no suscriptor/activo/cancelando), `<QuickAccessGrid>` con `<ReferidoModal>` (link copy + share WhatsApp/Twitter intents), `<MisCasasConectadas>` (placeholder array vacío hasta Lote D/E). `/mis-combinadas` → `/mis-predicciones` (rename) con `<StatsHero>` + `<EvolucionChart>` SVG nativo (zero Recharts) + `<FiltrosTabs>` 5 tabs + `<PrediccionListItem>` linkea a `/comunidad/torneo/[partidoId]`. `/comunidad` mobile-first con `<MisStatsMini>` (3 stats viewer) + `<PremiosMensualesCard>` (10 premios) + `<MesesCerradosLink>` (últimos 6) + `<LeaderboardMensualTable>` reescrita (cards stacked en mobile vs tabla densa Lote 5). `/live-match` extiende `<LiveMatchView>` con slots `slotPremium` + `partidoSlugCrossLink`; `<AlertasPremium>` muestra alertas/teaser según suscripción. `/comunidad/[username]` mobile-first con `<PerfilPublicoHero>` + badge Premium + botón "+Seguir" placeholder (modelo `Seguidor` posterga al post-launch). `/comunidad/mes/[mes]` mobile-first con hero histórico tono sobrio. Redirects 301: `/torneo/:id` resuelto en `app/(main)/torneo/[id]/page.tsx` con `partidoIdDeTorneoLegacy` + `permanentRedirect`; `/mis-combinadas` y `/torneos` en `next.config.js`. Eliminados `(main)/torneos/page.tsx`, `(main)/mis-combinadas/page.tsx`, `components/torneos/{InscritosList,TorneoStickyCTA,BackButton}.tsx`. URLs activas en `combo-modal-status`, `MatchGroup`, `MisTicketsTabs`, `UserMenu`, `BottomNav`, `robots.ts`, `sitemap.ts` apuntan a `/mis-predicciones`. Servicios nuevos: `suscripciones.service.ts` (placeholder Lote E), `obtenerEvolucionMensual` (en `leaderboard.service.ts`), `obtenerCasasConectadas` (en `usuarios.service.ts`), `obtenerPorSlug`/`partidoIdDeTorneoLegacy` (en `torneos.service.ts`). `<CrossProductBanner>` extendido con prop `tone="dark"` para hero del torneo. **Decisiones diferidas:** modelo `Seguidor` y toggles `notifPremiumPicks`/`notifPremiumAlerts` se posponen al post-launch para minimizar superficie del lote. Cero migraciones. |
| **D** — Premium WhatsApp UI usuario ✅ | Usuario | `04-pista-usuario-premium/` | Vistas `/premium` (landing con hero + WhatsAppChannelMockup + SocialProofPremium + InclusionesPremium + PlanesPremium + GarantiaCard + Testimonios + FAQ + StickyPremiumCTA), `/premium/checkout` (CheckoutHero + PlanResumen + OpenPayForm con tokenización client-side via OpenPay.js + SeguridadCheckout), `/premium/exito` (PostPagoHero verde + UnirseChannelBigCTA + InstruccionesPostPago + EmailConfirmacionInfo + SiguientesPasosPremium; BottomNav suprimido vía pathname check; modo verificando con polling 3s timeout 60s a `/api/v1/suscripciones/me`), `/premium/mi-suscripcion` (SuscripcionEstadoCard 3 estados + AccesosRapidosPremium + CambiarPlanSection + HistorialPagos + CancelarSuscripcionSection con modal honesto). Componente reusable `<PickWrapper>` (decide `<PickDesbloqueado>`/`<PickBloqueadoTeaser>` por estado) + `<PickBloqueadoTeaser>` con IntersectionObserver tracking + `<PickDesbloqueado>` con watermark email. Refactor `PremiumTeaserHome` (home) y `PickBloqueadoSeccion` (partido) a fachadas que delegan en `<PickWrapper>`. Cableado en `(public)/page.tsx`, `(public)/partidos/[slug]/page.tsx`, `(main)/comunidad/torneo/[slug]/page.tsx`. Server actions `procesarCheckout` (recibe token, NUNCA PAN/CVV), `cancelarMiSuscripcion`, `reactivarMiSuscripcion`. Endpoint `GET /api/v1/suscripciones/me`. Servicio `picks-premium-publicos.service.ts` lee picks aprobados y los adapta al shape `PickWrapperData`. Helpers `lib/premium-planes.ts` (PLANES + planKeyDesdeEnum) + `formatearFechaLargaPe` en datetime. Tokenización OpenPay.js cargado dinámicamente desde CDN; deviceSessionId anti-fraude. Si OpenPay env vars no existen, sticky CTA cae a "Próximamente · Avísame" linkeando a `/suscribir`. Cero migraciones. |
| **E** — Premium backend automatización ✅ | Backend | `04-pista-usuario-premium/` | Modelos `Suscripcion`/`PagoSuscripcion`/`MiembroChannel`/`PickPremium`/`ConversacionBot`/`MensajeBot` + 9 enums + `Usuario.telefono` + `PreferenciasNotif.notifPremiumPicks`/`notifPremiumAlertasVivo`. Migración aditiva pura (`20260520000000_lote_e_premium`). Services: `suscripciones.service.ts` (crear/activar/cancelar/reembolsar + helpers cron), `pasarela-pagos/openpay-adapter.ts` (REST API con `fetch`, no SDK; HMAC-SHA256 webhook + Basic Auth), `whatsapp/wa-business-client.ts` (Cloud API v22 con verify firma X-Hub-Signature-256), `whatsapp/pick-formato.ts` (markdown WhatsApp + UTM links + watermark + 1024 char limit), `whatsapp/picks-distribuidor.service.ts` (envío 1:1 con retry 1s/2s/4s + log critical si >10% falla), `whatsapp/bot-faq.service.ts` (Claude API + base-conocimiento + rate limit 10/h + detección ludopatía + derivación a humano), `whatsapp/bot-knowledge-base.ts` + `whatsapp/bot-prompts.ts`, `picks-premium-generador.service.ts` (Claude API max 3 partidos/corrida, EV+ ≥5%, JSON estricto), `picks-premium-prompts.ts` (system + user prompt + parser), `picks-premium-evaluador.service.ts` (calcula GANADO/PERDIDO/NULO/PUSH desde campos del Partido), `sync-membresia.service.ts` (vencimientos + cancelaciones efectivas + pagos fallidos + reinvites + expirar garantía + email batch admin), `email.service.ts` extendido (4 templates Premium: bienvenida/renovación/reembolso/fallo-pago), helper `lib/utils/retry.ts` (backoff exponencial 1s/2s/4s). Endpoints: `POST /api/v1/openpay/webhook` (verify firma → `charge.succeeded`/`failed`/`subscription.canceled`/`expired`), `GET+POST /api/v1/whatsapp/webhook` (handshake + verify + procesa mensajes/statuses con idempotencia por `whatsappMsgId`), `POST /api/v1/admin/picks-premium/[id]/aprobar` (dispara distribución), `POST /api/v1/admin/picks-premium/[id]/rechazar`, `PATCH /api/v1/admin/picks-premium/[id]` (editar + opcional aprobar), `GET+POST /api/v1/crons/{generar-picks-premium,evaluar-picks-finalizados,sync-membresia-channel}`. 3 jobs nuevos in-process en `instrumentation.ts`: O (generar picks 4h, primer tick 200s tras boot), P (evaluar finalizados 1h, 220s), Q (sync membresía 1h, 240s). Sin SDK de OpenPay (REST + fetch). `@anthropic-ai/sdk` agregado a deps. **Reglas del v3.1 cubiertas**: cero datos de tarjeta en BD (solo `ultimosCuatro`/`marcaTarjeta`), verificación firma obligatoria en TODO webhook (401 sin firma), idempotencia por `openpayCobroId` UNIQUE + `whatsappMsgId` lookup + verificación de estado antes de mutar, retry 1s/2s/4s, cero auto-publicación (PENDIENTE → APROBADO/RECHAZADO/EDITADO_Y_APROBADO via admin endpoint), watermark con email en cada pick 1:1, rate limit Claude 3 partidos/corrida + 10 mensajes/usuario/h, atomicidad transaccional en suscripcion+pago+miembro. **Fail-soft**: si OpenPay/WhatsApp/Anthropic env vars no están, los services log warn + retornan graceful (NO crashean). Eventos analíticos nuevos: `premium_suscripcion_creada/activada/cancelado/reembolsado`, `premium_pago_cobrado/fallido`, `pick_premium_generado/aprobado/rechazado/editado/distribuido/evaluado_batch`, `bot_mensaje_recibido/respuesta_generada/consulta_derivada/ludopatia_detectada`, `cron_sync_membresia_ejecutado`, `suscripcion_vencida_detectada/cancelacion_efectiva/pagos_fallidos_marcada`. |
| **F** — Admin desktop operación ✅ | Admin | `05-pista-admin-operacion/` | Layout admin desktop-only (1280px+) con sidebar lateral 240px (`<AdminSidebar>` agrupa Dashboard / Operación / Análisis / Contenido / Sistema con counters; `<AdminTopbar>` con breadcrumbs + actions; `<AdminLayoutShell>` cliente compone sidebar + main + `<MobileGuard>`). `<AdminPageHeader>` y `<AdminTopNav>` legacy ELIMINADOS. Componentes nuevos: `<AdminCard>`, `<AdminTable>`, `<KbdHint>`. `/admin` → redirect a `/admin/dashboard`. `/admin/dashboard` reescrito con 5 secciones KPI (Captación / Productos / Conversión / Retención / Económicos) + sistema semáforo verde/ámbar/rojo + `<AlarmaBanner>` + `<RangoSelector>` (7d/30d/mes_actual/mes_anterior). Service `admin-kpis.service.ts` calcula KPIs reales de la BD; KPIs sin data manual aún (margen, CAC, LTV, etc.) muestran "—" + status neutral. `/admin/dashboard` (Lote 6, métricas in-house funnel) movido a `/admin/metricas`. **`/admin/picks-premium`** ⭐ vista CRÍTICA: layout 2 paneles (cola izquierda 320px + detalle derecho) con tabs PENDIENTE/APROBADO/RECHAZADO/TODOS, atajos teclado A/R/E/↑↓/Esc (suprimidos cuando hay input/textarea con focus), modal de rechazo con motivo obligatorio, modal de edición (razonamiento/cuota/stake/EV+) que guarda+aprueba en una sola acción, preview real del mensaje WhatsApp con `formatearPickPremium`, watermark con email del editor, toast verde "Pick aprobado y enviado" + envío en background no bloqueante. `/admin/channel-whatsapp` con stats membresía, gráfica envíos/día (30d), tabla últimos 20 picks enviados, alertas de leak (cancelados aún UNIDOS / unidos > activas) con detalles desplegables, info rotación cada 6 meses, botón "Forzar sync" → endpoint `/api/v1/admin/channel-whatsapp/forzar-sync`. `/admin/suscripciones` listing paginado 50/page con filtros (estado/plan/búsqueda), 4 stats (activas/MRR/cancelando-mes/vencidas-30d) + `/admin/suscripciones/[id]` detalle con historial pagos + acciones admin: cancelación inmediata override (revoca acceso al Channel ahora, distinto al flow normal del Lote E que mantiene hasta vencimiento) + reembolso con confirmación adicional fuera de garantía (motivo obligatorio + checkbox confirmando override). Refactor visual `/admin/{afiliados,afiliados/[id],afiliados/nuevo,conversiones,newsletter,leaderboard,logs,premios-mensuales,torneos,usuarios}` a `<AdminTopbar>` + breadcrumbs. Endpoint nuevo `POST /api/v1/admin/newsletter/test` (envía digest de prueba al email del admin antes del envío masivo). Modelo `AuditoriaAdmin` (migración aditiva `20260521000000_lote_f_auditoria`) + service `auditoria.service.ts` con `logAuditoria()` invocado desde TODA acción admin destructiva (regla 21 del CLAUDE.md): aprobar/rechazar/editar pick, cancelar/reembolsar suscripción, marcar premio pagado, aprobar newsletter, forzar sync. Suscripciones service extendido: `listarSuscripcionesAdmin`, `obtenerDetalleSuscripcionAdmin`, `obtenerStatsSuscripciones`, `cancelarInmediatoAdmin`, `reembolsarManualAdmin`. Channel-whatsapp service nuevo (`obtenerStatsMembresia`, `obtenerEngagementUltimos30d`, `obtenerPicksEnviadosRecientes`, `obtenerAlertasLeakChannel`, `obtenerUltimoSync`). Picks-premium-admin service nuevo (`listarColaPicks`, `obtenerDetallePickAdmin`, `obtenerContadoresColaPicks`, `obtenerStatsEditor`). Eventos analíticos nuevos: `admin_suscripcion_cancelada_manual`, `admin_reembolso_procesado`, `admin_sync_membresia_forzado`. |
| **G** — Admin desktop KPIs análisis ✅ | Admin | `06-pista-admin-analisis/` | KPIs drill-down (selector + detail), cohortes (heatmap 12m × 7 buckets), mobile-vitals (CWV reales sample 10% + Lighthouse PSI), finanzas (revenue/MRR/costos editables/CAC/LTV/proyección), alarmas (config thresholds + cron evaluador 1h con idempotencia + email CRITICAL), sistema (auditoría 100% retention + logs refactor + usuarios con ban/soft-delete/cambiar-rol auditados). 6 modelos + 2 enums. 2 jobs nuevos R (alarmas 1h) y S (Lighthouse semanal lunes 6 AM). 14 endpoints admin nuevos + endpoint público `/api/v1/vitals` rate-limit 100/min. `PAGESPEED_API_KEY` opcional. |
| **H** — Microcopy + emails + WhatsApp templates | Usuario | `07-microcopy-emails-whatsapp/` | Catálogo microcopy i18n-ready, 11 emails React Email, 7 templates WhatsApp Business para aprobación Meta, sistema toast/banner basado en sonner. |
| **I** — Mobile-first audit + PWA | Usuario | dentro de `00-design-system/` | Auditoría final mobile + manifest.json + service worker básico. |
| **J** — QA + soft launch + lanzamiento 8 mayo | Ambas | (no requiere specs) | Smoke, k6, soft-launch con 5-10 testers, lanzamiento. |

**Ruta crítica:** A ✅ → B ✅ → C ✅ → E ✅ → D ✅ → F ✅ → G ✅ → J. H/I pueden paralelo después de G.

**Decisión 30 Abr 2026:** se ejecutó Lote E (backend Premium) antes que Lote D (frontend Premium). Razón: Meta Business y OpenPay BBVA requieren lead time de aprobación, así que tener el backend listo + variables configurables permite que la UI pueda enchufarse cuando esté lista sin re-trabajar contratos de servicios.

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

# Nuevas v3.1 — PageSpeed Insights (Lote G ✅, opcional)
# Si vacía: cron Lighthouse skip silencioso, pero los CWV reales del
# cliente igual se capturan en `metricas_vitales` (sample 10%).
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
