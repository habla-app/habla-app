# Inventario de Vistas — Habla! v3.1

Listado exhaustivo de todas las vistas (públicas, autenticadas, Premium, admin) con su estado actual en el repo y su estado objetivo para v3.1. Este es el catálogo maestro que las entregas 3-7 van a desarrollar en detalle.

## Convenciones de la tabla

- **Estado actual:** existe en el repo a partir de los Lotes 1-11.
- **Estado v3.1:** objetivo según el plan de negocios v3.1 + modelo de captación y retención.
- **Acción:** `RECICLAR`, `REESCRIBIR_UI`, `MODIFICAR`, `CREAR`, `DESCARTAR`.
- **Lote v3.1:** lote del nuevo roadmap A-J responsable de la acción.
- **Pista:** `Usuario` (mobile-first) o `Admin` (desktop).

---

## 1. Vistas públicas (sin login requerido)

Grupo de rutas: `app/(public)/*` — layout actualmente en `app/(public)/layout.tsx` con header `PublicHeader` y footer global.

| Ruta | Vista | Estado actual | Acción v3.1 | Lote | Pista |
|---|---|---|---|---|---|
| `/` | Home (landing) | Lote 11: hub editorial 6 secciones (HomeHero, Pronósticos del día, Compite gratis, Casas top, Últimos análisis, Newsletter) | **REESCRIBIR_UI** completo. Nuevo modelo: tagline "Todas las fijas en una", 3 CTAs jerárquicos según estado (Liga / Premium / Afiliado), pick Premium bloqueado, sincronía B↔C visible. Mantiene la lógica de datos pero reordena y rediseña secciones. | B | Usuario |
| `/blog` | Listing de artículos | Lote 8: paginado 12 con `?page=N` | **MODIFICAR** ligeramente: agregar widget Liga Habla! sticky en sidebar mobile, agregar CTA Premium en footer de cada card. Mantener resto. | B | Usuario |
| `/blog/[slug]` | Artículo individual | Lote 8: TOC sticky + JSON-LD + OG dinámico + Newsletter CTA | **MODIFICAR**: agregar bloque "Pick Premium relacionado" si el artículo menciona un partido cubierto, agregar widget de Liga Habla! con próximo partido. | B | Usuario |
| `/casas` | Listing de casas autorizadas | Lote 8: grid filtrable por rating/bono/métodos | **MODIFICAR**: optimización mobile-first (filtros en bottom sheet en lugar de dropdown), agregar badge "Mejor cuota hoy en X partido" cuando aplique. | B | Usuario |
| `/casas/[slug]` | Reseña de casa | Lote 8: review + JSON-LD + CTA dorado | **MODIFICAR**: agregar tabla de partidos top de la semana donde esta casa tiene mejor cuota (cross-link a `/partidos/[slug]`). | B | Usuario |
| `/guias` | Listing de guías | Lote 8: listing | **MODIFICAR**: layout mobile-first, agregar CTA Liga Habla! sticky. | B | Usuario |
| `/guias/[slug]` | Guía individual | Lote 8: JSON-LD Article + HowTo opcional | **MODIFICAR**: agregar Newsletter CTA + glosario inline (linking a /guias/glosario), nada más. | B | Usuario |
| `/pronosticos` | Listing de ligas | Lote 8: lista | **MODIFICAR**: rediseño mobile-first con cards grandes por liga + countdown a próximo partido. | B | Usuario |
| `/pronosticos/[liga]` | Pronósticos por liga | Lote 8: lista de pronósticos | **MODIFICAR**: reordenar para destacar próximos partidos arriba, agregar widget "Mejor cuota actual por partido". | B | Usuario |
| `/partidos/[slug]` | **PRODUCTO B — vista de partido** | Lote 8: artículo + cuotas embebidas si `partidoId` existe + JSON-LD SportsEvent | **REESCRIBIR_UI** completo. Es la vista más crítica del modelo v3.1. Nuevo: 3 CTAs jerárquicos (Liga, Premium bloqueado, Afiliado), análisis editorial reorganizado, comparador de cuotas con botón directo, pick Premium bloqueado prominente, widget cross-link a Producto C, sticky bottom CTA dinámico según estado del usuario. | B | Usuario |
| `/cuotas` | Comparador global | Lote 9: SSR + chips horizontales por liga | **MODIFICAR**: optimización mobile-first del grid, scroll horizontal de chips suave, estado vacío mejorado. | B | Usuario |
| `/suscribir` | Suscripción al newsletter | Lote 10: form de suscripción doble opt-in | **MODIFICAR** ligeramente: alinear visualmente con nuevo design system, agregar copy mobile-first. | B | Usuario |

