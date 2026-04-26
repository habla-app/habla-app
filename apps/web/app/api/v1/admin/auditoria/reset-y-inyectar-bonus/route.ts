// POST /api/v1/admin/auditoria/reset-y-inyectar-bonus
//
// Endpoint de uso EXCEPCIONAL — diseñado para fase pre-producción donde el
// admin necesita inyectar Lukas de prueba a todos los usuarios + sanear
// estados inconsistentes que dejaron fixes anteriores.
//
// Operación (atómica por usuario):
//   1. Borra todas las TransaccionLukas tipo AJUSTE del usuario (las
//      generadas por /balance/corregir y /recategorizar-bolsas son ruido
//      una vez aplicado el reset).
//   2. Recalcula sumTx por bolsa SIN AJUSTE (legítimas: BONUS, COMPRA,
//      ENTRADA_TORNEO, PREMIO_TORNEO, CANJE, REEMBOLSO, VENCIMIENTO).
//   3. Si sumTx_COMPRADAS < 0 (caso de descuentos pre-Lote 6A que salieron
//      mal de la bolsa COMPRADAS), crea una TransaccionLukas BONUS con
//      bolsa=BONUS y monto = |sumTx_COMPRADAS| que neutraliza el déficit.
//      balanceCompradas queda en 0; el monto se mueve a la bolsa BONUS
//      (que es donde estaba originalmente: el bonus de bienvenida mal
//      categorizado).
//   4. Crea TransaccionLukas BONUS con monto = `montoBonus` (default 100),
//      descripción "Bonus de testing".
//   5. Setea Usuario.balanceCompradas/Bonus/Ganadas/Lukas a los valores
//      resultantes.
//
// REQUISITOS DE EJECUCIÓN:
//   - Bearer CRON_SECRET en el header.
//   - Body JSON: { confirmacion: "INYECTAR_TEST_LUKAS", montoBonus?: 100 }
//     La confirmación literal evita ejecuciones accidentales.
//
// NO ES IDEMPOTENTE: corriéndolo dos veces, se inyectan 200 Lukas. El
// caller debe ser explícito y consciente. Cada ejecución se loggea.

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

