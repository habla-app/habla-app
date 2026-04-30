# Mapa de Rutas — Habla! v3.1

Mapeo URL → componente → datos requeridos → quién puede acceder. Es el manifest de routing para Claude Code: cuando vaya a construir/modificar una vista, este archivo le dice qué archivo del repo tocar, qué queries necesita, y qué validación de acceso aplica.

## Convenciones

- **URL pattern:** ruta literal o con `[parametro]` dinámico.
- **Archivo en repo:** ruta relativa al monorepo, basado en estructura actual.
- **Componente raíz:** el `page.tsx` del archivo, función exportada por default.
- **Datos:** queries Prisma, calls a services, llamadas a APIs externas.
- **Acceso:** quién puede ver la vista. Estados: `público`, `auth`, `auth+premium`, `auth+admin`.
- **Render:** `SSR`, `ISR <ttl>`, `force-dynamic`, `client-component`.

---

## 1. Pista pública (`app/(public)/*`)

Layout: `app/(public)/layout.tsx` — incluye `<PublicHeader>`, `<PublicNavLinks>`, `<Footer>`. Sin `<BottomNav>`.

### Home y rutas raíz

| URL | Archivo en repo | Componente raíz | Datos requeridos | Acceso | Render |
|---|---|---|---|---|---|
| `/` | `app/(public)/page.tsx` (consolidación con `app/(main)/page.tsx`) | `<HomePage />` | `articles.getAll().slice(0,3)` (Lote 8), `obtenerTopTipsters(5)` (Lote 5), `prisma.partido.findMany({proximas24h, top:3})` con join a `obtenerOddsCacheadas` (Lote 9), `obtenerCasasTopActivas(6)` (Lote 7), si autenticado: `getServerSession()` para detectar estado del usuario (free/FTD/Premium) | público (con personalización si autenticado) | `force-dynamic` |
| `/cuotas` | `app/(public)/cuotas/page.tsx` | `<CuotasPage />` | `prisma.partido.findMany({proximas36h, take:30})` + `obtenerOddsCacheadas` por partido + `<HorizontalScrollChips>` por liga | público | `ISR 1800s` |

### Editorial

| URL | Archivo en repo | Componente raíz | Datos requeridos | Acceso | Render |
|---|---|---|---|---|---|
| `/blog` | `app/(public)/blog/page.tsx` | `<BlogListing />` | `articles.getAll()` con paginación 12 por `?page=N` | público | `ISR 3600s` |
| `/blog/[slug]` | `app/(public)/blog/[slug]/page.tsx` | `<BlogPost />` | `articles.getBySlug(slug)`, `articles.getRelated(slug)`, JSON-LD Article + OG dinámico | público | `ISR 3600s` |
| `/casas` | `app/(public)/casas/page.tsx` | `<CasasPage />` | `casas.getAll()` filtradas por `activo && autorizadoMincetur` (Lote 7), filtros client-side via `<CasasGrid>` | público | `ISR 3600s` |
| `/casas/[slug]` | `app/(public)/casas/[slug]/page.tsx` | `<CasaReview />` | `casas.getBySlug(slug)`, JSON-LD Review con `aggregateRating` si rating presente, **NUEVO v3.1**: `prisma.partido.findMany` próximos 7d con `obtenerOddsCacheadas` filtrando donde esta casa tiene mejor cuota | público | `ISR 3600s` |
| `/guias` | `app/(public)/guias/page.tsx` | `<GuiasListing />` | `guias.getAll()` con orden por `_meta.ts` | público | `ISR 3600s` |
| `/guias/[slug]` | `app/(public)/guias/[slug]/page.tsx` | `<GuiaPost />` | `guias.getBySlug(slug)`, JSON-LD Article + HowTo opcional | público | `ISR 3600s` |
| `/pronosticos` | `app/(public)/pronosticos/page.tsx` | `<PronosticosLanding />` | `pronosticos.getLigas()`, `prisma.partido.findMany` próximo partido por liga | público | `ISR 3600s` |
| `/pronosticos/[liga]` | `app/(public)/pronosticos/[liga]/page.tsx` | `<PronosticosLiga />` | `pronosticos.getByLiga(liga)` + `prisma.partido.findMany({liga})` próximos | público | `ISR 3600s` |
| `/partidos/[slug]` ⭐ | `app/(public)/partidos/[slug]/page.tsx` | `<PartidoView />` (PRODUCTO B) | `partidos.getBySlug(slug)` (Lote 8), `obtenerOddsCacheadas(partidoId)` (Lote 9), análisis MDX si existe, **NUEVO v3.1**: `prisma.pickPremium.findFirst({partidoId, aprobado:true})` para pick bloqueado, `prisma.torneoPartido.findFirst({partidoId})` para link a Producto C, `getServerSession()` para personalizar CTAs jerárquicos | público | `force-dynamic` (depende de session + cuotas frescas) |
| `/suscribir` | `app/(public)/suscribir/page.tsx` | `<SuscribirForm />` | endpoint POST `/api/v1/newsletter/suscribir` (Lote 10) | público | `static` |