**Vistas nuevas a crear en pista pública:**

| Ruta | Vista | Acción | Lote | Pista |
|---|---|---|---|---|
| `/premium` | **Premium landing** | **CREAR**: hero, mockup WhatsApp Channel, inclusiones, 3 planes, garantía 7 días, sticky CTA suscribir. | D | Usuario |
| `/premium/checkout` | **Checkout de Premium** | **CREAR**: form OpenPay embebido, resumen del plan, métodos de pago. | D | Usuario |
| `/premium/exito` | **Post-pago Premium** | **CREAR**: confirmación de pago, instrucciones para unirse al WhatsApp Channel (deep link), próximos pasos. | D | Usuario |
| `/premium/mi-suscripcion` | **Gestión de suscripción** | **CREAR**: estado actual, próximo cobro, cambiar plan, cancelar, link al Channel. | D | Usuario |
| `/comunidad/torneo/[slug]` | **PRODUCTO C — vista de torneo del partido** | **CREAR** (separar de `/torneo/[id]` que es legacy): vista de Liga Habla! sincronizada con el partido. Form de predicción 5 mercados, leaderboard preview, cross-link a Producto B, CTA Premium inline, CTA afiliado inline. | C | Usuario |

---

## 2. Vistas autenticadas (usuario logueado)

Grupo de rutas: `app/(main)/*` — layout actualmente en `app/(main)/layout.tsx` con BottomNav.

| Ruta | Vista | Estado actual | Acción v3.1 | Lote | Pista |
|---|---|---|---|---|---|
| `/(main)` (root logged in) | Dashboard usuario | Lote 0: redirige a `/matches` | **DESCARTAR**: en v3.1 el usuario logueado va al mismo `/` que el anónimo, pero con CTAs personalizados. Eliminar redirección. | C | Usuario |
| `/matches` | Listing de partidos para predecir | Lote 11: hero rebrandeado + grid de partidos | **DESCARTAR**: en v3.1 esta vista se fusiona con `/comunidad` (Producto C). El usuario predice desde la vista del torneo del partido (`/comunidad/torneo/[slug]`), no en una vista separada de "matches". | C | Usuario |
| `/torneo/[id]` | Torneo individual (legacy) | Lote 11: hero dorado + countdown + tipsters + StickyCTA | **REESCRIBIR_UI** y **MOVER** a `/comunidad/torneo/[slug]`. La lógica de datos se conserva (form de 5 mercados, leaderboard, etc.) pero la URL cambia y el diseño se rehace mobile-first con sincronía B↔C. | C | Usuario |
| `/live-match` | Partido en vivo | Lote 0: ranking en vivo, eventos, mi ticket | **REESCRIBIR_UI**: mobile-first, agregar alertas Premium en vivo si suscrito, comparador de cuotas en vivo, cross-link a Producto B. | C | Usuario |
| `/mis-combinadas` | Histórico de tickets | Lote 5: stats + grouped por torneo + tab "Mes en curso" | **REESCRIBIR_UI**: rediseño mobile-first, renombrar a `/mis-predicciones` (más claro), simplificar layout. | C | Usuario |
| `/comunidad` | Leaderboard mensual | Lote 5: Top 100 + Mi posición + meses cerrados | **MODIFICAR**: rediseño mobile-first, integrar como subsección de Producto C (rutas `/comunidad`, `/comunidad/torneo/[slug]`, `/comunidad/[username]`, `/comunidad/mes/[mes]`). | C | Usuario |
| `/comunidad/[username]` | Perfil público de tipster | Lote 11: lookup case-insensitive + 6 stats + últimas 10 predicciones + JSON-LD Person | **MODIFICAR** ligeramente: alinear visualmente con design system v3.1. | C | Usuario |
| `/comunidad/mes/[mes]` | Leaderboard cerrado de mes | Lote 5: tabla histórica | **MODIFICAR**: rediseño mobile-first. | C | Usuario |
| `/perfil` | Perfil del usuario | Lote 11: 6 stats grid + 4 quick access + Notificaciones + Perfil público + Eliminar cuenta | **REESCRIBIR_UI**: rediseño mobile-first, agregar sección "Mis casas conectadas" (cross-sell de afiliación), agregar sección "Estado Premium" (CTA suscribir o link al Channel según estado), agregar progreso de nivel visual. | C | Usuario |
| `/perfil/eliminar/confirmar` | Confirmación eliminación | Lote 0: form de confirmación | **MODIFICAR**: rediseño visual. | C | Usuario |

