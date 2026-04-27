// POST /api/v1/admin/contabilidad/auditoria/ejecutar — Lote 8.
// Dispara `ejecutarAuditoria()` ad-hoc. NO persiste en AuditoriaContableLog
// (eso lo hace Job I). Útil para validación post-deploy.

import { NextRequest } from "next/server";
import { ejecutarAuditoria } from "@/lib/services/auditoria-contable.service";
import { NoAutorizado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new NoAutorizado("CRON_SECRET no configurado.");
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new NoAutorizado("Secret inválido.");
    }

    const reporte = await ejecutarAuditoria();

    logger.info(
      {
        ok: reporte.ok,
        errores: reporte.errores,
        warns: reporte.warns,
        durationMs: reporte.durationMs,
      },
      "POST /admin/contabilidad/auditoria/ejecutar",
    );

    return Response.json({ ok: true, data: reporte });
  } catch (err) {
    logger.error({ err }, "auditoria/ejecutar falló");
    return toErrorResponse(err);
  }
}
