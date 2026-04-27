// POST /api/v1/admin/contabilidad/cargar-extracto — Lote 8.
//
// Acepta un CSV multipart de extracto Interbank, parsea, inserta los
// movimientos no duplicados y ejecuta `conciliar()` automáticamente.
//
// Guard: Authorization: Bearer <CRON_SECRET>

import { NextRequest } from "next/server";
import { cargarExtractoCsv } from "@/lib/services/conciliacion-banco.service";
import {
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new NoAutorizado("CRON_SECRET no configurado.");
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new NoAutorizado("Secret inválido.");
    }

    const ct = req.headers.get("content-type") ?? "";
    let buf: Buffer;
    let archivoNombre: string;

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("archivo") as File | null;
      if (!file) {
        throw new ValidacionFallida("Falta el campo 'archivo' en el form.");
      }
      buf = Buffer.from(await file.arrayBuffer());
      archivoNombre = file.name || "extracto.csv";
    } else {
      // Fallback: body crudo CSV (útil para curl).
      const text = await req.text();
      buf = Buffer.from(text, "utf8");
      archivoNombre =
        req.headers.get("x-archivo-nombre") ?? "extracto-curl.csv";
    }

    const result = await cargarExtractoCsv(archivoNombre, buf);

    logger.info(
      {
        cargaId: result.cargaId,
        insertadas: result.filasInsertadas,
        duplicadas: result.filasDuplicadas,
        errores: result.filasError,
        conciliados: result.conciliacionPostCarga.conciliados,
      },
      "POST /admin/contabilidad/cargar-extracto",
    );

    return Response.json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "POST /admin/contabilidad/cargar-extracto falló");
    return toErrorResponse(err);
  }
}
