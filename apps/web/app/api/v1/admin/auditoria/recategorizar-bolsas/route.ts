// POST /api/v1/admin/auditoria/recategorizar-bolsas — Lote 6C-fix3 Fase 1.
//
// Corrige el bug histórico donde el bonus de bienvenida (15 Lukas) terminó
// en `balanceCompradas` en lugar de `balanceBonus` para usuarios creados
// antes del Lote 6A o por backfills antiguos.
//
// ESTRATEGIA (segura solo si I1 e I2 cuadran — verificalo con
// /admin/auditoria/full antes de correr):
//
// Para cada usuario activo:
//   1. balanceBonus    = SUM(tx.monto WHERE bolsa=BONUS)
//   2. balanceGanadas  = SUM(tx.monto WHERE bolsa=GANADAS)
//   3. balanceCompradas = balanceLukas - balanceBonus - balanceGanadas
//      (residual: lo que no es bonus ni ganadas son compradas, por
//      definición. Esto cuadra siempre que la suma total esté bien.)
//   4. Si delta != 0 en alguna bolsa → crea TransaccionLukas AJUSTE
//      con descripción de la recategorización.
//
// Idempotente: corriéndolo dos veces, en la segunda corrida los deltas
// son 0 y no hace nada.
//
// El total balanceLukas nunca se modifica — solo se REORDENA internamente
// entre las 3 bolsas. La suma del usuario queda igual.
//
// Guard: Authorization: Bearer <CRON_SECRET>

