// POST /api/v1/admin/auditoria/mover-compradas-a-bonus
//
// Pre-producción: como Culqi todavía no está cableado, ningún usuario
// debería tener Lukas en bolsa COMPRADAS — todo el saldo no-premio es
// bonus. Pero el fallback legacy de torneos.service.cancelar() tiraba
// reembolsos de torneos cancelados pre-Lote 6A a balanceCompradas, lo
// que dejó residuales en algunos usuarios.
//
// Este endpoint, para cada usuario con balanceCompradas > 0:
//   1. Crea TransaccionLukas BONUS con monto = balanceCompradas (suma a la bolsa BONUS).
//   2. Crea TransaccionLukas AJUSTE con bolsa=COMPRADAS y monto = -balanceCompradas
//      (resta de la bolsa COMPRADAS para que sumTx_COMPRADAS quede en 0).
//   3. balanceCompradas → 0; balanceBonus += oldCompradas; balanceLukas no cambia.
//
// Idempotente: en una segunda corrida, balanceCompradas ya es 0 → skip.
//
// Guards:
//   - Bearer CRON_SECRET
//   - Body: { confirmacion: "MOVER_COMPRADAS_A_BONUS" }

import { NextRequest } from "next/server";
import { prisma } from "@habla/db";
import {
  DomainError,
  NoAutorizado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new NoAutorizado("CRON_SECRET no configurado.");
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new NoAutorizado("Secret inválido.");
    }

    const body = (await req.json().catch(() => ({}))) as {
      confirmacion?: string;
    };
    if (body.confirmacion !== "MOVER_COMPRADAS_A_BONUS") {
      throw new ValidacionFallida(
        "Falta confirmación literal en body. Enviá { confirmacion: 'MOVER_COMPRADAS_A_BONUS' }.",
      );
    }

    const refId = `mover-compradas-${Date.now()}`;

    const usuarios = await prisma.usuario.findMany({
      where: { deletedAt: null, balanceCompradas: { gt: 0 } },
      select: {
        id: true,
        username: true,
        balanceCompradas: true,
        balanceBonus: true,
      },
    });

    const detalle: Array<{
      userId: string;
      username: string;
      moverMonto: number;
      bonusAntes: number;
      bonusDespues: number;
    }> = [];

    for (const u of usuarios) {
      const monto = u.balanceCompradas;
      await prisma.$transaction([
        prisma.transaccionLukas.create({
          data: {
            usuarioId: u.id,
            tipo: "BONUS",
            bolsa: "BONUS",
            monto,
            descripcion: `Reasignación: compradas→bonus (testing pre-prod, sin Culqi aún)`,
            refId,
          },
        }),
        prisma.transaccionLukas.create({
          data: {
            usuarioId: u.id,
            tipo: "AJUSTE",
            bolsa: "COMPRADAS",
            monto: -monto,
            descripcion: `Reset compradas a 0 (testing pre-prod, sin Culqi aún)`,
            refId,
          },
        }),
        prisma.usuario.update({
          where: { id: u.id },
          data: {
            balanceCompradas: 0,
            balanceBonus: { increment: monto },
            // balanceLukas NO cambia (sigue siendo la suma de las 3).
          },
        }),
      ]);

      logger.warn(
        {
          userId: u.id,
          username: u.username,
          moverMonto: monto,
          bonusAntes: u.balanceBonus,
          bonusDespues: u.balanceBonus + monto,
          refId,
        },
        "auditoria/mover-compradas-a-bonus: usuario actualizado",
      );

      detalle.push({
        userId: u.id,
        username: u.username,
        moverMonto: monto,
        bonusAntes: u.balanceBonus,
        bonusDespues: u.balanceBonus + monto,
      });
    }

    logger.info(
      {
        usuariosTocados: detalle.length,
        refId,
      },
      "POST /api/v1/admin/auditoria/mover-compradas-a-bonus completado",
    );

    return Response.json({
      data: {
        usuariosTocados: detalle.length,
        refId,
        detalle,
      },
    });
  } catch (err) {
    if (!(err instanceof DomainError)) {
      logger.error(
        { err },
        "POST /api/v1/admin/auditoria/mover-compradas-a-bonus falló",
      );
    }
    return toErrorResponse(err);
  }
}
