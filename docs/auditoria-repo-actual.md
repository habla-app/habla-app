# Auditoría del Repo Actual — Habla! v3.1

Análisis exhaustivo de los Lotes 1-11 ya implementados en el repo, clasificando cada pieza según qué hacer en v3.1: **reciclar 1:1**, **reescribir UI manteniendo lógica**, **modificar parcialmente** o **descartar**.

Este archivo es la pieza más importante de la Entrega 1 para Claude Code: cuando ejecute un lote A-J, este archivo le dice qué piezas del trabajo pasado puede usar tal cual, qué tiene que rehacer, y por qué.

## Convenciones

- **♻️ RECICLAR 1:1:** se mantiene sin cambios. El servicio/componente sigue cumpliendo su función en v3.1.
- **🎨 REESCRIBIR_UI:** la lógica de datos se conserva pero el JSX/CSS/UX se rehace para alinear con el modelo v3.1 mobile-first + CTAs jerárquicos.
- **🔧 MODIFICAR:** ajustes parciales (renombrar, añadir prop, ajustar query) sin reescritura completa.
- **❌ DESCARTAR:** se elimina, ya no aplica al modelo v3.1.

---

## 1. Backend y servicios (`apps/web/lib/services/`)

Estos son los activos más valiosos del trabajo previo. Mayoritariamente reciclables.

| Servicio | Lote origen | Acción v3.1 | Justificación |
|---|---|---|---|
| `afiliacion.service.ts` | 7 | ♻️ RECICLAR | Sistema completo de tracking de afiliados, registro de clicks con hash de IP, parseo de UTM, stats por afiliado y agregados. Funciones cumplen 100% lo que v3.1 necesita. |
| `analytics.service.ts` | 6 | 🔧 MODIFICAR | Conservar el core. Agregar handlers para los eventos nuevos (`pick_premium_blocked_visto`, `premium_checkout_iniciado`, `whatsapp_pick_distribuido`, etc. — ver `flujos-navegacion.md` sección 9). |
| `api-football.client.ts` | 0/9 | ♻️ RECICLAR | Cliente para api-football con fetchOddsByFixture, fetchPartidos, fetchEventos. Sin cambios. |
| `backup-r2.service.ts` | 0 | ♻️ RECICLAR | Backup diario de Postgres a Cloudflare R2. Sin cambios. |
| `email.service.ts` | 0 | 🔧 MODIFICAR | Agregar nuevas plantillas Resend para Premium (bienvenida, link Channel, cancelación, recordatorio renovación). Templates en Lote H. |
| `errors.ts` | 0 | ♻️ RECICLAR | Manejo de errores con tipos. Sin cambios. |
| `eventos.mapper.ts` | 0 | ♻️ RECICLAR | Mapper de eventos de partidos. Sin cambios. |
| `leaderboard.service.ts` | 5 | ♻️ RECICLAR | Lógica completa de cierre mensual, cálculo de puntos, asignación de premios. Toda la mecánica de Producto C (Liga Habla!) ya está aquí. |
| `live-matches.service.ts` | 0 | ♻️ RECICLAR | Detección de partidos en vivo. Sin cambios. |
| `live-partido-status.cache.ts` | 0 | ♻️ RECICLAR | Cache de estado de partidos en vivo. |
| `logger.ts` | 0 | ♻️ RECICLAR | Pino logger configurado. |
| `logs.service.ts` | 6 | ♻️ RECICLAR | Persistencia y consulta de LogError. |
| `mincetur-check.service.ts` | 10 | ♻️ RECICLAR | Verificación semanal de licencias MINCETUR. Crítico y bien implementado. |
| `newsletter.service.ts` | 10 | ♻️ RECICLAR | Sistema completo de newsletter con doble opt-in, digest semanal, magic link unsubscribe. Cumple v3.1. |
| `notificaciones.service.ts` | 0 | 🔧 MODIFICAR | Agregar tipos de notificación nuevos para Premium (alertas en vivo, próximo cobro, etc.). |
| `odds-cache.service.ts` | 9 | ♻️ RECICLAR | Cache de cuotas con TTL 30min, mejor casa por outcome, cron Job N. Pieza crítica de Producto B. |
| `partidos-import.service.ts` | 0 | ♻️ RECICLAR | Importación de partidos desde api-football. |
| `partidos.mapper.ts` | 0 | ♻️ RECICLAR | Mapper de partidos. |
| `partidos.service.ts` | 0 | ♻️ RECICLAR | CRUD de partidos. |
| `pasarela-pagos/` | 4 | 🔧 MODIFICAR | Skeleton neutral con 2 métodos (`crearCobroUnico`, `crearSuscripcion`). En Lote D se implementa el adapter real OpenPay reemplazando el `mock-pasarela.ts`. |
| `perfil-publico.service.ts` | 11 | ♻️ RECICLAR | Lookup case-insensitive de perfil público con stats. |
| `poller-partidos.job.ts` | 0 | ♻️ RECICLAR | Poller de partidos en vivo. |
| `puntuacion.service.ts` | 0 | ♻️ RECICLAR | Cálculo de puntos por predicción (5 mercados con pesos). Crítico para Producto C. |
| `ranking.service.ts` | 0 | ♻️ RECICLAR | Ranking de tipsters. |
| `seasons.cache.ts` | 0 | ♻️ RECICLAR | Cache de temporadas de api-football. |
| `stats-semana.service.ts` | 5 | ♻️ RECICLAR | Stats agregadas semanales. |
| `tickets.schema.ts` | 0 | ♻️ RECICLAR | Schema Zod de tickets. |
| `tickets.service.ts` | 0/5 | ♻️ RECICLAR | CRUD de tickets, finalización con `puntosFinales`. Pieza central de Producto C. |
| `torneos.schema.ts` | 0 | ♻️ RECICLAR | Schema Zod de torneos. |
| `torneos.service.ts` | 0/3 | 🔧 MODIFICAR | El "torneo" es lo que en v3.1 llamamos "torneo del partido" (Producto C). La lógica está bien, pero hay que renombrar/reorganizar para clarificar la separación con Producto B. |
| `usuarios.service.ts` | 0 | 🔧 MODIFICAR | Agregar columnas/funciones para tracking de estado del usuario (FTD reportado, casas conectadas, suscripción activa). |

