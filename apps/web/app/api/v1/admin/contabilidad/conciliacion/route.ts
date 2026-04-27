// GET /api/v1/admin/contabilidad/conciliacion?mes=YYYY-MM — Lote 8.
// Datos para la vista admin de conciliación: cargas previas + conciliados +
// pendientes (esperados sin match + reales sin match).

import { NextRequest } from "next/server";
import { prisma } from "@habla/db";
import { NoAutorizado, toErrorResponse } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

function rangoMes(mes: string | null): { desde: Date; hasta: Date } | null {
  if (!mes) return null;
  const m = mes.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const anio = Number(m[1]);
  const numMes = Number(m[2]);
  return {
    desde: new Date(Date.UTC(anio, numMes - 1, 1)),
    hasta: new Date(Date.UTC(anio, numMes, 1)),
  };
}

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new NoAutorizado("CRON_SECRET no configurado.");
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new NoAutorizado("Secret inválido.");
    }

    const url = new URL(req.url);
    const rango = rangoMes(url.searchParams.get("mes"));
    const filterFecha = rango
      ? { gte: rango.desde, lt: rango.hasta }
      : undefined;

    const [cargas, conciliadosRaw, pendientesEsp, pendientesReal] = await Promise.all([
      prisma.cargaExtractoBanco.findMany({
        orderBy: { cargadoEn: "desc" },
        take: 20,
      }),
      prisma.movimientoBancoEsperado.findMany({
        where: {
          conciliadoConId: { not: null },
          ...(filterFecha ? { fecha: filterFecha } : {}),
        },
        include: { conciliadoCon: true, asiento: { select: { id: true, descripcion: true, origenTipo: true } } },
        orderBy: { fecha: "desc" },
        take: 200,
      }),
      prisma.movimientoBancoEsperado.findMany({
        where: { conciliadoConId: null },
        include: { asiento: { select: { id: true, descripcion: true, origenTipo: true } } },
        orderBy: { fecha: "asc" },
        take: 200,
      }),
      prisma.movimientoBancoReal.findMany({
        where: { esperados: { none: {} } },
        orderBy: { fecha: "asc" },
        take: 200,
      }),
    ]);

    return Response.json({
      ok: true,
      data: {
        cargas,
        conciliados: conciliadosRaw.map((c) => ({
          id: c.id,
          fecha: c.fecha,
          monto: c.monto.toString(),
          descripcion: c.descripcion,
          asiento: c.asiento,
          real: c.conciliadoCon
            ? {
                id: c.conciliadoCon.id,
                fecha: c.conciliadoCon.fecha,
                monto: c.conciliadoCon.monto.toString(),
                descripcion: c.conciliadoCon.descripcion,
              }
            : null,
        })),
        pendientesEsperados: pendientesEsp.map((e) => ({
          id: e.id,
          fecha: e.fecha,
          monto: e.monto.toString(),
          descripcion: e.descripcion,
          asiento: e.asiento,
        })),
        pendientesReales: pendientesReal.map((r) => ({
          id: r.id,
          fecha: r.fecha,
          monto: r.monto.toString(),
          descripcion: r.descripcion,
          referenciaBanco: r.referenciaBanco,
        })),
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