### Premium (públicas-protegidas)

| URL | Archivo en repo | Componente raíz | Datos requeridos | Acceso | Render |
|---|---|---|---|---|---|
| `/premium` ⭐ NUEVO | `app/(public)/premium/page.tsx` | `<PremiumLanding />` | `prisma.pickPremium.findMany({aprobado:true, take:3})` para preview de últimos picks, `prisma.suscripcion.count({activa:true})` para social proof | público | `force-dynamic` |
| `/premium/checkout` ⭐ NUEVO | `app/(public)/premium/checkout/page.tsx` | `<PremiumCheckout />` | `getServerSession()` (requiere auth), formulario embebido OpenPay | auth | `force-dynamic` |
| `/premium/exito` ⭐ NUEVO | `app/(public)/premium/exito/page.tsx` | `<PremiumSuccess />` | Verificar `prisma.suscripcion.findFirst({usuarioId, activa:true})`, mostrar deep-link al WhatsApp Channel privado | auth+premium | `force-dynamic` |
| `/premium/mi-suscripcion` ⭐ NUEVO | `app/(public)/premium/mi-suscripcion/page.tsx` | `<MiSuscripcion />` | `prisma.suscripcion.findFirst({usuarioId, activa:true})`, OpenPay API para próximo cobro | auth+premium | `force-dynamic` |
| `/premium/contenido` ⭐ NUEVO | `app/(public)/premium/contenido/page.tsx` | `<PremiumContent />` | Acceso al feed Premium del sitio, paywall si no suscrito. Scope reducido en 8 mayo: redirect al WhatsApp Channel. | auth+premium | `force-dynamic` |

### Auth, ayuda, legal

| URL | Archivo en repo | Componente raíz | Datos requeridos | Acceso | Render |
|---|---|---|---|---|---|
| `/auth/signin` | `app/auth/signin/page.tsx` | `<SignInPage />` | NextAuth handler | público | `static` |
| `/auth/signup` | `app/auth/signup/page.tsx` | `<SignUpPage />` | NextAuth handler + magic link Resend | público | `static` |
| `/auth/verificar` | `app/auth/verificar/page.tsx` | `<VerificarPage />` | Verifica token en URL | público | `static` |
| `/auth/error` | `app/auth/error/page.tsx` | `<AuthErrorPage />` | Display error desde query param | público | `static` |
| `/auth/completar-perfil` | `app/auth/completar-perfil/page.tsx` | `<CompletarPerfilPage />` | `prisma.usuario.findUnique({sessionId})` | auth | `force-dynamic` |
| `/ayuda/faq` | `app/ayuda/faq/page.tsx` | `<FAQPage />` | Contenido estático + `<FAQAccordion>` | público | `static` |
| `/legal/[slug]` | `app/legal/[slug]/page.tsx` | `<LegalPage />` | MDX desde `apps/web/content/legal/[slug].mdx` | público | `static` |

---

## 2. Pista autenticada (`app/(main)/*`)

Layout: `app/(main)/layout.tsx` — incluye `<MainHeader>`, `<BottomNav>` mobile, `<UserAvatar>`, requiere session.

### Decisión arquitectónica v3.1

