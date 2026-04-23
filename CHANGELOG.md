# CHANGELOG — Habla! App

Historial detallado de sub-sprints, hotfixes y features relevantes. El
contexto estratégico del producto vive en `CLAUDE.md` y `README.md`.

## 2026-04-23 — Leaderboards semanales + minuto en vivo simplificado

- **Sidebar de /matches:** widget "Ya ganaron en la semana" →
  **"Los Pozos más grandes de la semana"** (torneos cuyo partido cae en la
  semana calendario, TOP 5 por `pozoBruto`). Widget "Top de la Semana" →
  **"Los más pagados de la semana"** (suma de `TransaccionLukas.monto`
  con tipo `PREMIO_TORNEO` por usuario, TOP 10). Nuevo helper
  `datetime.ts:getWeekBounds` (lunes 00:00 → domingo 23:59 America/Lima).
- **/live-match minuto:** `getMinutoLabel({ statusShort, minuto, extra })`
  reemplaza `formatMinutoLabel/renderMinutoLabel`. Copy simplificado
  (`"Medio tiempo"`, `"Final"`, `"Por iniciar"`, `"TE {minuto}'"`). Se
  propaga `fixture.status.extra` desde api-football al cache, al payload
  `RankingUpdatePayload` (`minutoExtra`) y a los endpoints REST — ahora
  el hero muestra `45+3'` durante injury time.
- `useMinutoEnVivo` sigue avanzando el reloj local solo en 1H/2H/ET y
  congela el label en HT/BT/NS/FT/etc.

## 2026-04-23 — Registro formal con username + Google OAuth + rediseño `/perfil`

- **Auth formalizado:** dos rutas separadas (`/auth/signin`, `/auth/signup`)
  + `/auth/completar-perfil` para OAuth nuevo. Google provider agregado a
  NextAuth v5 (magic link sigue vivo). `username` pasa a NOT NULL + único;
  nuevo flag `usernameLocked` + timestamp `tycAceptadosAt` en el schema.
  Middleware bloquea `(main)` si el @handle aún es temporal. Endpoints
  nuevos: `GET /auth/username-disponible`, `POST /auth/signup`, `POST
  /auth/completar-perfil`.
- **`/perfil` reescrito desde cero:** alineado 1:1 con
  `docs/habla-mockup-completo.html`. Servicios, endpoints y modelos
  preservados. `username` ahora es read-only (inmutable post-registro).
  `PATCH /usuarios/me` dejó de aceptar `username`.
- **Migración destructiva:** reset local y prod acordados. Migration
  `20260423000000_registro_formal_username` marca la nueva constraint.
