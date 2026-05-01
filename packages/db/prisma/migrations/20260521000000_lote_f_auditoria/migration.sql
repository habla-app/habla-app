-- Lote F (May 2026) — Auditoría 100% en acciones admin destructivas.
--
-- Tabla `auditoria_admin` registra cada acción admin que muta estado:
-- aprobar/rechazar/editar pick, cancelar/reembolsar suscripción, marcar
-- premio pagado, etc. Un row por acción. Distinto de `log_errores` (que
-- registra errores) y `eventos_analitica` (que se sample-ea para producto):
-- auditoría nunca se sample-ea — regla 21 del CLAUDE.md.
--
-- Aditiva pura — no toca tablas existentes ni datos productivos.

CREATE TABLE "auditoria_admin" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "resumen" TEXT,
    "metadata" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_admin_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditoria_admin_creadoEn_idx" ON "auditoria_admin"("creadoEn" DESC);
CREATE INDEX "auditoria_admin_entidad_creadoEn_idx" ON "auditoria_admin"("entidad", "creadoEn" DESC);
CREATE INDEX "auditoria_admin_actorId_creadoEn_idx" ON "auditoria_admin"("actorId", "creadoEn" DESC);