`/(main)/page.tsx` y `/matches` se eliminan. El usuario logueado va a la misma `/` pública pero con CTAs personalizados (detección via `getServerSession()`). Esto unifica la experiencia y elimina dos vistas redundantes.

| URL | Archivo en repo | Componente raíz | Datos requeridos | Acceso | Render |
|---|---|---|---|---|---|
| ~~`/(main)`~~ | ELIMINAR | redirect → `/` | n/a | - | - |
| ~~`/matches`~~ | ELIMINAR | redirect → `/` | n/a | - | - |
| `/comunidad` | `app/(main)/comunidad/page.tsx` | `<ComunidadPage />` | `obtenerLeaderboardMesActual()` (Lote 5), `obtenerMiPosicion(userId)`, `obtenerMesesCerrados()` | auth | `force-dynamic` |
| `/comunidad/torneo/[slug]` ⭐ NUEVO | `app/(main)/comunidad/torneo/[slug]/page.tsx` | `<TorneoView />` (PRODUCTO C) | `prisma.torneo.findUnique({partidoSlug})`, `obtenerLeaderboardTorneo(torneoId)`, `prisma.ticket.findFirst({torneoId, usuarioId})`, **NUEVO v3.1**: link a Producto B vía `partidos.getBySlug(slug)`, `obtenerOddsCacheadas(partidoId)` para widget afiliado inline, `prisma.pickPremium` para CTA Premium | auth | `force-dynamic` |
| `/comunidad/[username]` | `app/(main)/comunidad/[username]/page.tsx` | `<PerfilPublico />` | `obtenerPerfilPublico(username)` (Lote 11) | auth (requiere session aunque vista sea de otro user) | `force-dynamic` |
| `/comunidad/mes/[mes]` | `app/(main)/comunidad/mes/[mes]/page.tsx` | `<LeaderboardMes />` | `obtenerLeaderboardCerrado(mes)` (Lote 5) | auth | `ISR 86400s` |
| `/live-match` | `app/(main)/live-match/page.tsx` | `<LiveMatchPage />` | `obtenerPartidosEnVivo()` (Lote 0), Socket.io para ranking en vivo, **NUEVO v3.1**: si Premium activo, mostrar alertas en vivo del editor | auth | `force-dynamic` (Socket.io en cliente) |
| ~~`/mis-combinadas`~~ → `/mis-predicciones` | `app/(main)/mis-predicciones/page.tsx` (renombrar) | `<MisPredicciones />` | `obtenerTicketsDeUsuario(userId)`, `obtenerStatsDeUsuario(userId)` | auth | `force-dynamic` |
| `/perfil` | `app/(main)/perfil/page.tsx` | `<PerfilPage />` | `prisma.usuario.findUnique({id})`, `obtenerMisStatsMensuales` (Lote 5), nivel del usuario, **NUEVO v3.1**: `obtenerCasasConectadas(userId)`, `obtenerEstadoPremium(userId)` | auth | `force-dynamic` |
| `/perfil/eliminar/confirmar` | `app/(main)/perfil/eliminar/confirmar/page.tsx` | `<EliminarConfirmar />` | endpoint POST `/api/v1/usuarios/me/eliminar` | auth | `static` |

---

## 3. Pista admin (`app/admin/*`)

Layout: `app/admin/layout.tsx` — actualmente `<AdminTopNav>`. **Cambio v3.1:** reescribir layout con `<AdminSidebar>` lateral fijo (desktop optimizado).

### Validación de acceso para todas las vistas admin

```typescript
// Patrón a usar en cada page.tsx admin
const session = await getServerSession();
if (!session || session.user.rol !== 'ADMIN') {
  redirect('/auth/signin?callbackUrl=' + currentUrl);
}
```

### Vistas existentes (con cambios v3.1)