interface UsuarioReseteado {
  userId: string;
  username: string;
  ajustesBorrados: number;
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
  /** Si las tx COMPRADAS sumaban negativo y se generó un BONUS compensador. */
  compensacionDeficitCompradas: number;
  bonusInyectado: number;
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
      montoBonus?: number;
    };
    if (body.confirmacion !== "INYECTAR_TEST_LUKAS") {
      throw new ValidacionFallida(
        "Falta confirmación literal en body. Enviá { confirmacion: 'INYECTAR_TEST_LUKAS' }.",
      );
    }
    const montoBonus = body.montoBonus ?? 100;
    if (!Number.isInteger(montoBonus) || montoBonus < 0 || montoBonus > 10000) {
      throw new ValidacionFallida(
        `montoBonus inválido: ${body.montoBonus}. Debe ser entero entre 0 y 10000.`,
      );
    }

    const refId = `reset-bonus-${Date.now()}`;

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

    const reseteados: UsuarioReseteado[] = [];
    const skippeados: Array<{ userId: string; username: string; razon: string }> = [];

    for (const u of usuarios) {
      // Guard countCompras (Lote 6C-fix5): saltea usuarios con compras
      // reales — el reset borra AJUSTE y recompone bolsas, que en
      // producción real podría destruir información de compras Culqi.
      const countCompras = await prisma.transaccionLukas.count({
        where: { usuarioId: u.id, tipo: "COMPRA" },
      });
      if (countCompras > 0) {
        skippeados.push({
          userId: u.id,
          username: u.username,
          razon: `Usuario tiene ${countCompras} TransaccionLukas tipo=COMPRA. NO se resetea — el endpoint es solo para pre-prod sin compras Culqi reales.`,
        });
        continue;
      }

      const resultado = await prisma.$transaction(async (tx) => {
        // 1. Borrar AJUSTE del usuario (ruido de fixes anteriores)
        const borrados = await tx.transaccionLukas.deleteMany({
          where: { usuarioId: u.id, tipo: "AJUSTE" },
        });

        // 2. Recalcular sumTx por bolsa (sin AJUSTE — ya borradas)
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
          // sinBolsa (tx pre-Lote 6A sin etiqueta): no la asignamos a
          // ninguna bolsa específica → se trata como sumCompradas
          // implícita por residual. Pero en la práctica, las únicas tx
          // sin bolsa que quedaron son las del legacy fallback de
          // cancelar (que sí van a COMPRADAS) — las contamos ahí.
          else sumCompradas += monto;
        }

        // 3. Si COMPRADAS dio negativo, generar BONUS compensador.
        //    Esto pasa para usuarios pre-Lote 6A donde el bonus de
        //    bienvenida estaba en bolsa COMPRADAS y luego se descontó
        //    de ahí. La realidad económica es que esos Lukas eran
        //    bonus, no compras — los compensamos como BONUS.
        let compensacionDeficitCompradas = 0;
        if (sumCompradas < 0) {
          compensacionDeficitCompradas = -sumCompradas;
          await tx.transaccionLukas.create({
            data: {
              usuarioId: u.id,
              tipo: "BONUS",
              bolsa: "BONUS",
              monto: compensacionDeficitCompradas,
              descripcion:
                "Compensación por bonus pre-Lote 6A categorizado como compradas",
              refId,
            },
          });
          sumBonus += compensacionDeficitCompradas;
          sumCompradas = 0;
        }

        // 4. Inyectar el bonus de testing
        if (montoBonus > 0) {
          await tx.transaccionLukas.create({
            data: {
              usuarioId: u.id,
              tipo: "BONUS",
              bolsa: "BONUS",
              monto: montoBonus,
              descripcion: `Bonus de testing pre-producción (+${montoBonus} Lukas)`,
              refId,
            },
          });
          sumBonus += montoBonus;
        }

        // 5. Persistir balances finales
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
          ajustesBorrados: borrados.count,
          despues: {
            balanceLukas: nuevoBalanceLukas,
            balanceCompradas: sumCompradas,
            balanceBonus: sumBonus,
            balanceGanadas: sumGanadas,
          },
          compensacionDeficitCompradas,
        };
      });

      logger.warn(
        {
          userId: u.id,
          username: u.username,
          ajustesBorrados: resultado.ajustesBorrados,
          antes: {
            balanceLukas: u.balanceLukas,
            balanceCompradas: u.balanceCompradas,
            balanceBonus: u.balanceBonus,
            balanceGanadas: u.balanceGanadas,
          },
          despues: resultado.despues,
          compensacionDeficitCompradas: resultado.compensacionDeficitCompradas,
          bonusInyectado: montoBonus,
          refId,
        },
        "auditoria/reset-y-inyectar-bonus: usuario reseteado",
      );

      reseteados.push({
        userId: u.id,
        username: u.username,
        ajustesBorrados: resultado.ajustesBorrados,
        antes: {
          balanceLukas: u.balanceLukas,
          balanceCompradas: u.balanceCompradas,
          balanceBonus: u.balanceBonus,
          balanceGanadas: u.balanceGanadas,
        },
        despues: resultado.despues,
        compensacionDeficitCompradas: resultado.compensacionDeficitCompradas,
        bonusInyectado: montoBonus,
      });
    }

    logger.info(
      {
        usuariosReseteados: reseteados.length,
        skippeados: skippeados.length,
        montoBonus,
        refId,
      },
      "POST /api/v1/admin/auditoria/reset-y-inyectar-bonus completado",
    );

    return Response.json({
      data: {
        usuariosReseteados: reseteados.length,
        skippeados: skippeados.length,
        montoBonus,
        refId,
        detalle: reseteados,
        skipDetalle: skippeados,
      },
    });
  } catch (err) {
    if (!(err instanceof DomainError)) {
      logger.error(
        { err },
        "POST /api/v1/admin/auditoria/reset-y-inyectar-bonus falló",
      );
    }
    return toErrorResponse(err);
  }
}
