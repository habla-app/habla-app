// POST /api/v1/admin/odds/refresh — Lote 9.
//
// Dispara una corrida del cron N a demanda. Casos de uso:
//   - Smoke post-deploy: poblar el cache antes de los próximos 30min sin
//     esperar al primer tick automático.
//   - Forzar refresh tras agregar un Afiliado nuevo o un mapping de
//     bookmaker (BOOKMAKER_MAPPING en el service).
//
// Auth: dos modos aceptados (cualquiera basta):
//   - Sesión ADMIN (cookie de NextAuth).
//   - Header `Authorization: Bearer <CRON_SECRET>` para llamadas curl.
//
// Body: ninguno (POST con body vacío). Responde 200 con resumen.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { ejecutarCronOdds } from "@/lib/services/odds-cache.service";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; /* api-football puede tardar ~10s/partido × 20 */

export async function POST(req: NextRequest) {
  try {
    // Auth: sesión ADMIN o Bearer CRON_SECRET. Mismo patrón que
    // /api/v1/admin/leaderboard/cerrar.
    const session = await auth();
    const isAdmin = session?.user?.id && session.user.rol === "ADMIN";
    if (!isAdmin) {
      const secret = process.env.CRON_SECRET;
      if (!secret) {
        throw new NoAutorizado(
          "CRON_SECRET no configurado y sin sesión ADMIN.",
        );
      }
      if (req.headers.get("authorization") !== `Bearer ${secret}`) {
        if (!session?.user?.id) throw new NoAutenticado();
        throw new NoAutorizado(
          "Solo administradores o Bearer CRON_SECRET pueden forzar refresh de odds.",
        );
      }
    }

    const resumen = await ejecutarCronOdds();
    logger.info(resumen, "POST /api/v1/admin/odds/refresh");

    return Response.json({ data: resumen }, { status: 200 });
  } catch (err) {
    logger.error({ err }, "POST /api/v1/admin/odds/refresh falló");
    return toErrorResponse(err);
  }
}