| URL | Archivo en repo | Componente raíz | Datos requeridos | Render |
|---|---|---|---|---|
| `/admin` | `app/admin/page.tsx` | `<AdminHome />` | Resumen rápido: KPIs día, alarmas activas, accesos directos | `force-dynamic` |
| `/admin/dashboard` ⭐ REWRITE | `app/admin/dashboard/page.tsx` | `<AdminDashboard />` | KPIs agrupados por los 5 grupos del plan v3.1: `obtenerKPIsCaptacion(periodo)`, `obtenerKPIsProductosBC(periodo)`, `obtenerKPIsConversion(periodo)`, `obtenerKPIsRetencion(periodo)`, `obtenerKPIsEconomicos(periodo)`. Más KPIs de Mobile-First y Channel Premium. | `force-dynamic` |
| `/admin/logs` | `app/admin/logs/page.tsx` | `<AdminLogs />` | `obtenerLogsPaginados(filtros)` (Lote 6) | `force-dynamic` |
| `/admin/leaderboard` | `app/admin/leaderboard/page.tsx` | `<AdminLeaderboard />` | `obtenerLeaderboardMesAnterior()`, endpoint POST `/api/v1/admin/leaderboard/cerrar` | `force-dynamic` |
| `/admin/premios-mensuales` | `app/admin/premios-mensuales/page.tsx` | `<AdminPremios />` | `obtenerPremiosMensualesPendientes()` + filtros por estado (Lote 5) | `force-dynamic` |
| `/admin/afiliados` | `app/admin/afiliados/page.tsx` | `<AdminAfiliados />` | `listarTodos()` (Lote 7) + `obtenerStatsResumenTodos(7d/30d)` | `force-dynamic` |
| `/admin/afiliados/[id]` | `app/admin/afiliados/[id]/page.tsx` | `<AdminAfiliadoDetalle />` | `obtenerAfiliadoPorId(id)`, `obtenerStatsAfiliado(id, periodo)`, `listarClicksDeAfiliado(id, paginacion)`, `listarConversiones(afiliadoId)` | `force-dynamic` |
| `/admin/afiliados/nuevo` | `app/admin/afiliados/nuevo/page.tsx` | `<AdminAfiliadoNuevo />` | endpoint POST `/api/v1/admin/afiliados` | `static` |
| `/admin/conversiones` | `app/admin/conversiones/page.tsx` | `<AdminConversiones />` | `listarConversiones(filtros)` (Lote 7), **NUEVO v3.1**: import CSV masivo via `/api/v1/admin/conversiones/import-csv` | `force-dynamic` |
| `/admin/newsletter` | `app/admin/newsletter/page.tsx` | `<AdminNewsletter />` | `getDigestActual()`, `historicoDigests()` (Lote 10) | `force-dynamic` |
| `/admin/torneos` → `/admin/partidos` | `app/admin/partidos/page.tsx` (renombrar) | `<AdminPartidos />` | `prisma.partido.findMany` con filtros por liga/estado/fecha | `force-dynamic` |
| `/admin/usuarios` | `app/admin/usuarios/page.tsx` | `<AdminUsuarios />` | `prisma.usuario.findMany` con búsqueda + filtros | `force-dynamic` |

### Vistas admin nuevas (Lotes F + G)

