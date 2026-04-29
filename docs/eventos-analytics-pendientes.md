# Eventos analytics pendientes — input para Lote 6

> Snapshot de los eventos canónicos que estaban cableados a PostHog antes
> del Lote 1 (cleanup). PostHog se eliminó del proyecto; el reemplazo
> in-house se construye en el Lote 6. Este archivo es la lista maestra
> de qué eventos hay que volver a cablear (no se referencia desde el
> código).

## Eventos canónicos

| Evento | Dónde se disparaba | Props |
|---|---|---|
| `signup_started` | Mount `/auth/signup` (TrackOnMount) | `source` |
| `signup_completed` | POST signup ok (email) o mount completar-perfil (google) | `method` (email\|google) |
| `email_verified` | Magic link vuelta (email) o mount completar-perfil (google) | — |
| `profile_completed` | POST completar-perfil ok (google) o junto a signup (email) | — |
| `lukas_purchase_started` | Click pack en `/wallet` | `pack_id`, `amount` |
| `lukas_purchase_completed` | (pendiente Culqi) | `pack_id`, `amount_lukas`, `amount_soles` |
| `lukas_purchase_failed` | (pendiente Culqi) | `pack_id`, `reason` |
| `torneo_viewed` | Mount `/torneo/:id` (TrackOnMount) | `torneo_id`, `partido`, `pozo_actual`, `inscritos` |
| `torneo_inscripto` | POST inscribir ok / ComboModal sin placeholder | `torneo_id`, `ticket_id`, `costo_lukas`, `es_primer_ticket_usuario` |
| `ticket_submitted` | POST `/tickets` ok | `torneo_id`, `ticket_id`, `predicciones_completadas` |
| `premio_ganado` | Mount `/mis-combinadas` tab ganadas (dedup localStorage) | `torneo_id`, `posicion`, `lukas_ganados` |
| `canje_solicitado` | POST canjear ok | `premio_id`, `costo_lukas` |
| `tienda_viewed` | Mount `/tienda` (TrackOnMount) | — |
| `wallet_desglose_viewed` | Mount `WalletBalanceDesglose` en `/wallet` | `compradas`, `bonus`, `ganadas`, `total` |
| `tienda_canje_bloqueado_sin_ganadas` | `ModalSinGanadas` se abre (BALANCE_INSUFICIENTE) | `ganadas_actuales`, `coste_premio`, `deficit` |
| `tienda_sin_ganadas_cta_partidos_clicked` | Click "Ver partidos" en `ModalSinGanadas` | — |

## Política previa (referencia para reimplementación)

- `person_profiles: "identified_only"` — no perfilar anónimos.
- Rutas `/legal/*` opt-out: no capturar nada en esas rutas.
- `identify()` en callback de session authenticated; `reset()` en logout.
- Pageview manual en `usePathname` + `useSearchParams` (App Router no
  dispara `$pageview` automático).
- Respeto a `lib/cookie-consent.ts` — sin consent, no captura.

## Notas para Lote 6

- En el pivot post-Lote 1, varios eventos quedan obsoletos:
  - Lukas y tienda desaparecen → `lukas_purchase_*`, `canje_solicitado`,
    `tienda_*`, `wallet_desglose_viewed`, `premio_ganado`,
    `torneo_inscripto`, `ticket_submitted`, `torneo_viewed` se eliminan
    o cambian de semántica.
  - Sobreviven con la misma forma: `signup_started`, `signup_completed`,
    `email_verified`, `profile_completed`.
- Los eventos nuevos del modelo editorial / comunidad / afiliación
  MINCETUR se definen en el Lote 6, no acá.
