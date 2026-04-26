// POST /api/v1/admin/auditoria/sanear-historial
//
// Endpoint EXCEPCIONAL pre-producción. Limpia el historial de transacciones
// para que sumTx por bolsa coincida con la realidad económica:
//
//   - Para usuarios SIN compras reales (countTx tipo=COMPRA == 0): toda
//     tx con bolsa=COMPRADAS se reasigna a BONUS, porque el descuento
//     económicamente salió del bonus de bienvenida (mal categorizado en
//     pre-Lote 6A) o de cualquier otro origen no-compra.
//
//   - Toda tx con bolsa=null (excepto AJUSTE) se reasigna a BONUS. Estas
//     vienen del bug del Lote 6C-fix2 (POST /tickets que descontaba
//     balanceLukas sin tocar las bolsas, lo que dejaba la TransaccionLukas
//     sin bolsa porque el flujo no se migró al sistema 6A).
//
//   - Borra todas las TransaccionLukas tipo=AJUSTE (residuales de fixes
//     anteriores como /balance/corregir).
//
//   - Recalcula los 4 balances del Usuario desde sumTx post-mutaciones.
//
// Resultado: I3, I4 (sumTx por bolsa == balance) cuadran. I1, I2 también.
// I9 sigue mostrando warns por ENTRADA_TORNEO sin metadata.composicion
// (son históricos, inofensivos).
//
// IMPORTANTE: este endpoint MUTA tx legítimas (cambia su bolsa). En
// producción real con compras reales NO se debería correr — el
// guard countTx_COMPRA==0 evita que toque usuarios con historia de
// compras reales.
//
// Body opcional `montoBonusExtra` (default 0): si > 0, inyecta una
// TransaccionLukas BONUS adicional con ese monto (útil para combinar
// saneo + carga de Lukas de testing en una sola operación).
//
// Guards:
//   - Bearer CRON_SECRET
//   - Body: { confirmacion: "SANEAR_HISTORIAL_PRE_PROD", montoBonusExtra?: 0 }

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

interface DetalleSaneo {
  userId: string;
  username: string;
  tieneCompras: boolean;
  ajustesBorrados: number;
  txReasignadasComprasABonus: number;
  txReasignadasSinBolsaABonus: number;
  bonusExtraInyectado: number;
  antes: {
    balanceLukas: number;
    balanceCompradas: number;
    balanceBonus: number;
    balanceGanadas: number;
  };
  despues: {
    balanceLukas: number;
    balanceCompradas: number;
    balanceBonus: number;
    balanceGanadas: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new NoAutorizado("CRON_SECRET no configurado.");
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new NoAutorizado("Secret inválido.");
    }

    const body = (await req.json().catch(() => ({}))) as {
      confirmacion?: string;
      montoBonusExtra?: number;
    };
    if (body.confirmacion !== "SANEAR_HISTORIAL_PRE_PROD") {
      throw new ValidacionFallida(
        "Falta confirmación literal. Enviá { confirmacion: 'SANEAR_HISTORIAL_PRE_PROD' }.",
      );
    }
    const montoBonusExtra = body.montoBonusExtra ?? 0;
    if (
      !Number.isInteger(montoBonusExtra) ||
      montoBonusExtra < 0 ||
      montoBonusExtra > 10000
    ) {
      throw new ValidacionFallida(
        `montoBonusExtra inválido: ${body.montoBonusExtra}. Debe ser entero entre 0 y 10000.`,
      );
    }

    const refId = `sanear-${Date.now()}`;

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

    const detalle: DetalleSaneo[] = [];