### Servicios nuevos a crear (NO existen en repo)

| Servicio | Lote v3.1 | Función |
|---|---|---|
| `picks-premium.service.ts` | E | CRUD de PickPremium, generación de drafts vía Claude API, flujo de aprobación |
| `claude-api.client.ts` | E | Cliente Anthropic API para generar picks y respuestas del bot FAQ |
| `whatsapp-business.client.ts` | E | Cliente WhatsApp Business API (envío 1:1, webhook handler) |
| `whatsapp-channel.service.ts` | E | Push de mensajes al Channel privado, gestión de membresía |
| `suscripciones.service.ts` | D + E | CRUD de Suscripcion, renovación, cancelación |
| `openpay.client.ts` | D | Reemplaza `mock-pasarela.ts`. Cliente real OpenPay BBVA |
| `cohortes.service.ts` | G | Cálculo de retention curves, churn waterfall por cohorte |
| `mobile-vitals.service.ts` | I | Medición y persistencia de Lighthouse + Core Web Vitals |
| `kpis.service.ts` | G | Cálculo agregado de los 5 grupos de KPIs del plan v3.1 |

---

## 2. Modelos de base de datos (`packages/db/prisma/schema.prisma`)

Inventario completo de modelos existentes y plan de cambios.

### Modelos existentes

| Modelo | Lote origen | Acción v3.1 | Cambios |
|---|---|---|---|
| `Usuario` | 0 | 🔧 MODIFICAR | Agregar columnas: `ftdReportado: Boolean @default(false)`, `casasConectadas: String[]` (slugs de casas con FTD reportado), `tieneSuscripcionActiva: Boolean @default(false)` (denormalizado para queries rápidos). |
| `Account` | 0 | ♻️ RECICLAR | NextAuth tabla. |
| `Session` | 0 | ♻️ RECICLAR | NextAuth tabla. |
| `VerificationToken` | 0 | ♻️ RECICLAR | NextAuth tabla. |
| `Partido` | 0 | ♻️ RECICLAR | Sin cambios. |
| `EventoPartido` | 0 | ♻️ RECICLAR | Eventos en vivo. |
| `Torneo` | 0/3 | 🔧 MODIFICAR | Conservar el modelo. Es la base de Producto C. Posible rename interno a `TorneoPartido` para clarificar concepto. |
| `Ticket` | 0 | ♻️ RECICLAR | Predicciones de usuarios. |
| `PreferenciasNotif` | 0 | 🔧 MODIFICAR | Agregar `notifPremiumPicks: Boolean` y `notifPremiumAlerts: Boolean` (ambos `true` por default para suscriptores Premium). |
| `SolicitudEliminacion` | 0 | ♻️ RECICLAR | |
| `BackupLog` | 0 | ♻️ RECICLAR | |
| `Leaderboard` | 5 | ♻️ RECICLAR | Snapshots mensuales. |
| `PremioMensual` | 5 | ♻️ RECICLAR | Premios en efectivo del Top 10. |
| `LogError` | 6 | ♻️ RECICLAR | |
| `EventoAnalitica` | 6 | ♻️ RECICLAR | |
| `Afiliado` | 7 | ♻️ RECICLAR | Casa de apuestas con metadata. |
| `ClickAfiliado` | 7 | ♻️ RECICLAR | Tracking de clicks. |
| `ConversionAfiliado` | 7 | ♻️ RECICLAR | Conversiones reportadas (FTDs). |
| `SuscriptorNewsletter` | 10 | ♻️ RECICLAR | |
| `DigestEnviado` | 10 | ♻️ RECICLAR | |

