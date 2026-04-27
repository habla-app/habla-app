// GET /api/v1/admin/contabilidad/ingresos — Lote 8.
// Lee del ledger filtrando por origenTipo IN (CIERRE_TORNEO, CANJE_APROBADO)
// y agrupa por mes. Reemplaza las tablas dedicadas IngresoRake/IngresoCanje
// que no se crearon (fuente única = ledger).

import { NextRequest } from "next/server";
import { prisma } from "@habla/db";
import { NoAutorizado, toErrorResponse } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

interface MesAgregado {
  mes: string; // "2026-04"
  rake: number;
  canjes: number;
  igvGenerado: number;
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new NoAutorizado("CRON_SECRET no configurado.");
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new NoAutorizado("Secret inválido.");
    }

    const asientos = await prisma.asiento.findMany({
      where: { origenTipo: { in: ["CIERRE_TORNEO", "CANJE_APROBADO"] } },
      include: { lineas: { include: { cuenta: { select: { codigo: true } } } } },
      orderBy: { fecha: "desc" },
    });

    const porMes = new Map<string, MesAgregado>();

    for (const a of asientos) {
      const mes = ymd(a.fecha);
      const acc = porMes.get(mes) ?? { mes, rake: 0, canjes: 0, igvGenerado: 0 };
      for (const l of a.lineas) {
        const haber = Number(l.haber.toString());
        if (l.cuenta.codigo === "7010") acc.rake += haber;
        if (l.cuenta.codigo === "7020") acc.canjes += haber;
        if (l.cuenta.codigo === "4040") acc.igvGenerado += haber;
      }
      porMes.set(mes, acc);
    }

    const meses = Array.from(porMes.values()).sort((a, b) =>
      a.mes < b.mes ? 1 : -1,
    );

    return Response.json({ ok: true, data: { meses } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
