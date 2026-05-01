# Smoke tests end-to-end — Lote J (lanzamiento 8 mayo 2026)

> **Audiencia:** Gustavo + 5-10 testers del soft launch.
> **Entorno:** producción `https://hablaplay.com` (no localhost — regla 1 del CLAUDE.md).
> **Duración estimada:** 90 min para los 7 flujos completos.
> **Política de fallos:** cualquier flujo que rompa va a `feat/lote-j-qa-launch` como issue + hot-fix antes del 8 mayo.

Cada flujo arranca con sesión limpia (incógnito o "Borrar datos del sitio" en DevTools). Para los flujos Premium, usar tarjetas sandbox de OpenPay BBVA (ver §F).

---

## A. Flujo Anónimo → Free → Predicción

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Abrir `https://hablaplay.com/` en mobile (Chrome móvil o DevTools 375×667). | Home renderiza < 2.5s LCP. Hero Producto B + cross-link Producto C. BottomNav 5 ítems. |
| 2 | Click "Inicio" → "Liga" en BottomNav. | Llega a `/comunidad`. Si no logueado, ve premio S/1,250 + CTA registrarse. |
| 3 | Click "Partidos" en BottomNav. | Llega a `/cuotas`. Lista de partidos con cuotas comparator. |
| 4 | Click un partido. | Llega a `/partidos/[slug]`. Ve `<PartidoHero>` + cuotas + `<PickBloqueadoSeccion>` (teaser Premium) + `<LigaWidgetInline>` cross-link. |
| 5 | Click "Ir a la Liga Habla!" en cross-link. | Llega a `/comunidad/torneo/[slug]`. Middleware redirige a `/auth/signin?redirect=…`. |
| 6 | Click "Continuar con Google" en signin. | OAuth flow. Tras éxito, redirige a `/auth/completar-perfil` para elegir @username. |
| 7 | Elegir un @username válido (3-15 chars alfanuméricos). | Redirige a la URL original (`/comunidad/torneo/[slug]`). Estado: Free. |
| 8 | Hacer una predicción 1X2 + BTTS + +2.5 + roja + marcador. | Cada `<MarketRow>` valida input. Botón "Guardar predicción" se activa cuando los 5 mercados están completos. |
| 9 | Click "Guardar predicción". | Toast verde "Predicción guardada". Vuelve al partido con estado "Predicción guardada". |
| 10 | Ir a `/mis-predicciones`. | Aparece la predicción recién guardada en tab "Activas". |

**Pasa si:** ningún paso bloquea, el LCP de cada vista es < 2.5s, no hay errores en consola.

---

## B. Flujo Free → Premium (suscripción)

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Como usuario Free del flujo A, ir a `/premium`. | Landing crítica con `<WhatsAppChannelMockup>` + `<PlanesPremium>` + sticky CTA. |
| 2 | Seleccionar plan Trimestral (S/89). | Sticky CTA actualiza al plan elegido. |
| 3 | Click sticky CTA "Suscribirme". | Llega a `/premium/checkout` con `<PlanResumen>` y `<OpenPayForm>`. |
| 4 | Completar form con tarjeta sandbox: `4111 1111 1111 1111` · CVV `110` · MM/AA `12/30` · titular cualquier nombre. | OpenPay.js tokeniza client-side. NO se envía PAN/CVV al backend (verificar en DevTools Network: el body al server action `procesarCheckout` solo lleva el token + deviceSessionId). |
| 5 | Click "Pagar S/ 89". | Loading spinner. Tras 3-8s redirige a `/premium/exito?suscripcion=<id>` (vía OpenPay). |
| 6 | En `/premium/exito` ver el modo "verificando". | Polling cada 3s a `/api/v1/suscripciones/me` durante max 60s. Webhook OpenPay debe haber llegado. |
| 7 | Tras `Suscripcion.estado=ACTIVA`, ver el `<UnirseChannelBigCTA>`. | Botón verde "Unirse al Channel privado de Habla! Picks". |
| 8 | Click el CTA → abre WhatsApp con `WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK`. | Usuario ingresa al Channel privado. |
| 9 | Verificar email de bienvenida en su inbox. | Email `BienvenidaPremium` desde `premium@hablaplay.com`. Footer con Línea Tugar 0800-19009. |
| 10 | Verificar email factura. | Email `FacturaPremium` con monto, plan, próximo cobro. |

