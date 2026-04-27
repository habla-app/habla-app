// POST /api/v1/admin/contabilidad/apertura — Lote 8.
//
// Registra el asiento de apertura del sistema contable (Capital Habla
// → Caja-Banco). Idempotente: si ya existe, no hace nada.
//
// Guard: Authorization: Bearer <CRON_SECRET>

import { NextRequest } from "next/server";
import { z } from "zod";
import {
  registrarApertura,
  asegurarPlanDeCuentas,
} from "@/lib/services/contabilidad/contabilidad.service";
import {
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

const Body = z.object({
  montoInicial: z.number().positive(),
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

    await asegurarPlanDeCuentas();
    const asiento = await registrarApertura(parsed.data.montoInicial);

    logger.info(
      {
        montoInicial: parsed.data.montoInicial,
        asientoId: asiento?.id ?? null,
        skipped: asiento === null,
      },
      "POST /admin/contabilidad/apertura",
    );

    return Response.json({
      ok: true,
      data: {
        creado: asiento !== null,
        asientoId: asiento?.id ?? null,
      },
    });
  } catch (err) {
    logger.error({ err }, "POST /admin/contabilidad/apertura falló");
    return toErrorResponse(err);
  }
}
