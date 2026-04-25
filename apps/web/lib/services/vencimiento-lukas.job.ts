// Job de vencimiento de Lukas — Lote 6A.
//
// Corre 1 vez al día (skip si ya corrió en las últimas 23h).
// Tres pasos en orden:
//   1. Vencimientos efectivos: compras cuyo `venceEn <= now` y `saldoVivo > 0`.
//      Descuenta balanceLukas + balanceCompradas y crea VENCIMIENTO.
//   2. Aviso 7d: compras que vencen en [now+7d, now+8d) sin `vencAvisado7d`.
//      Manda email y marca el flag.
//   3. Aviso 30d: ídem para [now+30d, now+31d) sin `vencAvisado30d`.
//
// Idempotente: los flags `vencAvisado30d/7d` evitan doble envío. Los
// vencimientos solo procesan rows con `saldoVivo > 0` — no re-vencan.

import { prisma } from "@habla/db";
import { logger } from "./logger";
import { notifyLukasVencidos, notifyLukasPorVencer } from "./notificaciones.service";

let lastRunAt: Date | null = null;

const MIN_INTERVAL_MS = 23 * 60 * 60 * 1000; // 23h

export interface VencimientoJobResult {
  vencidos: number;
  aviso7d: number;
  aviso30d: number;
  tiempoMs: number;
}

export async function vencimientoLukasJob(): Promise<VencimientoJobResult> {
  const now = new Date();

  if (lastRunAt && now.getTime() - lastRunAt.getTime() < MIN_INTERVAL_MS) {
    logger.debug("[vencimiento-lukas] skip — corrió hace menos de 23h");
    return { vencidos: 0, aviso7d: 0, aviso30d: 0, tiempoMs: 0 };
  }

  const startMs = Date.now();
  let vencidos = 0;
  let aviso7d = 0;
  let aviso30d = 0;

  // 1. Vencimientos efectivos
  const comprasVencidas = await prisma.transaccionLukas.findMany({
    where: {
      tipo: "COMPRA",
      saldoVivo: { gt: 0 },
      venceEn: { lte: now },
    },
    select: { id: true, usuarioId: true, saldoVivo: true, creadoEn: true },
  });

  for (const compra of comprasVencidas) {
    const monto = compra.saldoVivo ?? 0;
    if (monto <= 0) continue;
    try {
      await prisma.$transaction(async (tx) => {
        // Marcar compra como consumida
        await tx.transaccionLukas.update({
          where: { id: compra.id },
          data: { saldoVivo: 0 },
        });
        // Descontar de los balances
        await tx.usuario.update({
          where: { id: compra.usuarioId },
          data: {
            balanceCompradas: { decrement: monto },
            balanceLukas: { decrement: monto },
          },
        });
        // Crear TransaccionLukas.VENCIMIENTO
        await tx.transaccionLukas.create({
          data: {
            usuarioId: compra.usuarioId,
            tipo: "VENCIMIENTO",
            bolsa: "COMPRADAS",
            monto: -monto,
            descripcion: `Vencimiento de Lukas comprados`,
            refId: compra.id,
          },
        });
      });

      vencidos++;
      // Email fire-and-forget post-commit
      void notifyLukasVencidos({
        usuarioId: compra.usuarioId,
        monto,
        fechaCompra: compra.creadoEn,
      });
    } catch (err) {
      logger.error(
        { err, compraTxId: compra.id, usuarioId: compra.usuarioId },
        "[vencimiento-lukas] fallo al vencer compra",
      );
    }
  }

  // 2. Aviso 7d
  const window7dStart = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const window7dEnd = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

  const por7d = await prisma.transaccionLukas.findMany({
    where: {
      tipo: "COMPRA",
      saldoVivo: { gt: 0 },
      venceEn: { gte: window7dStart, lt: window7dEnd },
      vencAvisado7d: false,
    },
    select: { id: true, usuarioId: true, saldoVivo: true, venceEn: true },
  });

  for (const compra of por7d) {
    try {
      await prisma.transaccionLukas.update({
        where: { id: compra.id },
        data: { vencAvisado7d: true },
      });
      void notifyLukasPorVencer({
        usuarioId: compra.usuarioId,
        monto: compra.saldoVivo ?? 0,
        venceEn: compra.venceEn!,
        dias: 7,
      });
      aviso7d++;
    } catch (err) {
      logger.error({ err, compraTxId: compra.id }, "[vencimiento-lukas] fallo aviso 7d");
    }
  }

  // 3. Aviso 30d
  const window30dStart = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const window30dEnd = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);

  const por30d = await prisma.transaccionLukas.findMany({
    where: {
      tipo: "COMPRA",
      saldoVivo: { gt: 0 },
      venceEn: { gte: window30dStart, lt: window30dEnd },
      vencAvisado30d: false,
    },
    select: { id: true, usuarioId: true, saldoVivo: true, venceEn: true },
  });

  for (const compra of por30d) {
    try {
      await prisma.transaccionLukas.update({
        where: { id: compra.id },
        data: { vencAvisado30d: true },
      });
      void notifyLukasPorVencer({
        usuarioId: compra.usuarioId,
        monto: compra.saldoVivo ?? 0,
        venceEn: compra.venceEn!,
        dias: 30,
      });
      aviso30d++;
    } catch (err) {
      logger.error({ err, compraTxId: compra.id }, "[vencimiento-lukas] fallo aviso 30d");
    }
  }

  lastRunAt = now;
  const tiempoMs = Date.now() - startMs;

  if (vencidos > 0 || aviso7d > 0 || aviso30d > 0) {
    logger.info(
      { vencidos, aviso7d, aviso30d, tiempoMs },
      "[vencimiento-lukas] ciclo completado",
    );
  }

  return { vencidos, aviso7d, aviso30d, tiempoMs };
}
