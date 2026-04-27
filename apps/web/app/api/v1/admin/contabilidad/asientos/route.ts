// GET /api/v1/admin/contabilidad/asientos?desde=&hasta=&page= — Lote 8.
// Libro diario paginado, cronológico desc.

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

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Number(url.searchParams.get("limit") ?? "50"));
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");

    const where: Record<string, unknown> = {};
    if (desde || hasta) {
      const f: Record<string, Date> = {};
      if (desde) f.gte = new Date(desde);
      if (hasta) f.lte = new Date(hasta);
      where.fecha = f;
    }

    const [asientos, total] = await Promise.all([
      prisma.asiento.findMany({
        where,
        include: {
          lineas: {
            include: { cuenta: { select: { codigo: true, nombre: true } } },
          },
        },
        orderBy: { fecha: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.asiento.count({ where }),
    ]);

    return Response.json({
      ok: true,
      data: {
        asientos: asientos.map((a) => ({
          id: a.id,
          fecha: a.fecha,
          origenTipo: a.origenTipo,
          origenId: a.origenId,
          descripcion: a.descripcion,
          totalDebe: a.totalDebe.toString(),
          totalHaber: a.totalHaber.toString(),
          lineas: a.lineas.map((l) => ({
            id: l.id,
            codigo: l.cuenta.codigo,
            cuenta: l.cuenta.nombre,
            debe: l.debe.toString(),
            haber: l.haber.toString(),
            descripcion: l.descripcion,
          })),
        })),
        total,
        page,
        limit,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
