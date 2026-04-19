// POST /api/v1/tickets
//
// Requiere sesión. Crea un ticket con las 5 predicciones en el torneo
// especificado. Sub-Sprint 4.
//
// Si el usuario tiene un ticket placeholder (predicciones default del
// Sub-Sprint 3), se actualiza en lugar de crear uno nuevo; caso
// contrario se crea y se descuenta la entrada del balance.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { crear } from "@/lib/services/tickets.service";
import { CrearTicketBodySchema } from "@/lib/services/tickets.schema";
import {
  NoAutenticado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { recalcularTorneo } from "@/lib/services/puntuacion.service";
import { emitirRankingUpdate } from "@/lib/realtime/emitters";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const body = await req.json().catch(() => ({}));
    const parsed = CrearTicketBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Predicciones inválidas.", {
        issues: parsed.error.flatten(),
      });
    }

    const result = await crear(session.user.id, parsed.data);

    // Fire-and-forget: si el partido ya empezó, un ticket nuevo modifica
    // el ranking — re-puntuarlo y emitir actualización. Lo hacemos fuera
    // del await del handler para que la respuesta HTTP sea rápida.
    setImmediate(() => {
      recalcularTorneo(parsed.data.torneoId)
        .then(() => emitirRankingUpdate(parsed.data.torneoId))
        .catch((err) =>
          logger.error(
            { err, torneoId: parsed.data.torneoId },
            "recalc tras crear ticket falló",
          ),
        );
    });

    return Response.json({ data: result }, { status: 201 });
  } catch (err) {
    logger.error({ err }, "POST /api/v1/tickets falló");
    return toErrorResponse(err);
  }
}
