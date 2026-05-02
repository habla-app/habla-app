// Servicio de auditoría admin — Lote F (May 2026).
//
// Registra cada acción admin que muta estado en la BD. Regla 21 del
// CLAUDE.md: "Auditoría 100% en acciones admin destructivas. Logs pueden
// samplearse, auditoría nunca."
//
// Diferencia con `analytics.service.ts`:
//   - analytics: eventos de producto/UX, sample-able, fire-and-forget,
//     pueden perderse en burst de tráfico.
//   - auditoría: acciones admin sensibles, NO sample-able, await obligatorio
//     antes de retornar éxito al admin. Si la insert falla, el caller debe
//     decidir abortar la mutación (idealmente envuelto en transacción) o
//     degradar y log critical.
//
// Uso típico:
//
//   await logAuditoria({
//     actorId: session.user.id,
//     actorEmail: session.user.email,
//     accion: "pick.aprobar",
//     entidad: "PickPremium",
//     entidadId: pick.id,
//     resumen: `Pick #${numero} aprobado y enviado al Channel`,
//     metadata: { partidoId: pick.partidoId, mercado: pick.mercado },
//   });

import { prisma, Prisma } from "@habla/db";
import { logger } from "./logger";

export interface LogAuditoriaInput {
  /** userId del admin. Null para crons one-shot (CRON_SECRET). */
  actorId?: string | null;
  /** Email del admin (snapshot para preservar trazabilidad si se elimina). */
  actorEmail?: string | null;
  /** Verbo + entidad. Ej: "pick.aprobar", "suscripcion.cancelar_inmediato". */
  accion: string;
  /** Nombre de la entidad mutada. Ej: "PickPremium". */
  entidad: string;
  /** ID del row mutado (cuando aplica). */
  entidadId?: string | null;
  /** Descripción breve human-readable. */
  resumen?: string | null;
  /** Diff o contexto. Ej: { motivo, ultimosCuatro }. */
  metadata?: Record<string, unknown> | null;
}

/**
 * Inserta el registro de auditoría. Lanza si falla — el caller decide qué
 * hacer (abortar la mutación o continuar con log critical).
 *
 * Excepción: si la BD se cae justo al auditar, log critical y NO lanza para
 * no bloquear el flujo crítico. La trazabilidad se pierde (hay un agujero)
 * pero el admin no se queda colgado. El log critical alimenta el cron de
 * alertas (Lote 6 / Lote G).
 */
export async function logAuditoria(input: LogAuditoriaInput): Promise<void> {
  try {
    await prisma.auditoriaAdmin.create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        accion: input.accion.slice(0, 100),
        entidad: input.entidad.slice(0, 100),
        entidadId: input.entidadId ?? null,
        resumen: input.resumen?.slice(0, 500) ?? null,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  } catch (err) {
    logger.error(
      { err, accion: input.accion, source: "auditoria:log" },
      "logAuditoria: persistencia falló (acción ejecutada sin trazabilidad)",
    );
    // No re-lanzamos: la mutación ya ocurrió, no tiene sentido bloquear al admin.
  }
}

// ---------------------------------------------------------------------------
// Lectura — para Lote G (vista /admin/auditoria) o consultas ad-hoc
// ---------------------------------------------------------------------------

export interface ListarAuditoriaInput {
  entidad?: string;
  actorId?: string;
  desde?: Date;
  hasta?: Date;
  page?: number;
  pageSize?: number;
}

export interface AuditoriaFila {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  accion: string;
  entidad: string;
  entidadId: string | null;
  resumen: string | null;
  metadata: unknown;
  creadoEn: Date;
}

export async function listarAuditoria(
  input: ListarAuditoriaInput = {},
): Promise<{ rows: AuditoriaFila[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, input.pageSize ?? 50));

  const where: Prisma.AuditoriaAdminWhereInput = {};
  if (input.entidad) where.entidad = input.entidad;
  if (input.actorId) where.actorId = input.actorId;
  if (input.desde || input.hasta) {
    where.creadoEn = {};
    if (input.desde) where.creadoEn.gte = input.desde;
    if (input.hasta) where.creadoEn.lte = input.hasta;
  }

  const [rows, total] = await Promise.all([
    prisma.auditoriaAdmin.findMany({
      where,
      orderBy: { creadoEn: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditoriaAdmin.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      actorEmail: r.actorEmail,
      accion: r.accion,
      entidad: r.entidad,
      entidadId: r.entidadId,
      resumen: r.resumen,
      metadata: r.metadata,
      creadoEn: r.creadoEn,
    })),
    total,
    page,
    pageSize,
  };
}
