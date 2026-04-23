# CHANGELOG — Habla! App

Historial detallado de sub-sprints, hotfixes y features relevantes. El
contexto estratégico del producto vive en `CLAUDE.md` y `README.md`.

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