### Modelos nuevos (Lotes A-J)

| Modelo | Lote v3.1 | Función |
|---|---|---|
| `Suscripcion` | D + E | Suscripción Premium activa de un usuario: `usuarioId`, `plan` (mensual/trimestral/anual), `iniciada`, `proximoCobro`, `cancelada`, `openpayCustomerId`, `openpaySubscriptionId` |
| `PagoSuscripcion` | D + E | Cobros individuales: `suscripcionId`, `monto`, `fecha`, `estado` (exitoso/fallido/reembolsado), `openpayChargeId` |
| `PickPremium` | E | Pick generado para Premium: `partidoId`, `mercado`, `recomendacion`, `cuotaSugerida`, `casaRecomendadaId`, `stake`, `evCalculado`, `razonamiento`, `aprobado`, `aprobadoPor`, `enviadoChannel`, `fechaPublicacion` |
| `MiembroChannel` | E | Membresía del Channel WhatsApp: `usuarioId`, `suscripcionId`, `unidoEn`, `removidoEn`, `whatsappPhoneNumber` |
| `MetricaWebVitals` | I | Mediciones de Lighthouse + CWV: `url`, `lcp`, `inp`, `cls`, `lighthouseScore`, `medidoEn`, `dispositivo` (mobile/desktop) |
| `UsuarioCasa` | C | Cross-sell tracking: `usuarioId`, `casaSlug`, `primerClick`, `primerFtd`, `ultimoClick` |

---

## 3. Componentes UI (`apps/web/components/`)

106 componentes existen. Mayoritariamente la lógica es reciclable pero el JSX/CSS necesita reescritura para alinear con v3.1 mobile-first + CTAs jerárquicos.

### Componentes de home (`apps/web/components/home/`)

| Componente | Acción | Lote v3.1 | Justificación |
|---|---|---|---|
| `HomeHero.tsx` | 🎨 REESCRIBIR_UI | B | Tagline cambia a "Todas las fijas en una". Layout mobile-first agresivo. CTAs jerárquicos según estado de session. |
| `SectionBar.tsx` | ♻️ RECICLAR | - | Barra de sección reusable. |
| `PartidoDelDiaCard.tsx` | 🎨 REESCRIBIR_UI | B | Card mobile-first con cuotas inline + countdown + 2 CTAs (ver análisis / predecir). Agregar pick Premium bloqueado en variante. |
| `LeaderboardPreview.tsx` | 🎨 REESCRIBIR_UI | B | Preview mobile-first del Top 10. Fila "Tu posición" más prominente. |
| `ArticleCard.tsx` | 🎨 REESCRIBIR_UI | B | Card de artículo con CTA Premium en footer si el artículo menciona partido cubierto. |

### Componentes de matches (`apps/web/components/matches/`)