| URL | Archivo en repo | Componente raíz | Datos requeridos | Render |
|---|---|---|---|---|
| `/admin/picks-premium` ⭐ NUEVO | `app/admin/picks-premium/page.tsx` | `<PicksPremiumQueue />` | `prisma.pickPremium.findMany({aprobado:false, rechazado:false})` + endpoints aprobar/rechazar/editar | `force-dynamic` |
| `/admin/picks-premium/historico` ⭐ NUEVO | `app/admin/picks-premium/historico/page.tsx` | `<PicksPremiumHistorico />` | `prisma.pickPremium.findMany({aprobado:true})` + cálculo de % acierto agregado | `force-dynamic` |
| `/admin/channel-premium` ⭐ NUEVO | `app/admin/channel-premium/page.tsx` | `<ChannelPremiumMgmt />` | `obtenerEstadoChannel()` (cuenta members vs subs activas), `detectarLeaks()` (members sin sub activa), endpoints sincronizar / banear / re-invitar | `force-dynamic` |
| `/admin/suscripciones` ⭐ NUEVO | `app/admin/suscripciones/page.tsx` | `<SuscripcionesList />` | `prisma.suscripcion.findMany({filtros})`, OpenPay API para detalles de pago | `force-dynamic` |
| `/admin/contenido` ⭐ NUEVO (opcional) | `app/admin/contenido/page.tsx` | `<EditorContenido />` | Lista MDX de `apps/web/content/*`, GitHub API para commits | `force-dynamic` |
| `/admin/finanzas` ⭐ NUEVO | `app/admin/finanzas/page.tsx` | `<AdminFinanzas />` | `obtenerRevenueMensual()`, `obtenerLTVporCohorte()`, `obtenerCAC()` | `force-dynamic` |
| `/admin/cohortes` ⭐ NUEVO | `app/admin/cohortes/page.tsx` | `<AdminCohortes />` | `calcularRetentionCurves(cohortes)`, `calcularChurnWaterfall(periodo)` | `force-dynamic` |
| `/admin/mobile-vitals` ⭐ NUEVO | `app/admin/mobile-vitals/page.tsx` | `<MobileVitals />` | `obtenerLighthouseSeries()`, `obtenerCoreWebVitalsByView()` (Lote I instala el cron de medición) | `force-dynamic` |
| `/admin/alarmas` ⭐ NUEVO | `app/admin/alarmas/page.tsx` | `<CentroAlarmas />` | `obtenerAlarmasActivas()` cruzando todos los KPIs contra umbrales del plan v3.1 | `force-dynamic` |
| `/admin/auditoria` ⭐ NUEVO | `app/admin/auditoria/page.tsx` | `<AdminAuditoria />` | `obtenerHistoricoMincetur()`, `obtenerCasasDesactivadas()`, `obtenerVersionesLegales()` | `force-dynamic` |

---

## 4. APIs `/api/v1/*`

**Estado actual:** ya implementadas en Lotes 0-11 (auth, analytics, afiliados, conversiones, newsletter, mincetur, leaderboard, etc.). Conservar todas.

**APIs nuevas a crear en Lotes A-J:**

| Endpoint | Método | Lote | Función |
|---|---|---|---|
| `/api/v1/picks-premium/generar` | POST | E | Cron interno: genera draft de picks vía Claude API + datos |
| `/api/v1/admin/picks-premium/[id]/aprobar` | POST | F | Admin aprueba un pick → trigger envío al Channel |
| `/api/v1/admin/picks-premium/[id]/rechazar` | POST | F | Admin rechaza un pick |
| `/api/v1/admin/picks-premium/[id]` | PATCH | F | Admin edita pick antes de aprobar |
| `/api/v1/picks-premium/distribuir` | POST | E | Cron: envía picks aprobados al WhatsApp Channel |
| `/api/v1/admin/channel-premium/sincronizar` | POST | E + F | Cron + manual: sincroniza miembros del Channel con suscripciones activas |
| `/api/v1/whatsapp/webhook` | POST | E | Webhook de WhatsApp Business API: recibe mensajes 1:1, dispara bot de FAQ vía Claude API |
| `/api/v1/openpay/webhook` | POST | D + E | Webhook OpenPay: pago confirmado → crea suscripción → envía email con link Channel |
| `/api/v1/admin/suscripciones/[id]/cancelar` | POST | F | Admin cancela suscripción + remueve del Channel |
| `/api/v1/admin/conversiones/import-csv` | POST | F | Import masivo de reportes mensuales de afiliados |
| `/api/v1/lighthouse/measure` | POST | I | Cron: corre Lighthouse en URLs críticas y guarda en `prisma.metricaWebVitals` |
| `/api/v1/admin/alarmas` | GET | G | Devuelve KPIs en rojo/ámbar con acción correctiva |

---

## 5. Servicios de soporte

Ya existen (Lote 1-11) y se reciclan. Lista de referencia para Claude Code:

