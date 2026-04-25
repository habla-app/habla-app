// POST /api/v1/tickets
//
// Requiere sesión. Crea un ticket con las 5 predicciones en el torneo
// especificado. Sub-Sprint 4.
//
// Si el usuario tiene un ticket placeholder (predicciones default del
// Sub-Sprint 3), se actualiza en lugar de crear uno nuevo; caso
// contrario se crea y se descuenta la entrada del balance.

import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
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

    // Invalidar el cache de Server Components que muestran datos del
    // torneo (totalInscritos, pozo) y las listas que los agregan. Sin
    // esto, el detalle del torneo y /matches siguen mostrando los
    // contadores viejos hasta el próximo F5 del usuario. El cliente
    // complementa con router.refresh() para invalidar el Router Cache
    // local y forzar un re-fetch.
    revalidatePath(`/torneo/${parsed.data.torneoId}`);
    revalidatePath("/matches");
    revalidatePath("/");

    // Fire-and-forget: si el partido ya empezó, un ticket nuevo modifica
    // el ranking — re-puntuarlo y emitir actualización. Lo hacemos fuera
    // del await del handler para que la respuesta HTTP sea rápida.
    // El partidoId permite al emitter leer el label del cache (Bug #9);
    // resolverlo aquí requiere un query extra, así que lo dejamos null
    // y el cliente verá el último label del cache sin cambiar.
    setImmediate(() => {
      recalcularTorneo(parsed.data.torneoId)
        .then(() =>
          emitirRankingUpdate(parsed.data.torneoId, { partidoId: null }),
        )
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
