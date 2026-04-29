// GET /api/v1/admin/afiliados/[id]/stats?periodo=7d|30d|90d — Lote 7.
//
// Devuelve clicks/conversiones/revenue agregados para alimentar la page
// /admin/afiliados/[id]. Default `periodo=30d`.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  obtenerStatsAfiliado,
  type PeriodoStats,
} from "@/lib/services/afiliacion.service";
import {
  NoAutenticado,
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PERIODOS_VALIDOS: ReadonlyArray<PeriodoStats> = ["7d", "30d", "90d"];

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado("Solo administradores.");
    }

    const periodoRaw = req.nextUrl.searchParams.get("periodo") ?? "30d";
    const periodo: PeriodoStats = PERIODOS_VALIDOS.includes(
      periodoRaw as PeriodoStats,
    )
      ? (periodoRaw as PeriodoStats)
      : "30d";

    const stats = await obtenerStatsAfiliado({ afiliadoId: params.id, periodo });
    if (!stats) {
      throw new ValidacionFallida("Afiliado no encontrado.", { id: params.id });
    }

    return Response.json({ data: { stats } });
  } catch (err) {
    logger.error(
      { err, afiliadoId: params.id, source: "api:admin-afiliados-stats" },
      "GET /api/v1/admin/afiliados/[id]/stats falló",
    );
    return toErrorResponse(err);
  }
}