| Componente | Acción | Lote v3.1 | Justificación |
|---|---|---|---|
| `CountdownLabel.tsx` | ♻️ RECICLAR | - | Label de cuenta regresiva. Reusable. |
| `DayFilterChips.tsx` | 🔧 MODIFICAR | B | Estilizar mobile-first (chips más grandes, scroll horizontal smooth). |
| `EmptyFilteredState.tsx` | 🔧 MODIFICAR | B | Mejorar copy y visuales. |
| `LeagueFilterChips.tsx` | 🔧 MODIFICAR | B | Similar a `DayFilterChips`. |
| `MatchCard.tsx` | 🎨 REESCRIBIR_UI | B | Card central de partido. v3.1: agregar comparador inline, 3 CTAs jerárquicos, sticky bottom. |
| `MatchesPageContent.tsx` | ❌ DESCARTAR | C | La vista `/matches` se elimina en v3.1 (ver inventario-vistas.md). Esta página se descontinúa. |
| `MatchesSidebar.tsx` | ❌ DESCARTAR | C | Idem, junto con `/matches`. |
| `PrizeRulesCard.tsx` | 🔧 MODIFICAR | B | Reusable en home y vistas de Liga. |
| `adapter.ts` | ♻️ RECICLAR | - | Adapter de datos. |

### Componentes de torneo (`apps/web/components/torneo/` y `torneos/`)

| Componente | Acción | Lote v3.1 | Justificación |
|---|---|---|---|
| Todos los `<Torneo*>` (form de predicción, hero, ribbon, sticky CTA) | 🎨 REESCRIBIR_UI | C | Es el corazón de Producto C. Reescritura mobile-first. Agregar widgets cross-link a Producto B y CTAs Premium/afiliado inline. URL nueva: `/comunidad/torneo/[slug]`. |

### Componentes de ticket (`apps/web/components/ticket/` y `tickets/`)

| Componente | Acción | Lote v3.1 | Justificación |
|---|---|---|---|
| Componentes de ticket (visualización predicción, edición, resultado) | 🔧 MODIFICAR | C | Conservar lógica. Ajustar visualmente al design system v3.1. |

### Componentes de comunidad (`apps/web/components/comunidad/`)

| Componente | Acción | Lote v3.1 | Justificación |
|---|---|---|---|
| `LeaderboardMensualTable.tsx` | 🎨 REESCRIBIR_UI | C | Tabla del leaderboard mensual. Mobile-first (alternativa entre tabla densa desktop y stacked cards en mobile). |

### Componentes de perfil (`apps/web/components/perfil/`)

| Componente | Acción | Lote v3.1 | Justificación |
|---|---|---|---|
| `ProfileHero.tsx` | 🎨 REESCRIBIR_UI | C | Hero con avatar, nivel, posición. Estilo v3.1 con barra de progreso visual. |
| `StatsGrid.tsx` | 🔧 MODIFICAR | C | Conservar 6 stats. Agregar trend (↗ +X esta semana). |
| `QuickAccessGrid.tsx` | 🎨 REESCRIBIR_UI | C | Reorganizar a 4 cards: Mis predicciones, Mi link de referido, Newsletter, Soporte. Activar el referido (Lote 13 nuevo a crear). |
| `NotificacionesSection.tsx` | 🔧 MODIFICAR | C | Agregar toggles para Premium (alertas en vivo, próximo cobro). |
| `DatosSection.tsx` | ♻️ RECICLAR | - | Datos del usuario editables. |
| `VerificacionSection.tsx` | ♻️ RECICLAR | - | |
| `FooterSections.tsx` | 🔧 MODIFICAR | C | Agregar sección Premium (estado actual + link a /premium/mi-suscripcion) y sección "Mis casas conectadas". |
| `ConfirmarEliminarContent.tsx` | ♻️ RECICLAR | - | |
| `PerfilRefreshOnUpdate.tsx` | ♻️ RECICLAR | - | |
| `SectionShell.tsx` | ♻️ RECICLAR | - | |

### Componentes MDX (`apps/web/components/mdx/`)

Estos son los más reusables. La mayoría se reciclan.