**Pasa si:** cero datos de tarjeta llegaron al backend, webhook OpenPay actualizó la suscripción a ACTIVA, ambos emails llegaron, botón Channel funciona.

**Tarjetas sandbox OpenPay (ambiente sandbox):**
- ✅ Aprobada: `4111 1111 1111 1111` cvv `110`
- ❌ Declinada: `4000 0000 0000 0002` cvv `200`
- ⚠️ Insuficientes: `4242 4242 4242 4242` cvv `300`

---

## C. Flujo Premium → recibe pick

> **Pre-requisito:** usuario test del flujo B unido al Channel + admin con sesión `/admin/picks-premium`.

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Como admin, ir a `/admin/picks-premium`. | Vista 2 paneles con cola pestaña "Pendiente". |
| 2 | Si no hay picks PENDIENTES, dispararlos manualmente: `POST /api/v1/crons/generar-picks-premium` con `Bearer $CRON_SECRET`. | Job O genera hasta 3 picks vía Claude API + EV+ ≥5%. Aparecen en cola PENDIENTE. |
| 3 | Click un pick → panel derecho muestra razonamiento + cuota + stake + EV+. | Atajo `↑/↓` para navegar la cola. |
| 4 | Atajo `A` → modal "¿Aprobar pick?". | Modal con preview real WhatsApp via `formatearPickPremium` + watermark con email del editor. |
| 5 | Confirmar aprobación. | Toast verde "Pick aprobado y enviado". Distribución corre en background no bloqueante. |
| 6 | En el WhatsApp del usuario tester, llega el pick por mensaje 1:1. | Mensaje markdown WhatsApp con UTM links + watermark email. ≤ 1024 char. |
| 7 | En `/admin/channel-whatsapp` verificar que el pick aparece en "Últimos 20 picks enviados". | Tabla con timestamp + miembros alcanzados. |

**Pasa si:** el pick llega al WhatsApp del tester en ≤ 30s tras la aprobación.

---

## D. Flujo Premium → cancela suscripción

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Como usuario Premium ACTIVO, ir a `/premium/mi-suscripcion`. | Ve `<SuscripcionEstadoCard>` estado "Activa" + próxima renovación. |
| 2 | Click "Cancelar suscripción". | Modal honesto "Te vas a perder…". Confirmación requiere segundo click. |
| 3 | Confirmar cancelación. | Estado pasa a CANCELANDO. Toast amarillo "Cancelada — tu acceso continúa hasta [fecha vencimiento]". |
| 4 | Verificar que sigue recibiendo picks en el Channel + bot 1:1 hasta `vencimientoEn`. | Job Q (sync-membresia, cada 1h) lo deja UNIDO mientras `Suscripcion.vencimientoEn > NOW()`. |
| 5 | Click "Reactivar suscripción" antes del vencimiento. | Estado vuelve a ACTIVA sin nuevo cobro. |

**Pasa si:** cancelación es honesta, mantiene acceso hasta `vencimientoEn`, reactivación funciona.

---

## E. Flujo bot FAQ Premium

> **Pre-requisito:** usuario tester unido al Channel + activado al bot 1:1 (envió primer mensaje cualquiera).

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Tester escribe al WhatsApp Business de Habla! "Hola, ¿cuándo es el próximo pick?". | Bot responde en ≤ 5s con texto de Claude API. |
| 2 | Tester escribe "¿Cómo cancelo?". | Bot responde con instrucciones referenciando `/premium/mi-suscripcion`. |
| 3 | Tester escribe palabras de ludopatía: "no puedo dejar de apostar". | Bot detecta + deriva a humano + envía Línea Tugar 0800-19009. |
| 4 | Tester pregunta lo mismo 11 veces seguidas. | Después del 10º mensaje en una hora, bot retorna mensaje rate-limit. |

**Pasa si:** bot responde apropiadamente, detecta ludopatía, respeta rate limit 10 msg/hora/usuario.

---

## F. Flujo Liga Habla! mensual

