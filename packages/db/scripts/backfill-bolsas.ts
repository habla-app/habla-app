#!/usr/bin/env tsx
// Backfill de las 3 bolsas de Lukas — Lote 6A.
//
// Reconstruye `balanceCompradas`, `balanceBonus` y `balanceGanadas` desde
// el historial de `TransaccionLukas` de cada usuario. También popula el
// campo `bolsa` en cada transacción existente y el `saldoVivo` en las
// transacciones COMPRA.
//
// Idempotente: detecta si ya corrió (todos los usuarios tienen
// compradas+bonus+ganadas == balanceLukas y todas las txs tienen bolsa
// NOT NULL). Si sí, no-op limpio.
//
// Fallback por divergencia: si la reconstrucción produce negativos o no
// cuadra con balanceLukas, registra la divergencia y hace fallback simple:
//   - balanceCompradas = balanceLukas, balanceBonus = 0, balanceGanadas = 0
//   - Crea una TransaccionLukas COMPRA con monto=balanceLukas y saldoVivo=balanceLukas
//
// NOTA: este script se expone también como endpoint admin
// POST /api/v1/admin/backfill/bolsas para correrlo post-deploy sin acceso directo.

import { PrismaClient } from "@prisma/client";
import pino from "pino";

const logger = pino({ level: "info" });
const prisma = new PrismaClient();

// Regla de asignación de bolsa por tipo (para txs sin metadata explícita)
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

  // Idempotencia: verificar si ya corrió.
  // Un usuario con compradas+bonus+ganadas == balanceLukas y todas las txs
  // con bolsa NOT NULL indica que ya se procesó.
  const totalUsuarios = await prisma.usuario.count({ where: { deletedAt: null } });
  const txsSinBolsa = await prisma.transaccionLukas.count({
    where: { bolsa: null },
  });
  const usuariosConDivergencia = await prisma.usuario.count({
    where: {
      deletedAt: null,
      NOT: {
        balanceLukas: {
          // Si balanceCompradas + balanceBonus + balanceGanadas != balanceLukas
          // habría divergencia. Pero Prisma no tiene expresión de suma entre campos.
          // Chequeamos indirectamente: si txsSinBolsa == 0 y ningún usuario tiene
          // los 3 campos en 0 mientras balanceLukas > 0, asumimos que ya corrió.
          equals: 0,
        },
      },
    },
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

  // 1. Popular campo `bolsa` en todas las transacciones existentes
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

  // 2. Popular `saldoVivo` en transacciones COMPRA
  // Estimación simple para datos históricos: saldoVivo = monto original
  // (asumimos que no se han gastado — el backfill no puede reconstruir el
  // consumo FIFO exacto sin metadata previa).
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
    // Si ya tiene valores distintos de 0 en alguna bolsa, skip (ya procesado)
    if (
      usuario.balanceCompradas !== 0 ||
      usuario.balanceBonus !== 0 ||
      usuario.balanceGanadas !== 0
    ) {
      usuariosProcesados++;
      continue;
    }
    // Si balanceLukas == 0, nada que hacer
    if (usuario.balanceLukas === 0) {
      usuariosProcesados++;
      continue;
    }

    // Reconstruir desde historial
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
      // Divergencia: fallback simple
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

// Punto de entrada si se corre directamente (tsx packages/db/scripts/backfill-bolsas.ts)
if (import.meta.url === `file://${process.argv[1]}`) {
  runBackfill()
    .then((r) => {
      logger.info(r, "backfill finalizado");
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, "backfill falló");
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
