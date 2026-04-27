// POST /api/v1/admin/contabilidad/backfill-historico — Lote 8.
//
// Genera asientos contables retroactivos para TODA la historia que existe en
// BD pero que ocurrió antes del deploy del Lote 8. Idempotente — re-ejecutar
// no duplica asientos. Procesa en orden:
//
//   1. BONUS  → registrarBonusEmitido(usuarioId, monto, motivo, tx, origenId=txId)
//   2. COMPRA → registrarCompraLukasLegacy(usuarioId, txId, monto)
//   3. CIERRE_TORNEO → registrarCierreTorneo(torneoId)  (recalcula composición)
//   4. CANJE_APROBADO → registrarCanjeAprobado(canjeId)  para canjes en estado
//      != PENDIENTE (los pendientes aún no se reconocieron como ingreso).
//
// Filtros:
//   - NO discrimina por rol — el ADMIN cuenta como jugador normal.
//   - SÍ excluye usuarios soft-deleted (deletedAt != null) en BONUS/COMPRA.
//   - REEMBOLSO y AJUSTE no generan asientos (se contabilizan en su contexto).
//
// Guard: Authorization: Bearer <CRON_SECRET>

import { NextRequest } from "next/server";
import { prisma } from "@habla/db";
import {
  asegurarPlanDeCuentas,
  registrarBonusEmitido,
  registrarCompraLukasLegacy,
  registrarCierreTorneo,
  registrarCanjeAprobado,
  type MotivoBonus,
} from "@/lib/services/contabilidad/contabilidad.service";
import { NoAutorizado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

interface CategoriaResult {
  procesados: number;
  creados: number;
  saltados: number;
  errores: number;
}

interface BackfillResult {
  ok: boolean;
  bonus: CategoriaResult;
  compras: CategoriaResult;
  torneos: CategoriaResult;
  canjes: CategoriaResult;
  durationMs: number;
}

function inferirMotivo(descripcion: string): MotivoBonus {
  const d = descripcion.toLowerCase();
  if (d.includes("bienvenida")) return "bienvenida";
  if (d.includes("pack")) return "pack_bonus";
  return "manual";
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new NoAutorizado("CRON_SECRET no configurado.");
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new NoAutorizado("Secret inválido.");
    }

    // El plan de cuentas es prerrequisito (la apertura ya lo asegura, pero
    // por si alguien llama backfill antes que apertura).
    await asegurarPlanDeCuentas();

    const result: BackfillResult = {
      ok: true,
      bonus:   { procesados: 0, creados: 0, saltados: 0, errores: 0 },
      compras: { procesados: 0, creados: 0, saltados: 0, errores: 0 },
      torneos: { procesados: 0, creados: 0, saltados: 0, errores: 0 },
      canjes:  { procesados: 0, creados: 0, saltados: 0, errores: 0 },
      durationMs: 0,
    };

    // ========================================================================
    // 1. BONUS (TransaccionLukas tipo=BONUS — bienvenida + pack_bonus)
    // ========================================================================
    const bonusTxs = await prisma.transaccionLukas.findMany({
      where: {
        tipo: "BONUS",
        usuario: { deletedAt: null },
      },
      orderBy: { creadoEn: "asc" },
      select: { id: true, usuarioId: true, monto: true, descripcion: true },
    });

    for (const tx of bonusTxs) {
      result.bonus.procesados++;
      try {
        const asiento = await registrarBonusEmitido(
          tx.usuarioId,
          tx.monto,
          inferirMotivo(tx.descripcion),
          undefined,
          tx.id,
        );
        if (asiento) result.bonus.creados++;
        else result.bonus.saltados++;
      } catch (err) {
        result.bonus.errores++;
        logger.error({ err, txId: tx.id }, "backfill BONUS: error");
      }
    }

    // ========================================================================
    // 2. COMPRA (TransaccionLukas tipo=COMPRA — legacy sin packId)
    // ========================================================================
    const compraTxs = await prisma.transaccionLukas.findMany({
      where: {
        tipo: "COMPRA",
        usuario: { deletedAt: null },
      },
      orderBy: { creadoEn: "asc" },
      select: { id: true, usuarioId: true, monto: true },
    });

    for (const tx of compraTxs) {
      result.compras.procesados++;
      try {
        const asiento = await registrarCompraLukasLegacy(
          tx.usuarioId,
          tx.id,
          tx.monto,
        );
        if (asiento) result.compras.creados++;
        else result.compras.saltados++;
      } catch (err) {
        result.compras.errores++;
        logger.error({ err, txId: tx.id }, "backfill COMPRA: error");
      }
    }

    // ========================================================================
    // 3. CIERRE_TORNEO (Torneos FINALIZADOS — recalcula composición del rake)
    // ========================================================================
    const torneos = await prisma.torneo.findMany({
      where: { estado: "FINALIZADO" },
      select: { id: true },
      orderBy: { creadoEn: "asc" },
    });

    for (const t of torneos) {
      result.torneos.procesados++;
      try {
        const asiento = await registrarCierreTorneo(t.id);
        if (asiento) result.torneos.creados++;
        else result.torneos.saltados++;
      } catch (err) {
        result.torneos.errores++;
        logger.error({ err, torneoId: t.id }, "backfill CIERRE_TORNEO: error");
      }
    }

    // ========================================================================
    // 4. CANJE_APROBADO (canjes en estado != PENDIENTE)
    // ========================================================================
    const canjes = await prisma.canje.findMany({
      where: { estado: { not: "PENDIENTE" } },
      select: { id: true },
      orderBy: { creadoEn: "asc" },
    });

    for (const c of canjes) {
      result.canjes.procesados++;
      try {
        const asiento = await registrarCanjeAprobado(c.id);
        if (asiento) result.canjes.creados++;
        else result.canjes.saltados++;
      } catch (err) {
        result.canjes.errores++;
        logger.error({ err, canjeId: c.id }, "backfill CANJE: error");
      }
    }

    result.durationMs = Date.now() - t0;
    result.ok =
      result.bonus.errores +
        result.compras.errores +
        result.torneos.errores +
        result.canjes.errores ===
      0;

    logger.info(
      { ...result },
      "POST /admin/contabilidad/backfill-historico",
    );

    return Response.json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "backfill-historico falló");
    return toErrorResponse(err);
  }
}
