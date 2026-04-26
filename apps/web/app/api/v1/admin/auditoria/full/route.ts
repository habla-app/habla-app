// GET /api/v1/admin/auditoria/full — Lote 6C-fix3.
//
// Auditoría completa del sistema de balances. Evalúa las 13 invariantes
// que el sistema de 3 bolsas debe cumplir y devuelve un reporte agregado
// + top 100 hallazgos. Para drill-down de un usuario específico, usar
// GET /api/v1/admin/auditoria/usuario/:id.
//
// Solo lectura — nunca muta. Costo aprox: ~10 queries agregadas en una
// roundtrip (groupBy nativo de Postgres). Para MVP-scale (<10k tx)
// completa en <1s.
//
// Guard: Authorization: Bearer <CRON_SECRET>

import { NextRequest } from "next/server";
import { auditarTodos } from "@/lib/services/auditoria-balances.service";
import { NoAutorizado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      throw new NoAutorizado("CRON_SECRET no configurado.");
    }
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new NoAutorizado("Secret inválido.");
    }

    const reporte = await auditarTodos();

    logger.info(
      {
        usuariosAuditados: reporte.totales.usuariosAuditados,
        torneosAuditados: reporte.totales.torneosAuditados,
        totalHallazgos: reporte.totalHallazgos,
        usuariosConProblemas: reporte.usuariosConProblemas,
        torneosConProblemas: reporte.torneosConProblemas,
        durationMs: reporte.durationMs,
      },
      "GET /api/v1/admin/auditoria/full",
    );

    return Response.json({ data: reporte });
  } catch (err) {
    logger.error({ err }, "GET /api/v1/admin/auditoria/full falló");
    return toErrorResponse(err);
  }
}