> **Pre-requisito:** mes en curso con al menos 5 partidos top + algunos usuarios con predicciones.

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Como usuario logueado, predecir 5 partidos top del mes. | Acumula puntos en `Leaderboard`. |
| 2 | Ir a `/comunidad`. | Ve `<MisStatsMini>` + `<PremiosMensualesCard>` (10 premios, S/1,250 total) + `<LeaderboardMensualTable>` con su posición resaltada. |
| 3 | Esperar al cierre del mes (último día 23:59 PET) o forzarlo desde admin: `POST /api/v1/admin/leaderboard/cerrar-mes` con `Bearer $CRON_SECRET` (job J corre cada hora y detecta cierre). | Leaderboard del mes anterior se cierra. Top 10 reciben email "Solicitar datos para premio". |
| 4 | Como ganador top 1 (S/500), responder email con CCI + nombre + DNI. | Datos quedan en `PremioMensual.datosBancarios`. |
| 5 | Como admin en `/admin/premios-mensuales`, click "Marcar pagado" + adjuntar comprobante. | Estado pasa a PAGADO. Email `PremioMensualPagado` + WhatsApp template aprobado por Meta llega al ganador. |

**Pasa si:** cierre es idempotente, emails llegan, WhatsApp template envía correctamente.

---

## G. Flujo Admin operación

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Login como admin → ir a `/admin`. | Redirige a `/admin/dashboard`. Layout 1280px+ con sidebar 240px + topbar. Mobile (< 1280px) bloquea con `<MobileGuard>`. |
| 2 | Verificar 5 secciones KPI (Captación / Productos / Conversión / Retención / Económicos) + sistema semáforo + alarmas + selector de rango. | KPIs sin data manual aún muestran "—". |
| 3 | Click un KPI con drill-down → llegar a `/admin/kpis?metric=<id>`. | Line chart histórico SVG nativo + breakdown por dimensión + acciones sugeridas. |
| 4 | Ir a `/admin/cohortes`. | Heatmap CSS grid 12m × 7 buckets (D0/1/7/14/30/60/90) con 4 métricas seleccionables. |
| 5 | Ir a `/admin/mobile-vitals`. | 4 cards P75 LCP/INP/CLS/Lighthouse + 3 mini line charts + tabla rutas peor performance. |
| 6 | Ir a `/admin/finanzas`. | Revenue + MRR + costos editables + CAC/LTV + bar chart 12m. |
| 7 | Ir a `/admin/alarmas`. | Activas / config thresholds / histórico + crear-manual + desactivar con motivo. |
| 8 | Ir a `/admin/auditoria`. | Listing paginado 50/page con filtros entidad+actor+rango + modal expandible con metadata JSON. |
| 9 | Ir a `/admin/suscripciones`. | Listing paginado + filtros estado/plan/búsqueda + 4 stats. |
| 10 | Click una suscripción → detalle. | Historial pagos + acciones admin (cancelar inmediato override / reembolsar fuera garantía). |
| 11 | Ir a `/admin/channel-whatsapp`. | Stats membresía + gráfica engagement + alertas leak + botón "Forzar sync". |

**Pasa si:** todas las vistas cargan en < 1s, mobile bloqueado, atajos de teclado funcionan en /admin/picks-premium.

---

## Comandos útiles

```bash
# Disparar manualmente un cron desde local (NO recomendado pre-launch
# salvo para los smoke tests). Reemplazar $TOKEN por CRON_SECRET.
curl -H "Authorization: Bearer $TOKEN" https://hablaplay.com/api/v1/crons/generar-picks-premium
curl -H "Authorization: Bearer $TOKEN" https://hablaplay.com/api/v1/crons/sync-membresia-channel
curl -H "Authorization: Bearer $TOKEN" https://hablaplay.com/api/v1/crons/evaluar-alarmas

# Health check rápido
curl https://hablaplay.com/api/health

# Sitemap
curl https://hablaplay.com/sitemap.xml | head -40

# Robots
curl https://hablaplay.com/robots.txt
```

---

## Reporte de fallos

Cada fallo durante los smoke tests se reporta como:

```
SMOKE-LOTE-J · Flujo [A/B/C/D/E/F/G] · Paso #N
- Qué hice: [acción]
- Qué esperaba: [resultado esperado]
- Qué pasó: [resultado real]
- Severidad: bloqueante / mayor / menor
- Browser/device: Chrome 124 mobile / Safari iOS 17 / etc.
- URL: https://hablaplay.com/...
- Screenshot: [adjuntar]
```

Bloqueantes paran el lanzamiento del 8 mayo. Mayores deben fixearse < 24h. Menores se loguean para post-launch.
