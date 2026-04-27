// GET /api/v1/admin/contabilidad/balance-general — Lote 8.
// Devuelve el plan de cuentas con saldoActual agrupado por tipo. Usado
// por la vista SSR `/admin/contabilidad`.

import { NextRequest } from "next/server";
import { prisma } from "@habla/db";
import { NoAutorizado, toErrorResponse } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new NoAutorizado("CRON_SECRET no configurado.");
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new NoAutorizado("Secret inválido.");
    }

    const cuentas = await prisma.cuentaContable.findMany({
      orderBy: { codigo: "asc" },
    });

    return Response.json({
      ok: true,
      data: { cuentas: cuentas.map((c) => ({
        ...c,
        saldoActual: c.saldoActual.toString(),
      })) },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
