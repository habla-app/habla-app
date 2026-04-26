// POST /api/v1/admin/auditoria/reset-completo
//
// EXTREMADAMENTE DESTRUCTIVO — solo para pre-producción donde todos los
// usuarios son de testing. Para cada usuario:
//   1. DELETE Tickets         (perdés combinadas + posiciones + premios)
//   2. DELETE Canjes          (restituyendo +1 stock al Premio asociado)
//   3. DELETE TransaccionLukas (todo el historial de movimientos)
//   4. CREATE TransaccionLukas BONUS bienvenida (BONUS_BIENVENIDA_LUKAS)
//   5. UPDATE Usuario: balanceCompradas=0, balanceBonus=BONUS, balanceGanadas=0
//
// Después (una sola vez al final):
//   6. UPDATE TODOS los Torneos: pozoBruto=0, pozoNeto=0, rake=0,
//      totalInscritos=0. (Estados se preservan — torneos FINALIZADO/
//      CANCELADO siguen como están pero ya sin tickets ni pozo.)
//
// El usuario queda exactamente como recién creado: bonus de bienvenida
// y nada más.
//
// GUARD INMUTABLE: si CUALQUIER usuario tiene tipo=COMPRA, el endpoint
// ABORTA TODO antes de tocar nada — esta operación es incompatible con
// producción real con Culqi. No hay forma de forzarla en ese caso.
//
// Body: { confirmacion: "RESET_COMPLETO_TESTING" }
// Header: Bearer CRON_SECRET

