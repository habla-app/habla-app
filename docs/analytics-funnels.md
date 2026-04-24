# Analytics — Funnels y Cohortes

> Documento de referencia del Lote 2. La configuración práctica vive en el
> proyecto PostHog `habla-production` — este archivo describe cómo armar
> cada funnel / cohorte paso a paso.

## Eventos canónicos

Nombres exactos, implementados vía `apps/web/lib/analytics.ts`. Fuente única de verdad — si se suma uno nuevo, agregarlo primero al `EventName` union y luego llamar `track(...)`.

| Evento | Cuándo | Propiedades clave |
|---|---|---|
| `$pageview` | Cambio de ruta (App Router manual) | `$current_url` |
| `signup_started` | Mount de `/auth/signup` | `source` (callbackUrl o `direct`) |
| `signup_completed` | POST `/auth/signup` ok (email) o mount de `/auth/completar-perfil` (google) | `method` (`email` \| `google`) |
| `email_verified` | Click en magic link (email) o mount de completar-perfil (google) | — |
| `profile_completed` | POST `/auth/completar-perfil` ok (google) o junto con signup_completed (email) | — |
| `lukas_purchase_started` | Click en pack card en `/wallet` | `pack_id`, `amount` (soles) |
| `lukas_purchase_completed` | ⏳ SS2 Culqi — acreditación OK | `pack_id`, `amount_lukas`, `amount_soles` |
| `lukas_purchase_failed` | ⏳ SS2 Culqi — cargo rechazado | `pack_id`, `reason` |
| `torneo_viewed` | Mount de `/torneo/[id]` | `torneo_id`, `partido`, `pozo_actual`, `inscritos` |
| `torneo_inscripto` | POST `/torneos/:id/inscribir` ok o ComboModal sin placeholder | `torneo_id`, `ticket_id`, `costo_lukas`, `es_primer_ticket_usuario` |
| `ticket_submitted` | POST `/tickets` ok en ComboModal | `torneo_id`, `ticket_id`, `predicciones_completadas` (0-5) |
| `premio_ganado` | Mount de `/mis-combinadas` tab "ganadas" (dedupe por ticketId en localStorage) | `torneo_id`, `posicion`, `lukas_ganados` |
| `canje_solicitado` | POST `/premios/:id/canjear` ok | `premio_id`, `costo_lukas` |
| `tienda_viewed` | Mount de `/tienda` | — |

## Funnels

### Funnel de activación

Mide cuántos visitantes completan su primer flujo end-to-end hasta armar un ticket.

Pasos (conversion window: **7 días**):

1. `$pageview` con `$current_url` conteniendo `/` (home) o `/matches`
2. `signup_started`
3. `signup_completed`
4. `email_verified`
5. `profile_completed`
6. `torneo_viewed`
7. `torneo_inscripto`
8. `ticket_submitted`

**Breakdown sugerido:** `method` (email vs google) en paso 3 para medir preferencia y drop-off por canal.

### Funnel de monetización

Mide el embudo de compra de Lukas y su uso en torneos.

Pasos (conversion window: **3 días**):

1. `lukas_purchase_started`
2. `lukas_purchase_completed`
3. `torneo_inscripto`

**Breakdown sugerido:** `pack_id` en paso 1. Nos dice qué pack atrae más clicks y cuál convierte mejor. Visible en el dashboard una vez SS2 esté live.

## Cohortes sugeridas

Configurar como *static cohorts* (se recalculan cada 24h). Todas usan la misma persona ID (userId tras `identify`).

### 1. Pagadores activos últimos 30d

- Realizaron `lukas_purchase_completed` al menos 1 vez en los últimos 30 días.
- Uso: retargeting con notificaciones, tracking de LTV.

### 2. Registrados sin primer ticket

- Hicieron `signup_completed` hace más de 24h.
- NO hicieron `ticket_submitted` nunca.
- Uso: campaña de reactivación — email con torneo sugerido, bonus extra.

### 3. Jugadores > 3 torneos

- `torneo_inscripto` realizado más de 3 veces en total.
- Uso: segmentar power users, base para features avanzadas (ligas privadas v1.1).

### 4. Abandonos en wallet (opcional)

- `lukas_purchase_started` ≥ 1 vez.
- `lukas_purchase_completed` = 0 veces.
- Gap > 1h.
- Uso: medir fricción del flow de pago tras SS2.

## Privacy y opt-outs

- PostHog no inicializa si `NEXT_PUBLIC_POSTHOG_KEY` no está presente o `NODE_ENV !== "production"`.
- `person_profiles: "identified_only"` — los visitantes anónimos no consumen cuota.
- Rutas `/legal/*` (llegan en Lote 3) quedan excluidas a nivel helper.
- Logout llama `reset()` — el anonId siguiente no se linkea al usuario anterior.
