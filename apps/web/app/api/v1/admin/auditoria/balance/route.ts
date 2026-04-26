// GET /api/v1/admin/auditoria/balance — Lote 6B-fix2.
//
// Audita que balanceLukas === balanceCompradas + balanceBonus + balanceGanadas
// para todos los usuarios activos. Solo lectura, idempotente.
//
// Guard: Authorization: Bearer <CRON_SECRET>
//
// Respuesta:
// {
//   usuariosAuditados: 150,
//   conDivergencia: 3,
//   divergencias: [{ userId, username, balanceLukasAlmacenado, sumaBolsas, delta, ... }]
// }

import { NextRequest } from "next/server";
import { prisma } from "@habla/db";
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

    const usuarios = await prisma.usuario.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        username: true,
        balanceLukas: true,
        balanceCompradas: true,
        balanceBonus: true,
        balanceGanadas: true,
      },
    });

    const divergencias = [];
    for (const u of usuarios) {
      const sumaBolsas = u.balanceCompradas + u.balanceBonus + u.balanceGanadas;
      const delta = u.balanceLukas - sumaBolsas;
      if (delta !== 0) {
        divergencias.push({
          userId: u.id,
          username: u.username,
          balanceLukasAlmacenado: u.balanceLukas,
          sumaBolsas,
          delta,
          balanceCompradas: u.balanceCompradas,
          balanceBonus: u.balanceBonus,
          balanceGanadas: u.balanceGanadas,
        });
      }
    }

    logger.info(
      { usuariosAuditados: usuarios.length, conDivergencia: divergencias.length },
      "GET /api/v1/admin/auditoria/balance",
    );

    return Response.json({
      data: {
        usuariosAuditados: usuarios.length,
        conDivergencia: divergencias.length,
        divergencias,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /api/v1/admin/auditoria/balance falló");
    return toErrorResponse(err);
  }
}