---

## 3. Vistas Premium (suscriptor activo)

**Notas:** algunas viven dentro de `/premium/*` (públicas-protegidas: requieren suscripción), otras son endpoints/triggers backend sin UI directa.

| Ruta | Vista | Acción | Lote | Pista |
|---|---|---|---|---|
| `/premium/contenido` | Sección Premium del sitio (paywall) | **CREAR** (scope parcial 8 mayo, completo agosto): página con análisis quincenales profundos, paper picks históricos, performance del editor. En 8 mayo: solo placeholder con link al WhatsApp Channel. | D (parcial) + agosto | Usuario |
| (canal externo) | WhatsApp Channel privado *Habla! Picks* | **CREAR** infraestructura de soporte: webhook OpenPay → entrega de link, cron de sync membresía. La UI vive en WhatsApp, no en la app. Documentación en spec. | E | Usuario |
| (canal externo) | Bot WhatsApp Business API | **CREAR**: bot 1:1 para FAQ, integrado con Claude API + base de conocimiento curada. | E | Usuario |

---

## 4. Vistas administrativas (desktop)

Grupo de rutas: `app/admin/*` — layout actualmente en `app/admin/layout.tsx` con `AdminTopNav`.

**Decisión arquitectónica v3.1:** el admin se reescribe con sidebar lateral fijo (no top nav) optimizado para desktop. Esto permite mostrar más opciones, navegación rápida con teclado, y multi-pane (sidebar + contenido principal + panel de detalle).

