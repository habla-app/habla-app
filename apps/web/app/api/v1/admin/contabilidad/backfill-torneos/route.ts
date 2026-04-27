// POST /api/v1/admin/contabilidad/backfill-torneos — Lote 8.
//
// Para cada torneo FINALIZADO sin asiento CIERRE_TORNEO, genera el asiento
// retroactivo. Idempotente. Útil para sembrar el ledger en pre-producción
// con datos históricos de QA.
//
// Guard: Authorization: Bearer <CRON_SECRET>

import { NextRequest } from "next/server";
import { prisma } from "@habla/db";
import { registrarCierreTorneo } from "@/lib/services/contabilidad/contabilidad.service";
import { NoAutorizado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new NoAutorizado("CRON_SECRET no configurado.");
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new NoAutorizado("Secret inválido.");
    }

    const torneos = await prisma.torneo.findMany({
      where: { estado: "FINALIZADO" },
      select: { id: true, rake: true },
    });

    let creados = 0;
    let saltados = 0;
    let errores = 0;
    const detalle: Array<{ torneoId: string; resultado: string }> = [];

    for (const t of torneos) {
      try {
        const asiento = await registrarCierreTorneo(t.id);
        if (asiento) {
          creados++;
          detalle.push({ torneoId: t.id, resultado: "creado" });
        } else {
          saltados++;
          detalle.push({ torneoId: t.id, resultado: "ya_existe_o_sin_rake" });
        }
      } catch (err) {
        errores++;
        const msg = err instanceof Error ? err.message : "error";
        detalle.push({ torneoId: t.id, resultado: `error: ${msg}` });
        logger.error({ err, torneoId: t.id }, "backfill-torneos: error");
      }
    }

    logger.info(
      { totalTorneos: torneos.length, creados, saltados, errores },
      "POST /admin/contabilidad/backfill-torneos",
    );

    return Response.json({
      ok: true,
      data: {
        totalTorneos: torneos.length,
        creados,
        saltados,
        errores,
        detalle: detalle.slice(0, 100),
      },
    });
  } catch (err) {
    logger.error({ err }, "POST /admin/contabilidad/backfill-torneos falló");
    return toErrorResponse(err);
  }
}