| Componente | Acción | Lote v3.1 | Justificación |
|---|---|---|---|
| `CasaCTA.tsx` | ♻️ RECICLAR | - | CTA dorado de afiliación. Sin cambios. |
| `CasaReviewCard.tsx` | ♻️ RECICLAR | - | Card de reseña completa de casa. |
| `CasaReviewCardMini.tsx` | ♻️ RECICLAR | - | Versión compacta. |
| `CuotasComparator.tsx` | 🔧 MODIFICAR | B | Conservar lógica. Versión nueva mobile-first (botones más grandes, scroll horizontal, badge "Mejor cuota"). |
| `CuotasComparatorMini.tsx` | ♻️ RECICLAR | - | Versión home. |
| `CuotasComparatorPoller.tsx` | ♻️ RECICLAR | - | Cliente con reintentos. |
| `CuotasGrid.tsx` | 🔧 MODIFICAR | B | Grid de cuotas. Optimizar mobile-first. |
| `DisclaimerAfiliacion.tsx` | ♻️ RECICLAR | - | Legal. |
| `DisclaimerLudopatia.tsx` | ♻️ RECICLAR | - | Legal con teléfono MINCETUR. |
| `PronosticoBox.tsx` | 🎨 REESCRIBIR_UI | B | Box destacado del pronóstico Habla!. Estilo v3.1 con confianza visual. |
| `RelatedArticles.tsx` | ♻️ RECICLAR | - | Server component que matchea por tags. |
| `TOC.tsx` | ♻️ RECICLAR | - | Tabla de contenidos con scroll-spy. |
| `TablaCasas.tsx` | 🔧 MODIFICAR | B | Tabla comparativa con scroll-x. Optimizar mobile. |

### Componentes nuevos a crear (NO existen en repo)

| Componente | Path | Lote v3.1 | Función |
|---|---|---|---|
| `<CTAJerarquico>` | `components/ui/` | A | Renderiza el CTA correcto según `estadoUsuario` y prioridad. Usado en B y C. |
| `<PickBloqueadoTeaser>` | `components/premium/` | B + D | Card de pick Premium con blur + overlay + CTA "Probar 7 días". Aparece en B y C. |
| `<CrossProductBanner>` | `components/ui/` | B + C | Banner de sincronía B↔C. Renderiza link al otro producto. |
| `<PremiumStatusCard>` | `components/premium/` | C + D | Card en perfil que muestra estado Premium (no suscrito / activo / cancelando). |
| `<WhatsAppChannelMockup>` | `components/premium/` | D | Visualización de cómo se ve un pick en el Channel (decorativo). |
| `<PremiumPlansGrid>` | `components/premium/` | D | 3 cards de planes con anual destacado. |
| `<OpenPayCheckout>` | `components/premium/` | D | Form embebido OpenPay. |
| `<MisCasasConectadas>` | `components/perfil/` | C | Lista de casas con FTD activo + CTA "Conectar nueva casa". |
| `<NivelProgressBar>` | `components/perfil/` | C | Barra de progreso visual del nivel. |
| `<KPICard>` | `components/admin/` | G | Card de KPI con valor + trend + estado verde/ámbar/rojo. |
| `<KPISection>` | `components/admin/` | G | Sección agrupada de KPIs (Captación / Productos / Conversión / Retención / Económicos). |
| `<AlarmaBanner>` | `components/admin/` | G | Banner persistente cuando hay KPI en rojo. |
| `<PickPremiumQueue>` | `components/admin/` | F | Cola de picks pendientes de validación con paneles izq/der. |
| `<PickValidationPanel>` | `components/admin/` | F | Panel derecho de validación con datos + razonamiento + botones aprobar/rechazar. |
| `<ChannelMembershipTable>` | `components/admin/` | F | Tabla de miembros del Channel con sync status. |
| `<CohorteRetentionChart>` | `components/admin/` | G | Gráfica de retention por cohorte. |
| `<MobileVitalsChart>` | `components/admin/` | G | Serie temporal de Lighthouse + CWV. |
| `<AdminSidebar>` | `components/admin/` | F | Sidebar fijo desktop con navegación jerárquica. Reemplaza `AdminTopNav`. |

### Componentes admin existentes

| Componente | Acción | Lote v3.1 | Justificación |
|---|---|---|---|
| `AdminTopNav.tsx` | ❌ DESCARTAR | F | Reemplazado por `<AdminSidebar>`. |
| `AdminPageHeader.tsx` | 🔧 MODIFICAR | F | Adaptar al layout con sidebar (header más compacto). |
| `AdminPremiosMensualesPanel.tsx` | 🎨 REESCRIBIR_UI | F | Workflow mejorado (filtros estado, masivo). |
| `AdminTorneosPanel.tsx` | 🎨 REESCRIBIR_UI | F | Renombrar a `AdminPartidosPanel`. |
| `AfiliadoForm.tsx` | 🔧 MODIFICAR | F | Mejor UX inline. |
| `CerrarLeaderboardPanel.tsx` | 🔧 MODIFICAR | F | Confirmación con preview. |
| `ConversionesFiltros.tsx` | ♻️ RECICLAR | - | Filtros de conversiones. |
| `DashboardRangoSelector.tsx` | ♻️ RECICLAR | - | Selector de rango temporal. |
| `LogsFiltros.tsx` | ♻️ RECICLAR | - | |
| `LogsTable.tsx` | ♻️ RECICLAR | - | |
| `NewsletterAdminPanel.tsx` | 🎨 REESCRIBIR_UI | F | Editor JSON → editor visual. |
| `NuevaConversionForm.tsx` | 🔧 MODIFICAR | F | Agregar import CSV. |