import { NextRequest } from "next/server";
import { prisma } from "@habla/db";
import { NoAutorizado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

interface RecategorizadoDetalle {
  userId: string;
  username: string;
  antes: {
    balanceCompradas: number;
    balanceBonus: number;
    balanceGanadas: number;
  };
  despues: {
    balanceCompradas: number;
    balanceBonus: number;
    balanceGanadas: number;
  };
  /** balanceLukas total — no debería cambiar. */
  balanceLukas: number;
  deltas: {
    deltaCompradas: number;
    deltaBonus: number;
    deltaGanadas: number;
  };
}

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

    // Suma de tx por usuario+bolsa en una sola query agregada.
    const aggBolsa = await prisma.transaccionLukas.groupBy({
      by: ["usuarioId", "bolsa"],
      _sum: { monto: true },
    });
    const sumPorUsuarioBolsa = new Map<
      string,
      { COMPRADAS: number; BONUS: number; GANADAS: number; sinBolsa: number }
    >();
    for (const r of aggBolsa) {
      const entry = sumPorUsuarioBolsa.get(r.usuarioId) ?? {
        COMPRADAS: 0,
        BONUS: 0,
        GANADAS: 0,
        sinBolsa: 0,
      };
      const monto = r._sum.monto ?? 0;
      if (r.bolsa === "COMPRADAS") entry.COMPRADAS += monto;
      else if (r.bolsa === "BONUS") entry.BONUS += monto;
      else if (r.bolsa === "GANADAS") entry.GANADAS += monto;
      else entry.sinBolsa += monto;
      sumPorUsuarioBolsa.set(r.usuarioId, entry);
    }

    const refId = `recategorizacion-${Date.now()}`;
    const recategorizados: RecategorizadoDetalle[] = [];
    const skippeados: Array<{ userId: string; username: string; razon: string }> = [];

    for (const u of usuarios) {
      // Guard countCompras (Lote 6C-fix5): saltea usuarios con compras
      // reales — la recategorización reescribe `balanceCompradas` como
      // residual, lo que destruye el saldo verdadero comprado con Culqi.
      const countCompras = await prisma.transaccionLukas.count({
        where: { usuarioId: u.id, tipo: "COMPRA" },
      });
      if (countCompras > 0) {
        skippeados.push({
          userId: u.id,
          username: u.username,
          razon: `Usuario tiene ${countCompras} TransaccionLukas tipo=COMPRA. NO se recategoriza — el endpoint es solo para pre-prod sin compras Culqi reales.`,
        });
        continue;
      }

      // Sanity check: si I1 ya falla para este user (balanceLukas != suma bolsas),
      // NO lo recategorizamos — ese caso requiere el endpoint /balance/corregir
      // primero, no este. Skippeamos con razón explícita.
      const sumaBolsasActual =
        u.balanceCompradas + u.balanceBonus + u.balanceGanadas;
      if (u.balanceLukas !== sumaBolsasActual) {
        skippeados.push({
          userId: u.id,
          username: u.username,
          razon: `I1 viola: balanceLukas ${u.balanceLukas} != suma bolsas ${sumaBolsasActual}. Corregir con /balance/corregir antes.`,
        });
        continue;
      }

      const sumas = sumPorUsuarioBolsa.get(u.id) ?? {
        COMPRADAS: 0,
        BONUS: 0,
        GANADAS: 0,
        sinBolsa: 0,
      };

      // Nuevos valores: bonus y ganadas se setean a la suma exacta de tx
      // marcadas con esa bolsa. Compradas es el residual del total.
      const nuevoBonus = sumas.BONUS;
      const nuevoGanadas = sumas.GANADAS;
      const nuevoCompradas = u.balanceLukas - nuevoBonus - nuevoGanadas;

      // Sanity adicional: las nuevas bolsas deben ser >= 0.
      if (nuevoCompradas < 0 || nuevoBonus < 0 || nuevoGanadas < 0) {
        skippeados.push({
          userId: u.id,
          username: u.username,
          razon: `Recategorización daría bolsas negativas (compradas=${nuevoCompradas}, bonus=${nuevoBonus}, ganadas=${nuevoGanadas}). Requiere análisis manual.`,
        });
        continue;
      }

      const deltaCompradas = nuevoCompradas - u.balanceCompradas;
      const deltaBonus = nuevoBonus - u.balanceBonus;
      const deltaGanadas = nuevoGanadas - u.balanceGanadas;

      if (deltaCompradas === 0 && deltaBonus === 0 && deltaGanadas === 0) {
        // Ya está bien recategorizado — idempotencia.
        continue;
      }

      await prisma.$transaction([
        prisma.usuario.update({
          where: { id: u.id },
          data: {
            balanceCompradas: nuevoCompradas,
            balanceBonus: nuevoBonus,
            balanceGanadas: nuevoGanadas,
            // balanceLukas NO cambia — solo redistribuimos.
          },
        }),
        prisma.transaccionLukas.create({
          data: {
            usuarioId: u.id,
            tipo: "AJUSTE",
            // monto=0 porque el balance total no cambia; solo es un audit log.
            monto: 0,
            descripcion: `Recategorización de bolsas: compradas ${u.balanceCompradas}→${nuevoCompradas}, bonus ${u.balanceBonus}→${nuevoBonus}, ganadas ${u.balanceGanadas}→${nuevoGanadas}`,
            refId,
          },
        }),
      ]);

      logger.warn(
        {
          userId: u.id,
          username: u.username,
          deltaCompradas,
          deltaBonus,
          deltaGanadas,
        },
        "auditoria/recategorizar-bolsas: usuario recategorizado",
      );

      recategorizados.push({
        userId: u.id,
        username: u.username,
        antes: {
          balanceCompradas: u.balanceCompradas,
          balanceBonus: u.balanceBonus,
          balanceGanadas: u.balanceGanadas,
        },
        despues: {
          balanceCompradas: nuevoCompradas,
          balanceBonus: nuevoBonus,
          balanceGanadas: nuevoGanadas,
        },
        balanceLukas: u.balanceLukas,
        deltas: { deltaCompradas, deltaBonus, deltaGanadas },
      });
    }

    logger.info(
      {
        usuariosAuditados: usuarios.length,
        recategorizados: recategorizados.length,
        skippeados: skippeados.length,
        refId,
      },
      "POST /api/v1/admin/auditoria/recategorizar-bolsas completado",
    );

    return Response.json({
      data: {
        usuariosAuditados: usuarios.length,
        recategorizados: recategorizados.length,
        skippeados: skippeados.length,
        refId,
        detalle: recategorizados,
        skipDetalle: skippeados,
      },
    });
  } catch (err) {
    logger.error(
      { err },
      "POST /api/v1/admin/auditoria/recategorizar-bolsas falló",
    );
    return toErrorResponse(err);
  }
}
