// GET /api/v1/admin/auditoria/usuario/:id — Lote 6C-fix3.
//
// Drill-down: devuelve el detalle completo de balances + transacciones
// + hallazgos de un solo usuario. Útil cuando el scan masivo
// (/admin/auditoria/full) reporta problemas y se necesita investigar
// un caso específico.
//
// Guard: Authorization: Bearer <CRON_SECRET>

import { NextRequest } from "next/server";
import { auditarUsuario } from "@/lib/services/auditoria-balances.service";
import {
  DomainError,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

interface Context {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: Context) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      throw new NoAutorizado("CRON_SECRET no configurado.");
    }
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new NoAutorizado("Secret inválido.");
    }

    const reporte = await auditarUsuario(params.id);
    if (!reporte) {
      throw new DomainError(
        "USUARIO_NO_ENCONTRADO",
        `No existe el usuario ${params.id}.`,
        404,
        { usuarioId: params.id },
      );
    }

    logger.info(
      {
        usuarioId: params.id,
        username: reporte.usuario.username,
        hallazgos: reporte.hallazgos.length,
      },
      "GET /api/v1/admin/auditoria/usuario/:id",
    );

    return Response.json({ data: reporte });
  } catch (err) {
    logger.error(
      { err, usuarioId: params.id },
      "GET /api/v1/admin/auditoria/usuario/:id falló",
    );
    return toErrorResponse(err);
  }
}
