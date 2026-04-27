// GET /api/v1/admin/contabilidad/auditoria/historial — Lote 8.
// Últimos 30 rows de AuditoriaContableLog.

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

    const rows = await prisma.auditoriaContableLog.findMany({
      orderBy: { fechaIntento: "desc" },
      take: 30,
    });

    return Response.json({ ok: true, data: { rows } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
