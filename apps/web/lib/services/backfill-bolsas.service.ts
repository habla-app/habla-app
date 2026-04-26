// Lote 6A: backfill de las 3 bolsas de Lukas.
//
// Versión service (usa el prisma compartido de @habla/db). Equivalente
// funcional al script packages/db/scripts/backfill-bolsas.ts, que está
// pensado para ejecución directa via tsx. Esta versión se expone via el
// endpoint admin POST /api/v1/admin/backfill/bolsas.
//
// Idempotente: si todas las txs ya tienen bolsa NOT NULL, retorna sin tocar nada.
// Fallback por divergencia: si la suma reconstruida != balanceLukas, asigna
// todo a balanceCompradas y borra bonus/ganadas.

import { prisma } from "@habla/db";
import { logger } from "./logger";

function bolsaPorTipo(
  tipo: string,
): "COMPRADAS" | "BONUS" | "GANADAS" {
  switch (tipo) {
    case "COMPRA":
      return "COMPRADAS";
    case "BONUS":
      return "BONUS";
    case "PREMIO_TORNEO":
      return "GANADAS";
    case "ENTRADA_TORNEO":
      return "COMPRADAS";
    case "CANJE":
      return "GANADAS";
    case "VENCIMIENTO":
      return "COMPRADAS";
    case "REEMBOLSO":
      return "COMPRADAS";
    default:
      return "COMPRADAS";
  }
}

export interface BackfillResult {
  usuariosProcesados: number;
  divergencias: number;
  fallbacks: number;
  txsActualizadas: number;
  tiempoMs: number;
}

export async function runBackfill(): Promise<BackfillResult> {
  const start = Date.now();

  const totalUsuarios = await prisma.usuario.count({ where: { deletedAt: null } });
  const txsSinBolsa = await prisma.transaccionLukas.count({
    where: { bolsa: null },
  });

  if (txsSinBolsa === 0 && totalUsuarios > 0) {
    logger.info({ totalUsuarios }, "backfill: ya corrió (todas las txs tienen bolsa) — skip");
    return {
      usuariosProcesados: 0,
      divergencias: 0,
      fallbacks: 0,
      txsActualizadas: 0,
      tiempoMs: Date.now() - start,
    };
  }

  logger.info({ totalUsuarios, txsSinBolsa }, "backfill: comenzando");

  let usuariosProcesados = 0;
  let divergencias = 0;
  let fallbacks = 0;
  let txsActualizadas = 0;

  // 1. Popular campo bolsa en todas las transacciones
  const todasLasTxs = await prisma.transaccionLukas.findMany({
    where: { bolsa: null },
    select: { id: true, tipo: true },
  });

  for (const tx of todasLasTxs) {
    await prisma.transaccionLukas.update({
      where: { id: tx.id },
      data: { bolsa: bolsaPorTipo(tx.tipo) },
    });
    txsActualizadas++;
  }

  // 2. Popular saldoVivo en transacciones COMPRA
  const comprasSinSaldoVivo = await prisma.transaccionLukas.findMany({
    where: {
      tipo: "COMPRA",
      saldoVivo: null,
      monto: { gt: 0 },
    },
    select: { id: true, monto: true },
  });

  for (const compra of comprasSinSaldoVivo) {
    await prisma.transaccionLukas.update({
      where: { id: compra.id },
      data: { saldoVivo: compra.monto },
    });
  }

  logger.info(
    { txsBolsaActualizadas: txsActualizadas, comprasSaldoVivo: comprasSinSaldoVivo.length },
    "backfill: txs actualizadas",
  );

  // 3. Reconstruir balances por usuario
  const usuarios = await prisma.usuario.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      balanceLukas: true,
      balanceCompradas: true,
      balanceBonus: true,
      balanceGanadas: true,
    },
  });

  for (const usuario of usuarios) {
    if (
      usuario.balanceCompradas !== 0 ||
      usuario.balanceBonus !== 0 ||
      usuario.balanceGanadas !== 0
    ) {
      usuariosProcesados++;
      continue;
    }
    if (usuario.balanceLukas === 0) {
      usuariosProcesados++;
      continue;
    }

    const txs = await prisma.transaccionLukas.findMany({
      where: { usuarioId: usuario.id },
      select: { tipo: true, monto: true },
    });

    let compradas = 0;
    let bonus = 0;
    let ganadas = 0;

    for (const tx of txs) {
      const bolsa = bolsaPorTipo(tx.tipo);
      if (bolsa === "COMPRADAS") compradas += tx.monto;
      else if (bolsa === "BONUS") bonus += tx.monto;
      else if (bolsa === "GANADAS") ganadas += tx.monto;
    }

    const sumaReconstruida = compradas + bonus + ganadas;

    if (
      sumaReconstruida !== usuario.balanceLukas ||
      compradas < 0 ||
      bonus < 0 ||
      ganadas < 0
    ) {
      divergencias++;
      fallbacks++;
      logger.warn(
        {
          usuarioId: usuario.id,
          balanceLukas: usuario.balanceLukas,
          reconstruido: { compradas, bonus, ganadas, suma: sumaReconstruida },
        },
        "backfill: divergencia — usando fallback (todo a balanceCompradas)",
      );
      compradas = usuario.balanceLukas;
      bonus = 0;
      ganadas = 0;
    }

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        balanceCompradas: compradas,
        balanceBonus: bonus,
        balanceGanadas: ganadas,
        balanceLukas: compradas + bonus + ganadas,
      },
    });

    usuariosProcesados++;
  }

  const tiempoMs = Date.now() - start;

  logger.info(
    { usuariosProcesados, divergencias, fallbacks, txsActualizadas, tiempoMs },
    "backfill: completado",
  );

  return { usuariosProcesados, divergencias, fallbacks, txsActualizadas, tiempoMs };
}
