// POST /api/v1/admin/torneos/:id/reconciliar
//
// Requiere rol ADMIN. Hotfix #7 Bug #20.
//
// Usado para reparar torneos FINALIZADOS que quedaron con puntos viejos
// o sin crédito de Lukas. Ejemplo: Alianza Atlético vs Sport Boys cerró
// antes del deploy del Hotfix #6, los tickets tienen puntos incompletos
// y el ganador no recibió sus Lukas.
//
// `reconciliarTorneoFinalizado`:
//   1. Recalcula puntos con el motor actual (Hotfix #6 proyectivo).
//   2. Recomputa distribución con la curva top-heavy.
//   3. Acredita deltas a los usuarios que tenían menos acreditado que
//      el expected (puede ser 0 para ya pagados, o el premio completo
//      para torneos que nunca fueron acreditados — caso típico del
//      bug reportado).
//   4. Actualiza `Ticket.posicionFinal` + `Ticket.premioLukas`.
//
// Idempotente: correrlo dos veces seguidas sólo ajusta deltas >0. La
// segunda corrida tiene `yaAcreditado === expected` para todos y delta=0.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { reconciliarTorneoFinalizado } from "@/lib/services/ranking.service";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

interface Context {
  params: { id: string };
}

export async function POST(_req: NextRequest, { params }: Context) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden reconciliar torneos.",
      );
    }

    const data = await reconciliarTorneoFinalizado(params.id);
    return Response.json({ data });
  } catch (err) {
    logger.error(
      { err, torneoId: params.id },
      "POST /api/v1/admin/torneos/:id/reconciliar falló",
    );
    return toErrorResponse(err);
  }
}
