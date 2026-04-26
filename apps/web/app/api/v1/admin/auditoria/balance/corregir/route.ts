// POST /api/v1/admin/auditoria/balance/corregir — Lote 6B-fix2.
//
// Para cada usuario donde balanceLukas != balanceCompradas + balanceBonus + balanceGanadas:
//   1. Establece balanceLukas = sumaBolsas dentro de $transaction.
//   2. Crea TransaccionLukas { tipo: AJUSTE } como registro de auditoría.
//   3. Log warn por usuario corregido.
//
// Guard: Authorization: Bearer <CRON_SECRET>
// Idempotente: usuarios ya correctos se ignoran.

import { NextRequest } from "next/server";
import { prisma } from "@habla/db";
import { NoAutorizado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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

    const corregidos = [];
    const refId = `auditoria-fix-${Date.now()}`;

    for (const u of usuarios) {
      const sumaBolsas = u.balanceCompradas + u.balanceBonus + u.balanceGanadas;
      const delta = sumaBolsas - u.balanceLukas;
      if (delta === 0) continue;

      await prisma.$transaction([
        prisma.usuario.update({
          where: { id: u.id },
          data: { balanceLukas: sumaBolsas },
        }),
        prisma.transaccionLukas.create({
          data: {
            usuarioId: u.id,
            tipo: "AJUSTE",
            monto: delta,
            descripcion: `Corrección de balance (auditoría): ${u.balanceLukas} → ${sumaBolsas}`,
            refId,
          },
        }),
      ]);

      logger.warn(
        {
          userId: u.id,
          username: u.username,
          deltaCorregido: delta,
          balanceAntes: u.balanceLukas,
          balanceDespues: sumaBolsas,
        },
        "auditoria/balance/corregir: usuario corregido",
      );

      corregidos.push({
        userId: u.id,
        username: u.username,
        deltaCorregido: delta,
        balanceAntes: u.balanceLukas,
        balanceDespues: sumaBolsas,
      });
    }

    logger.info(
      { usuariosAuditados: usuarios.length, corregidos: corregidos.length, refId },
      "POST /api/v1/admin/auditoria/balance/corregir completado",
    );

    return Response.json({
      data: {
        usuariosAuditados: usuarios.length,
        corregidos: corregidos.length,
        refId,
        detalle: corregidos,
      },
    });
  } catch (err) {
    logger.error({ err }, "POST /api/v1/admin/auditoria/balance/corregir falló");
    return toErrorResponse(err);
  }
}