### Otros componentes

| Componente / folder | Acción | Lote v3.1 | Justificación |
|---|---|---|---|
| `components/ui/` | 🔧 MODIFICAR | A | Componentes base (botones, inputs, cards, modales). Reescritura para alinear con design system v3.1 mobile-first + admin-desktop. |
| `components/layout/` | 🎨 REESCRIBIR_UI | B + F | NavBar, BottomNav, Footer. Reescribir mobile y desktop. |
| `components/auth/` | 🔧 MODIFICAR | B | Formularios de signin/signup. Alinear visualmente. |
| `components/marketing/` | 🔧 MODIFICAR | B | Newsletter CTA y similares. |
| `components/public/` | 🎨 REESCRIBIR_UI | B | PublicHeader, PublicNavLinks. Versión v3.1. |
| `components/legal/` | ♻️ RECICLAR | - | |
| `components/faq/` | 🔧 MODIFICAR | B | FAQ accordion. Mejorar mobile. |
| `components/live/` | 🔧 MODIFICAR | C | Componentes de partido en vivo. Alinear visualmente + agregar alertas Premium. |
| `components/combo/`, `components/torneos/` | 🎨 REESCRIBIR_UI | C | Forman parte de Producto C. |
| `components/analytics/` | ♻️ RECICLAR | - | TrackOnMount y similares. |

---

## 4. Páginas (`apps/web/app/`)

Ya cubiertas en `inventario-vistas.md`. Resumen rápido:

| Grupo | Acción dominante | Lote v3.1 |
|---|---|---|
| `app/(public)/*` | 🔧 MODIFICAR (mayoría) + nuevas vistas Premium | B + D |
| `app/(main)/*` | 🎨 REESCRIBIR_UI mayoría + 2 ❌ DESCARTAR (`/matches`, `/(main)/page`) | C |
| `app/admin/*` | 🎨 REESCRIBIR_UI con sidebar nuevo + 10 vistas nuevas | F + G |
| `app/auth/*` | 🔧 MODIFICAR visualmente | B |
| `app/ayuda/*` | 🔧 MODIFICAR | B |
| `app/legal/*` | 🔧 MODIFICAR contenidos | B + H |
| `app/api/*` | ♻️ RECICLAR mayoría + endpoints nuevos | E + F + G |

---

## 5. Configuración y stack

| Pieza | Acción | Lote v3.1 | Justificación |
|---|---|---|---|
| `tailwind.config.ts` | 🔧 MODIFICAR | A | Tokens existentes son sólidos. Agregar tokens nuevos para Premium (gradientes específicos), admin desktop (densidades, atajos visuales), Mobile-First (escalas tipográficas separadas). |
| `apps/web/app/globals.css` | 🔧 MODIFICAR | A | Sincronizar variables CSS con tokens nuevos. |
| `apps/web/instrumentation.ts` | 🔧 MODIFICAR | E + I | Agregar Jobs O, P, Q, R, S, T (ver mapa-rutas.md sección 6). |
| `apps/web/middleware.ts` | 🔧 MODIFICAR | F | Agregar protección admin si no la tiene actualmente. |
| `Dockerfile` | ♻️ RECICLAR | - | |
| `docker-compose.yml` | ♻️ RECICLAR | - | |
| `railway.toml` | ♻️ RECICLAR | - | |
| `pnpm-workspace.yaml` | ♻️ RECICLAR | - | |
| `turbo.json` | ♻️ RECICLAR | - | |
| `.env.example` | 🔧 MODIFICAR | D + E | Agregar nuevas vars OpenPay, WhatsApp, Anthropic. |
| `apps/web/content/` (MDX) | 🔧 MODIFICAR | B + H | Actualizar contenidos para alinear con v3.1 (slogan, copy, removeer referencias a Lukas/tienda si quedan). |

---

## 6. Tests existentes