| Ruta | Vista | Estado actual | Acción v3.1 | Lote | Pista |
|---|---|---|---|---|---|
| `/admin` | Admin home | Lote 0: enlaces básicos | **REESCRIBIR_UI**: dashboard de bienvenida con resumen de KPIs del día, alarmas activas, accesos directos. | F | Admin |
| `/admin/dashboard` | Dashboard de KPIs | Lote 6: cards visitas/registros/críticos + funnel + series diarias + top eventos | **REESCRIBIR_UI** completo. Nuevo dashboard organizado por los 5 grupos de KPIs del plan v3.1: Captación / Productos B-C / Conversión / Retención / Económicos. Incluir KPIs Mobile-First y de Channel Premium nuevos. Sistema de alarmas verde/ámbar/rojo. | G | Admin |
| `/admin/logs` | Logs de errores | Lote 6: tabla paginada con filtros | **MODIFICAR**: alinear con sidebar nuevo, mantener funcionalidad. | F | Admin |
| `/admin/leaderboard` | Forzar cierre leaderboard | Lote 5: botón único | **MODIFICAR**: integrar en flujo de cierre mensual con vista previa antes de confirmar. | F | Admin |
| `/admin/premios-mensuales` | CRUD premios mensuales | Lote 5: tabla de estado/datosPago/notas | **MODIFICAR**: mejorar workflow (filtros por estado pendiente, masivo "marcar como pagados", template de respuesta). | F | Admin |
| `/admin/afiliados` | Listing de afiliados | Lote 7: tabla con stats 7d/30d/conv mes | **MODIFICAR**: alinear con sidebar, agregar gráfica de revenue por casa. | F | Admin |
| `/admin/afiliados/[id]` | Detalle de afiliado | Lote 7: stats + form edición + clicks + conversiones | **MODIFICAR**: mejorar UX del form con validación inline, agregar timeline de cambios. | F | Admin |
| `/admin/afiliados/nuevo` | Crear afiliado | Lote 7: form con validación slug/URL/ratings | **MODIFICAR**: alinear visualmente. | F | Admin |
| `/admin/conversiones` | Registro de conversiones | Lote 7: filtros + form inline | **MODIFICAR**: agregar import CSV masivo (los reportes de afiliados llegan como CSV mensual de cada casa). | F | Admin |
| `/admin/newsletter` | Panel newsletter | Lote 10: preview + JSON editor + Aprobar y enviar + histórico | **MODIFICAR**: editor JSON → editor visual (form fields), preview side-by-side desktop. | F | Admin |
| `/admin/torneos` | Gestión de torneos | Lote 0: legacy | **REESCRIBIR_UI** o renombrar a `/admin/partidos`: gestión de partidos editoriales, cobertura, asignación a Liga Habla!. | F | Admin |
| `/admin/usuarios` | Gestión de usuarios | Lote 0: legacy | **REESCRIBIR_UI**: tabla con búsqueda/filtros, vista de detalle por usuario con histórico, herramientas de soporte. | F | Admin |

**Vistas administrativas nuevas a crear:**

| Ruta | Vista | Acción | Lote | Pista |
|---|---|---|---|---|
| `/admin/picks-premium` | **Validar picks Premium** | **CREAR**: cola de picks generados por Claude API esperando aprobación, vista por pick con razonamiento + datos + cuota + casa, botones aprobar/rechazar/editar, historial. | F | Admin |
| `/admin/picks-premium/historico` | **Histórico de picks** | **CREAR**: tabla de todos los picks publicados con resultado (acertó/falló/pendiente), % acierto agregado, filtros por mercado/casa/editor. | G | Admin |
| `/admin/channel-premium` | **Gestión del Channel WhatsApp** | **CREAR**: estado del Channel, miembros activos, leak detection, rotación programada, controles manuales (banear, re-invitar). | F | Admin |
| `/admin/suscripciones` | **Gestión de suscripciones Premium** | **CREAR**: lista de suscriptores, estado de pago, sync con Channel, cancelaciones, reembolsos, estadísticas churn. | F | Admin |
| `/admin/contenido` | **Editor de contenido MDX** | **CREAR** (mejora a flujo actual de archivos MDX): editor inline para crear/editar artículos, casas, guías, partidos sin tener que tocar archivos directamente en el repo. Genera commits en GitHub vía API. (Scope opcional, evaluar viabilidad en Lote F). | F | Admin |
| `/admin/finanzas` | **Reportes financieros** | **CREAR**: revenue por canal mensual (afiliación, Premium, educativos), CAC por canal, LTV por cohorte, payback period. | G | Admin |
| `/admin/cohortes` | **Análisis de cohortes** | **CREAR**: retention curves por cohorte de registro, retention de FTDs, retention de Premium, churn waterfall. | G | Admin |
| `/admin/mobile-vitals` | **Core Web Vitals dashboard** | **CREAR**: serie temporal de Lighthouse Mobile, LCP, INP, CLS por vista crítica. Alarmas si cae por debajo del target. | G | Admin |
| `/admin/alarmas` | **Centro de alarmas** | **CREAR**: lista de KPIs en rojo/ámbar con acción correctiva sugerida (según el sistema de alarmas del plan v3.1). | G | Admin |
| `/admin/auditoria` | **Auditoría legal y compliance** | **CREAR**: histórico de verificaciones MINCETUR, casas desactivadas, disclosures verificados, archivo de Términos & Privacidad por versión. | G | Admin |

