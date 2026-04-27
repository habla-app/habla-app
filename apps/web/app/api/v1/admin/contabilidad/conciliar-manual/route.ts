// POST /api/v1/admin/contabilidad/conciliar-manual — Lote 8.
//
// Body: { esperadoId, realId }. Marca la pareja como conciliada manualmente.
// Guard: Authorization: Bearer <CRON_SECRET>

import { NextRequest } from "next/server";
import { z } from "zod";
import { conciliarManual } from "@/lib/services/conciliacion-banco.service";
import {
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

const Body = z.object({
  esperadoId: z.string().min(1),
  realId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new NoAutorizado("CRON_SECRET no configurado.");
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new NoAutorizado("Secret inválido.");
    }

    const body = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Datos inválidos.", {
        issues: parsed.error.flatten(),
      });
    }

    const result = await conciliarManual(
      parsed.data.esperadoId,
      parsed.data.realId,
    );

    logger.info(
      { ...parsed.data },
      "POST /admin/contabilidad/conciliar-manual",
    );

    return Response.json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "POST /admin/contabilidad/conciliar-manual falló");
    return toErrorResponse(err);
  }
}