    for (const u of usuarios) {
      const resultado = await prisma.$transaction(async (tx) => {
        // 1. ¿El usuario tiene compras reales?
        const countCompras = await tx.transaccionLukas.count({
          where: { usuarioId: u.id, tipo: "COMPRA" },
        });
        const tieneCompras = countCompras > 0;

        // 2. Borrar todas sus AJUSTE
        const borrados = await tx.transaccionLukas.deleteMany({
          where: { usuarioId: u.id, tipo: "AJUSTE" },
        });

        // 3. Reasignar bolsas si NO tiene compras reales
        let reasignComprasBonus = { count: 0 };
        let reasignSinBolsaBonus = { count: 0 };
        if (!tieneCompras) {
          // 3a. tx con bolsa=COMPRADAS → BONUS
          reasignComprasBonus = await tx.transaccionLukas.updateMany({
            where: { usuarioId: u.id, bolsa: "COMPRADAS" },
            data: { bolsa: "BONUS" },
          });
          // 3b. tx con bolsa=null → BONUS (excluye AJUSTE ya borradas)
          reasignSinBolsaBonus = await tx.transaccionLukas.updateMany({
            where: { usuarioId: u.id, bolsa: null },
            data: { bolsa: "BONUS" },
          });
        }

        // 4. Inyectar bonus extra opcional
        if (montoBonusExtra > 0) {
          await tx.transaccionLukas.create({
            data: {
              usuarioId: u.id,
              tipo: "BONUS",
              bolsa: "BONUS",
              monto: montoBonusExtra,
              descripcion: `Bonus pre-prod testing (saneo, +${montoBonusExtra})`,
              refId,
            },
          });
        }

        // 5. Recalcular sumTx por bolsa post-mutaciones
        const aggBolsa = await tx.transaccionLukas.groupBy({
          by: ["bolsa"],
          where: { usuarioId: u.id },
          _sum: { monto: true },
        });
        let sumBonus = 0;
        let sumCompradas = 0;
        let sumGanadas = 0;
        for (const r of aggBolsa) {
          const monto = r._sum.monto ?? 0;
          if (r.bolsa === "BONUS") sumBonus += monto;
          else if (r.bolsa === "COMPRADAS") sumCompradas += monto;
          else if (r.bolsa === "GANADAS") sumGanadas += monto;
          // Si todavía hay sinBolsa (no debería tras paso 3), defaulteamos a BONUS
          else sumBonus += monto;
        }

        // 6. Persistir balances coherentes
        const nuevoBalanceLukas = sumCompradas + sumBonus + sumGanadas;
        await tx.usuario.update({
          where: { id: u.id },
          data: {
            balanceCompradas: sumCompradas,
            balanceBonus: sumBonus,
            balanceGanadas: sumGanadas,
            balanceLukas: nuevoBalanceLukas,
          },
        });

        return {
          tieneCompras,
          ajustesBorrados: borrados.count,
          txReasignadasComprasABonus: reasignComprasBonus.count,
          txReasignadasSinBolsaABonus: reasignSinBolsaBonus.count,
          despues: {
            balanceLukas: nuevoBalanceLukas,
            balanceCompradas: sumCompradas,
            balanceBonus: sumBonus,
            balanceGanadas: sumGanadas,
          },
        };
      });

      logger.warn(
        {
          userId: u.id,
          username: u.username,
          tieneCompras: resultado.tieneCompras,
          ajustesBorrados: resultado.ajustesBorrados,
          txReasignadasComprasABonus: resultado.txReasignadasComprasABonus,
          txReasignadasSinBolsaABonus: resultado.txReasignadasSinBolsaABonus,
          bonusExtraInyectado: montoBonusExtra,
          antes: {
            balanceLukas: u.balanceLukas,
            balanceCompradas: u.balanceCompradas,
            balanceBonus: u.balanceBonus,
            balanceGanadas: u.balanceGanadas,
          },
          despues: resultado.despues,
          refId,
        },
        "auditoria/sanear-historial: usuario saneado",
      );

      detalle.push({
        userId: u.id,
        username: u.username,
        tieneCompras: resultado.tieneCompras,
        ajustesBorrados: resultado.ajustesBorrados,
        txReasignadasComprasABonus: resultado.txReasignadasComprasABonus,
        txReasignadasSinBolsaABonus: resultado.txReasignadasSinBolsaABonus,
        bonusExtraInyectado: montoBonusExtra,
        antes: {
          balanceLukas: u.balanceLukas,
          balanceCompradas: u.balanceCompradas,
          balanceBonus: u.balanceBonus,
          balanceGanadas: u.balanceGanadas,
        },
        despues: resultado.despues,
      });
    }

    logger.info(
      {
        usuariosSaneados: detalle.length,
        montoBonusExtra,
        refId,
      },
      "POST /api/v1/admin/auditoria/sanear-historial completado",
    );

    return Response.json({
      data: {
        usuariosSaneados: detalle.length,
        montoBonusExtra,
        refId,
        detalle,
      },
    });
  } catch (err) {
    if (!(err instanceof DomainError)) {
      logger.error(
        { err },
        "POST /api/v1/admin/auditoria/sanear-historial falló",
      );
    }
    return toErrorResponse(err);
  }
}