| Path | Acción | Lote v3.1 |
|---|---|---|
| `apps/web/tests/` | 🔧 MODIFICAR | J | Adaptar tests a las URLs nuevas (especialmente `/comunidad/torneo/[slug]` reemplazando `/torneo/[id]`). |
| `tests/e2e/` | 🔧 MODIFICAR | J | Adaptar flujos E2E al nuevo modelo de captación: visitante → registro → click afiliado → suscripción Premium. |
| `tests/load/` | ♻️ RECICLAR | - | k6 tests para soft launch. |

---

## 7. Documentación existente

| Archivo | Acción v3.1 |
|---|---|
| `CLAUDE.md` | 🔧 MODIFICAR. Agregar regla 13 (specs UX v3.1), nueva tabla de Lotes A-J, deprecación de Lotes 12-16 originales. |
| `README.md` | 🔧 MODIFICAR. Actualizar overview del proyecto para reflejar v3.1. |
| `CHANGELOG.md` | ♻️ RECICLAR. Seguir agregando entradas por lote. |
| `docs/habla-mockup-completo.html` | ♻️ MANTENER como referencia histórica. La spec v3.1 lo reemplaza como fuente de verdad visual. |
| `docs/legal-source/` | ♻️ RECICLAR. |
| `plan-final-lotes.md` | 🔧 DEPRECAR los Lotes 12-16. Marcar como histórico para Lotes 1-11. |
| `Habla_Plan_de_Negocios_v3.1.md` | ♻️ MANTENER como fuente de verdad estratégica. |

---

## 8. Resumen agregado

### Por categoría

| Categoría | ♻️ Reciclar | 🔧 Modificar | 🎨 Reescribir UI | ❌ Descartar | ⭐ Crear |
|---|---|---|---|---|---|
| Servicios backend | 21 | 5 | 0 | 0 | 9 |
| Modelos DB | 16 | 4 | 0 | 0 | 6 |
| Componentes UI | 38 | 27 | 22 | 4 | 18 |
| Páginas | 12 | 27 | 9 | 2 | 17 |
| Configuración | 7 | 5 | 0 | 0 | 0 |
| **Total** | **94** | **68** | **31** | **6** | **50** |

### Trabajo neto estimado

- **40% del repo se recicla 1:1** (sobre todo backend y schemas — lo más caro de construir).
- **27% del repo se modifica parcialmente** (ajustes contenidos, no reescritura).
- **12% del repo se reescribe en UI** (lógica intacta, JSX/CSS rehecho).
- **2% del repo se descarta** (vistas obsoletas).
- **20% del repo es nuevo** (Premium completo, KPIs admin, mobile-first audit).

Esto valida la tesis del overhaul: **el cableado funcional está prácticamente completo**. Lo que cambia es la capa de UI y la capa Premium completa. Esto explica por qué los Lotes A-J caben en ~3 semanas de desarrollo.

---

## 9. Riesgos del overhaul detectados durante la auditoría

| Riesgo | Mitigación |
|---|---|
| **Renombrado masivo de URLs** rompe SEO acumulado | Implementar redirects 301 de las URLs viejas (`/matches`, `/torneo/[id]`) a las nuevas (`/`, `/comunidad/torneo/[slug]`). Próximo a Lote J. |
| **Lógica de Producto C parcialmente acoplada al concepto "torneos"** | Reescritura cuidadosa para preservar `puntuacion.service`, `tickets.service`, `leaderboard.service` que están perfectos. Solo cambia URL y UX wrapper. |
| **`AdminTopNav` vs `<AdminSidebar>` rompe layout admin existente** | Lote F implementa el sidebar nuevo Y migra todas las páginas admin en el mismo lote para evitar estado intermedio. |
| **Migración de `Suscripcion` puede ser destructiva** si Lote 12 original ya creó algo similar | Auditoría: confirmar antes del Lote D que no hay tabla `Suscripcion` o similar en el schema actual. La regla 3 de CLAUDE.md (backup pre-deploy) aplica si hay duda. |
| **WhatsApp Business API verificación toma tiempo Meta** | Lote E debe iniciar trámite de verificación en día 1, no día final. La verificación puede tomar 5-10 días según Meta. Si para 8 mayo no está verificada, lanzar Premium con el WhatsApp regular del operador como fallback temporal y migrar después. |

---

*Versión 1 · Abril 2026 · Auditoría base para Lotes A-J*