| Service | Path | Funciones principales | Lote origen |
|---|---|---|---|
| `afiliacion.service.ts` | `apps/web/lib/services/` | `registrarClick`, `obtenerActivosOrdenados`, `obtenerStatsAfiliado`, `parsearUtm` | 7 |
| `analytics.service.ts` | `apps/web/lib/services/` | `track`, `obtenerOverview`, `obtenerFunnel` | 6 |
| `api-football.client.ts` | `apps/web/lib/services/` | `fetchOddsByFixture`, `fetchPartidos`, `fetchEventos` | 0/9 |
| `leaderboard.service.ts` | `apps/web/lib/services/` | `cerrarLeaderboard`, `obtenerLeaderboardMesActual`, `obtenerMiPosicion` | 5 |
| `logs.service.ts` | `apps/web/lib/services/` | `registrar`, `paginar`, `stats24h` | 6 |
| `mincetur-check.service.ts` | `apps/web/lib/services/` | `verificarCasa`, `verificarTodasActivas` | 10 |
| `newsletter.service.ts` | `apps/web/lib/services/` | `generarDigestSemanal`, `crearDraftSemanal`, `aprobarYEnviarDigest`, `suscribirEmail` | 10 |
| `odds-cache.service.ts` | `apps/web/lib/services/` | `actualizarOddsPartido`, `obtenerOddsCacheadas`, `ejecutarCronOdds` | 9 |
| `partidos.service.ts` | `apps/web/lib/services/` | CRUD de partidos | 0 |
| `perfil-publico.service.ts` | `apps/web/lib/services/` | `obtenerPerfilPublico` | 11 |
| `tickets.service.ts` | `apps/web/lib/services/` | CRUD de tickets, finalización con `puntosFinales` | 0/5 |
| `torneos.service.ts` | `apps/web/lib/services/` | CRUD torneos gratuitos | 0/3 |
| `usuarios.service.ts` | `apps/web/lib/services/` | CRUD usuarios | 0 |

**Servicios nuevos a crear en Lotes A-J:**

| Service | Path | Lote |
|---|---|---|
| `picks-premium.service.ts` | `apps/web/lib/services/` | E |
| `claude-api.client.ts` | `apps/web/lib/services/` | E |
| `whatsapp-business.client.ts` | `apps/web/lib/services/` | E |
| `whatsapp-channel.service.ts` | `apps/web/lib/services/` | E |
| `suscripciones.service.ts` | `apps/web/lib/services/` | D + E |
| `openpay.client.ts` | `apps/web/lib/services/pasarela-pagos/` (reemplaza skeleton actual) | D |
| `cohortes.service.ts` | `apps/web/lib/services/` | G |
| `mobile-vitals.service.ts` | `apps/web/lib/services/` | I |
| `kpis.service.ts` | `apps/web/lib/services/` | G |

---

## 6. Crons (`apps/web/instrumentation.ts`)

**Existentes:** Job J (cierre leaderboard mensual, Lote 5), Job M (alertas críticos, Lote 6), Job N (odds cache cada 30min, Lote 9), Job K (verificación MINCETUR semanal, Lote 10), Job L (newsletter draft sábado, Lote 10).

**Nuevos en Lotes A-J:**

| Job | Frecuencia | Función | Lote |
|---|---|---|---|
| Job O | Cada 1h, lunes-domingo 09:00 | Generar drafts de picks Premium | E |
| Job P | En tiempo real (trigger) | Distribuir pick aprobado al Channel | E |
| Job Q | Cada 1h | Sincronizar membresía Channel ↔ suscripciones activas | E |
| Job R | Diario 03:00 | Lighthouse audit en vistas críticas | I |
| Job S | Lunes 09:00 PET | Resumen semanal Premium al Channel | E |
| Job T | Cada 1h | Calcular y publicar alarmas KPI | G |

---

## 7. Variables de entorno nuevas

A agregar en `.env.example` y Railway (paso manual del usuario, listado en cada lote correspondiente):

```bash
# Lote D (OpenPay BBVA)
OPENPAY_MERCHANT_ID
OPENPAY_PRIVATE_KEY
OPENPAY_PUBLIC_KEY
OPENPAY_PRODUCTION  # 'true' en prod

# Lote E (WhatsApp Business API)
META_BUSINESS_ID
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_ACCESS_TOKEN
WHATSAPP_VERIFY_TOKEN  # para webhook
WHATSAPP_CHANNEL_PUBLIC_ID
WHATSAPP_CHANNEL_PREMIUM_ID
WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK  # rotable cada 6 meses

# Lote E (Claude API)
ANTHROPIC_API_KEY
ANTHROPIC_MODEL  # 'claude-opus-4-7' por default
```

---

*Versión 1 · Abril 2026 · Mapa de rutas base para Lotes A-J*