import { NextRequest } from "next/server";
import { prisma } from "@habla/db";
import {
  DomainError,
  NoAutorizado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { BONUS_BIENVENIDA_LUKAS } from "@/lib/config/economia";

export const dynamic = "force-dynamic";

interface DetalleReset {
  userId: string;
  username: string;
  ticketsBorrados: number;
  canjesBorrados: number;
  transaccionesBorradas: number;
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
      incluirEliminados?: boolean;
    };
    if (body.confirmacion !== "RESET_COMPLETO_TESTING") {
      throw new ValidacionFallida(
        "Falta confirmación literal. Enviá { confirmacion: 'RESET_COMPLETO_TESTING' }.",
      );
    }
    const incluirEliminados = body.incluirEliminados === true;

    // Guard inmutable: si HAY compras Culqi reales en cualquier usuario,
    // abortamos todo. Este endpoint es incompatible con producción real.
    const totalCompras = await prisma.transaccionLukas.count({
      where: { tipo: "COMPRA" },
    });
    if (totalCompras > 0) {
      throw new DomainError(
        "RESET_BLOQUEADO_POR_COMPRAS",
        `Hay ${totalCompras} TransaccionLukas tipo=COMPRA en el sistema. Reset-completo NO se ejecuta — incompatible con producción real con Culqi.`,
        409,
        { totalCompras },
      );
    }

    const refId = `reset-completo-${Date.now()}`;

    // Lote 6C-fix6: si `incluirEliminados=true`, ampliamos el scope a usuarios
    // soft-deleted. Para esos NO inyectamos bonus de bienvenida (están
    // eliminados, no deberían tener saldo) — solo borramos sus tickets/
    // tx/canjes para que la auditoría no los vea como ruido. Guard
    // countCompras > 0 ya descartó usuarios con compras Culqi (también
    // los soft-deleted con compras).
    const usuarios = await prisma.usuario.findMany({
      where: incluirEliminados ? {} : { deletedAt: null },
      select: { id: true, username: true, deletedAt: true },
    });

    const detalle: DetalleReset[] = [];

    for (const u of usuarios) {
      const resultado = await prisma.$transaction(async (tx) => {
        // 1. Borrar Tickets del usuario
        const tickets = await tx.ticket.deleteMany({
          where: { usuarioId: u.id },
        });

        // 2. Restituir stock por canjes activos (todos los estados ≠ CANCELADO).
        //    Usamos findMany + update agrupado por premioId para no
        //    incrementar 1 stock al pedo si ya estaba CANCELADO (que ya
        //    debería haber restituido al cancelar).
        const canjesActivos = await tx.canje.findMany({
          where: {
            usuarioId: u.id,
            estado: { not: "CANCELADO" },
          },
          select: { id: true, premioId: true },
        });
        const stockPorPremio = new Map<string, number>();
        for (const c of canjesActivos) {
          stockPorPremio.set(c.premioId, (stockPorPremio.get(c.premioId) ?? 0) + 1);
        }
        for (const [premioId, cantidad] of stockPorPremio) {
          await tx.premio.update({
            where: { id: premioId },
            data: { stock: { increment: cantidad } },
          });
        }

        // Borrar TODOS los canjes del usuario (CANCELADO incluido — ya no
        // sirven para audit en pre-prod).
        const canjes = await tx.canje.deleteMany({
          where: { usuarioId: u.id },
        });

        // 3. Borrar TransaccionLukas
        const transacciones = await tx.transaccionLukas.deleteMany({
          where: { usuarioId: u.id },
        });

        // Lote 6C-fix6: solo inyectamos bonus + reseteamos balances
        // si el usuario está activo. Soft-deleted: lo dejamos vacío.
        const esActivo = u.deletedAt === null;
        const bonusInyectado = esActivo ? BONUS_BIENVENIDA_LUKAS : 0;

        if (esActivo) {
          // 4. Inyectar bonus de bienvenida limpio
          await tx.transaccionLukas.create({
            data: {
              usuarioId: u.id,
              tipo: "BONUS",
              bolsa: "BONUS",
              monto: BONUS_BIENVENIDA_LUKAS,
              descripcion: "Bonus de bienvenida (post reset-completo)",
              refId,
            },
          });

          // 5. Resetear balances a estado de cuenta nueva
          await tx.usuario.update({
            where: { id: u.id },
            data: {
              balanceCompradas: 0,
              balanceBonus: BONUS_BIENVENIDA_LUKAS,
              balanceGanadas: 0,
              balanceLukas: BONUS_BIENVENIDA_LUKAS,
            },
          });
        } else {
          // Soft-deleted: balances en 0, sin bonus.
          await tx.usuario.update({
            where: { id: u.id },
            data: {
              balanceCompradas: 0,
              balanceBonus: 0,
              balanceGanadas: 0,
              balanceLukas: 0,
            },
          });
        }

        return {
          ticketsBorrados: tickets.count,
          canjesBorrados: canjes.count,
          transaccionesBorradas: transacciones.count,
          bonusInyectado,
          esActivo,
        };
      });

      logger.warn(
        {
          userId: u.id,
          username: u.username,
          ticketsBorrados: resultado.ticketsBorrados,
          canjesBorrados: resultado.canjesBorrados,
          transaccionesBorradas: resultado.transaccionesBorradas,
          bonusInyectado: resultado.bonusInyectado,
          esActivo: resultado.esActivo,
          refId,
        },
        "auditoria/reset-completo: usuario reseteado",
      );

      detalle.push({
        userId: u.id,
        username: u.username,
        ticketsBorrados: resultado.ticketsBorrados,
        canjesBorrados: resultado.canjesBorrados,
        transaccionesBorradas: resultado.transaccionesBorradas,
        bonusInyectado: resultado.bonusInyectado,
      });
    }

    // 6. Resetear contadores de TODOS los torneos (una sola query masiva).
    //    Estados se preservan — los FINALIZADOS/CANCELADOS quedan sin
    //    tickets ni pozo, lo cual es coherente con el reset.
    const torneosUpdated = await prisma.torneo.updateMany({
      data: {
        pozoBruto: 0,
        pozoNeto: 0,
        rake: 0,
        totalInscritos: 0,
      },
    });

    logger.info(
      {
        usuariosReseteados: detalle.length,
        torneosReseteados: torneosUpdated.count,
        bonusBienvenida: BONUS_BIENVENIDA_LUKAS,
        incluirEliminados,
        refId,
      },
      "POST /api/v1/admin/auditoria/reset-completo completado",
    );

    return Response.json({
      data: {
        usuariosReseteados: detalle.length,
        torneosReseteados: torneosUpdated.count,
        bonusBienvenida: BONUS_BIENVENIDA_LUKAS,
        incluirEliminados,
        refId,
        detalle,
      },
    });
  } catch (err) {
    if (!(err instanceof DomainError)) {
      logger.error(
        { err },
        "POST /api/v1/admin/auditoria/reset-completo falló",
      );
    }
    return toErrorResponse(err);
  }
}
