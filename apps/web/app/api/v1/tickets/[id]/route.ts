// PUT /api/v1/tickets/[id]   — editar combinada antes del kickoff
// DELETE /api/v1/tickets/[id] — eliminar combinada antes del kickoff
//
// Lote M v3.2 (May 2026). Decisiones §4.9.2 + §4.9.5 + §4.9.7.
//
// Ambos verbos validan en el servidor que el partido NO haya empezado
// todavía. La validación duplica la del frontend (el botón se deshabilita
// al kickoff) para cubrir el race condition: usuario abre el modal a
// 14:59:55 y guarda a 15:00:02 — el guard del servicio rechaza con 409.

import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { editar, eliminar } from "@/lib/services/tickets.service";
import { CrearTicketBodySchema } from "@/lib/services/tickets.schema";
import {
  NoAutenticado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { recalcularTorneo } from "@/lib/services/puntuacion.service";
import { emitirRankingUpdate } from "@/lib/realtime/emitters";
import { track } from "@/lib/services/analytics.service";

interface RouteParams {
  params: { id: string };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
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

    const result = await editar(params.id, session.user.id, parsed.data);

    revalidatePath("/liga");
    revalidatePath("/mis-predicciones");

    setImmediate(() => {
      recalcularTorneo(result.ticket.torneoId)
        .then(() =>
          emitirRankingUpdate(result.ticket.torneoId, { partidoId: null }),
        )
        .catch((err) =>
          logger.error(
            { err, torneoId: result.ticket.torneoId },
            "recalc tras editar ticket falló",
          ),
        );
    });

    void track({
      evento: "prediccion_editada",
      props: {
        torneoId: result.ticket.torneoId,
        ticketId: result.ticket.id,
        numEdiciones: result.ticket.numEdiciones,
      },
      userId: session.user.id,
      request: req,
    });

    return Response.json({ data: result }, { status: 200 });
  } catch (err) {
    logger.error(
      { err, source: "api:tickets:put", ticketId: params.id },
      "PUT /api/v1/tickets/[id] falló",
    );
    return toErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const result = await eliminar(params.id, session.user.id);

    revalidatePath("/liga");
    revalidatePath("/mis-predicciones");

    setImmediate(() => {
      recalcularTorneo(result.torneoId)
        .then(() =>
          emitirRankingUpdate(result.torneoId, { partidoId: null }),
        )
        .catch((err) =>
          logger.error(
            { err, torneoId: result.torneoId },
            "recalc tras eliminar ticket falló",
          ),
        );
    });

    void track({
      evento: "prediccion_eliminada",
      props: { torneoId: result.torneoId, ticketId: params.id },
      userId: session.user.id,
      request: req,
    });

    return Response.json({ data: result }, { status: 200 });
  } catch (err) {
    logger.error(
      { err, source: "api:tickets:delete", ticketId: params.id },
      "DELETE /api/v1/tickets/[id] falló",
    );
    return toErrorResponse(err);
  }
}
