// POST /api/v1/admin/contabilidad/ajuste-manual — Lote 8.
//
// Permite registrar un asiento de corrección manual con cuadre debe=haber.
// El service ya valida atómicamente; aquí solo parseamos el body.
//
// Guard: Authorization: Bearer <CRON_SECRET>

import { NextRequest } from "next/server";
import { z } from "zod";
import { registrarAjusteManual } from "@/lib/services/contabilidad/contabilidad.service";
import {
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

const Body = z.object({
  descripcion: z.string().min(1),
  origenId: z.string().optional().nullable(),
  lineas: z
    .array(
      z.object({
        codigo: z.string(),
        debe: z.number().min(0).optional(),
        haber: z.number().min(0).optional(),
        descripcion: z.string().optional(),
      }),
    )
    .min(2),
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

    const asiento = await registrarAjusteManual(
      parsed.data.lineas,
      parsed.data.descripcion,
      parsed.data.origenId ?? null,
    );

    logger.info(
      { asientoId: asiento.id, lineas: parsed.data.lineas.length },
      "POST /admin/contabilidad/ajuste-manual",
    );

    return Response.json({ ok: true, data: { asientoId: asiento.id } });
  } catch (err) {
    logger.error({ err }, "POST /admin/contabilidad/ajuste-manual falló");
    return toErrorResponse(err);
  }
}
