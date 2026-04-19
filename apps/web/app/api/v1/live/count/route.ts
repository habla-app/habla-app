// GET /api/v1/live/count
//
// Endpoint barato para el badge "🔴 En vivo" del NavBar/BottomNav.
// Devuelve solo `{ count }` — sin ranking, sin pozos, sin include.
// Polling cada 30s desde el hook `useLiveMatchesCount`. Sub-Sprint 5
// Hotfix #5 (Bug #12): antes el badge mostraba "2" hardcodeado aunque
// no hubiera partidos.

import { contarLiveMatches } from "@/lib/services/live-matches.service";
import { toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export async function GET() {
  try {
    const count = await contarLiveMatches();
    return Response.json({ data: { count } });
  } catch (err) {
    logger.error({ err }, "GET /api/v1/live/count falló");
    return toErrorResponse(err);
  }
}
