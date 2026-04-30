-- Lote 11 (May 2026) — Perfil público de tipsters.
--
-- Agregamos `perfilPublico` a `usuarios`. Default TRUE: cualquier usuario
-- existente queda visible bajo `/comunidad/[username]`. Quien quiera
-- opt-out lo puede hacer desde /perfil → Notificaciones / Privacidad.
--
-- Aditiva pura. No requiere backup pre-deploy (ver regla 2 de CLAUDE.md).

ALTER TABLE "usuarios"
  ADD COLUMN "perfilPublico" BOOLEAN NOT NULL DEFAULT TRUE;
