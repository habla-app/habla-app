// GET /api/v1/admin/analytics/overview — Lote 6.
//
// Lectura agregada para /admin/dashboard. Devuelve en una respuesta:
//   - serie diaria de visitas (`$pageview`)
//   - serie diaria de registros (`signup_completed`)
//   - top 20 eventos del periodo
//   - funnel: $pageview → signup_completed → prediccion_enviada → casa_click_afiliado
//   - stats de errores últimas 24h (resumen para una card "salud")
//
// Auth: ADMIN o Bearer CRON_SECRET (mismo patrón que el resto de admin).

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  obtenerEventosTopPeriodo,
  obtenerFunnelConversion,
  obtenerRegistrosPorDia,
  obtenerVisitasPorDia,
} from "@/lib/services/analytics.service";
import { obtenerStatsErroresUltimas24h } from "@/lib/services/logs.service";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FUNNEL_EVENTOS = [
  "$pageview",
  "signup_completed",
  "prediccion_enviada",
  "casa_click_afiliado",
];

export async function GET(req: NextRequest) {
  try {
    // Auth: sesión ADMIN o Bearer CRON_SECRET.
    const session = await auth();
    const isAdmin = session?.user?.id && session.user.rol === "ADMIN";
    if (!isAdmin) {
      const secret = process.env.CRON_SECRET;
      if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
        if (!session?.user?.id) throw new NoAutenticado();
        throw new NoAutorizado("Sólo administradores pueden ver analytics.");
      }
    }

    const { searchParams } = new URL(req.url);
    const desdeStr = searchParams.get("desde");
    const hastaStr = searchParams.get("hasta");

    // Default: últimos 30 días.
    const hasta = hastaStr ? new Date(hastaStr) : new Date();
    const desde = desdeStr
      ? new Date(desdeStr)
      : new Date(hasta.getTime() - 30 * 24 * 60 * 60 * 1000);

    const rango = { desde, hasta };

    const [visitas, registros, topEventos, funnel, statsErrores] =
      await Promise.all([
        obtenerVisitasPorDia(rango),
        obtenerRegistrosPorDia(rango),
        obtenerEventosTopPeriodo(rango),
        obtenerFunnelConversion(rango, FUNNEL_EVENTOS),
        obtenerStatsErroresUltimas24h(),
      ]);

    return Response.json({
      data: {
        rango: {
          desde: desde.toISOString(),
          hasta: hasta.toISOString(),
        },
        visitas,
        registros,
        topEventos,
        funnel,
        statsErrores,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
