// POST /api/v1/admin/contabilidad/reset-preview — Lote 8 §2.F.
//
// Limpia TODOS los datos contables de modo PREVIEW. Pensado para correr
// 1 sola vez justo antes del flip a producción (cuando llegan las creds
// Culqi reales y el flag `PAGOS_HABILITADOS` cambia a true).
//
// TRIPLE GUARD (todos deben pasar):
//   1. `pagosHabilitados()===false` — si el flag está ON, abortamos.
//   2. `count(TransaccionLukas where tipo='COMPRA') === 0` — si hay 1
//      sola compra Culqi real, abortamos.
//   3. `body.confirmacion === "RESET_PREVIEW_CONTABILIDAD"`.
//
// Idempotente: ejecutar dos veces seguidas no rompe nada.

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@habla/db";
import { pagosHabilitados } from "@/lib/feature-flags";
import {
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
  DomainError,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

const Body = z.object({
  confirmacion: z.literal("RESET_PREVIEW_CONTABILIDAD"),
});

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new NoAutorizado("CRON_SECRET no configurado.");
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new NoAutorizado("Secret inválido.");
    }

    // Guard #1: flag debe estar OFF.
    if (pagosHabilitados()) {
      throw new DomainError(
        "PAGOS_ACTIVOS",
        "PAGOS_HABILITADOS=true — el reset solo opera en modo PREVIEW. Es una vía de un solo sentido.",
        409,
      );
    }

    // Guard #2: cero compras Culqi reales en el sistema.
    const compras = await prisma.transaccionLukas.count({
      where: { tipo: "COMPRA" },
    });
    if (compras > 0) {
      throw new DomainError(
        "COMPRAS_REALES_PRESENTES",
        `Hay ${compras} TransaccionLukas tipo=COMPRA en el sistema. El reset abortó.`,
        409,
      );
    }

    // Guard #3: confirmación literal.
    const body = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida(
        'Falta la confirmación literal "RESET_PREVIEW_CONTABILIDAD".',
        { issues: parsed.error.flatten() },
      );
    }

    // Ejecutar limpieza atómica.
    const result = await prisma.$transaction(async (tx) => {
      const movEsp = await tx.movimientoBancoEsperado.deleteMany({});
      const movReal = await tx.movimientoBancoReal.deleteMany({});
      const cargas = await tx.cargaExtractoBanco.deleteMany({});
      const lineas = await tx.asientoLinea.deleteMany({});
      const asientos = await tx.asiento.deleteMany({});
      const audLogs = await tx.auditoriaContableLog.deleteMany({});
      // Resetear saldoActual de todas las cuentas a 0 (sin borrar el plan).
      await tx.cuentaContable.updateMany({
        data: { saldoActual: 0 },
      });
      return {
        asientosBorrados: asientos.count,
        lineasBorradas: lineas.count,
        movEsperadosBorrados: movEsp.count,
        movRealesBorrados: movReal.count,
        cargasBorradas: cargas.count,
        auditLogsBorrados: audLogs.count,
      };
    });

    logger.warn(
      { ...result },
      "POST /admin/contabilidad/reset-preview ejecutado",
    );

    return Response.json({ ok: true, data: result });
  } catch (err) {
    if (!(err instanceof DomainError)) {
      logger.error({ err }, "POST /admin/contabilidad/reset-preview falló");
    }
    return toErrorResponse(err);
  }
}