---

## 5. Vistas auxiliares (auth, ayuda, legal, error)

| Ruta | Vista | Estado actual | Acción v3.1 | Lote | Pista |
|---|---|---|---|---|---|
| `/auth/signin` | Login | Lote 0: form NextAuth | **MODIFICAR**: alinear visualmente con design system v3.1, simplificar UX mobile. | B | Usuario |
| `/auth/signup` | Registro | Lote 0: form de email + Google OAuth | **MODIFICAR**: alinear visualmente, agregar copy "Compite gratis por S/ 1,250 al mes" como motivador. | B | Usuario |
| `/auth/verificar` | Verificación de email | Lote 0: pending | **MODIFICAR**: alinear visualmente. | B | Usuario |
| `/auth/error` | Error de auth | Lote 0: error genérico | **MODIFICAR**: alinear visualmente. | B | Usuario |
| `/auth/completar-perfil` | Completar perfil post-Google | Lote 0: form complementario | **MODIFICAR**: alinear visualmente. | B | Usuario |
| `/ayuda/faq` | FAQ | Lote 0: estática | **MODIFICAR**: rediseño mobile-first con buscador, categorías. | B | Usuario |
| `/legal/[slug]` | Páginas legales | Lote 0: MDX legal/privacy/cookies/etc. | **MODIFICAR**: actualizar contenidos para v3.1 (mencionar Premium, WhatsApp, OpenPay), alinear visualmente. | B | Usuario |
| `/api/health` | Health check | Lote 0: ping endpoint | **RECICLAR** sin cambios. | (n/a) | Backend |

---

## 6. Resumen agregado

### Por acción

| Acción | Cantidad | % del total |
|---|---|---|
| **CREAR** | 17 vistas | ~30% |
| **REESCRIBIR_UI** | 9 vistas | ~16% |
| **MODIFICAR** | 23 vistas | ~40% |
| **DESCARTAR** | 2 vistas | ~3% |
| **RECICLAR** sin cambios | 1 vista | ~2% |
| **Componentes/canales externos** | 2 piezas | ~5% |
| **Total catalogado** | **54 piezas** | 100% |

### Por pista

| Pista | Vistas existentes | Vistas nuevas | Total |
|---|---|---|---|
| Usuario público | 12 | 4 | 16 |
| Usuario autenticado | 9 | 1 | 10 |
| Usuario Premium | 0 | 3 | 3 |
| Admin desktop | 12 | 10 | 22 |
| Auxiliar | 7 | 0 | 7 |
| **Total** | **40** | **18** | **58** |

### Por lote del nuevo roadmap

| Lote | Vistas tocadas |
|---|---|
| **A** (design system) | Tokens y componentes base, no vistas directamente |
| **B** (público mobile) | 13 vistas (públicas + auth + ayuda + legal) |
| **C** (autenticado mobile) | 9 vistas (perfil, comunidad, predicciones) |
| **D** (Premium UI) | 4 vistas + componentes embebidos en B y C |
| **E** (Premium backend) | Sin UI directa: services + cron + webhook |
| **F** (admin operación) | 12 vistas |
| **G** (admin análisis) | 6 vistas + dashboard refactor |
| **H** (microcopy) | Aplica a todas, no son vistas |
| **I** (mobile audit) | Aplica a todas las vistas pista usuario |
| **J** (lanzamiento) | QA, no vistas nuevas |

---

*Versión 1 · Abril 2026 · Inventario base para planificación de Lotes A-J*
