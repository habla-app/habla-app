// POST /api/v1/torneos/:id/inscribir
//
// Requiere sesión. Inscribe al usuario en el torneo (transacción atómica
// con ticket placeholder + descuento de entrada). Sub-Sprint 4 permitirá
// editar las predicciones del ticket.

import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { inscribir } from "@/lib/services/torneos.service";
import { NoAutenticado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

interface Context {
  params: { id: string };
}

export async function POST(_req: NextRequest, { params }: Context) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const result = await inscribir(session.user.id, params.id);

    // Invalidar el cache del detalle del torneo y de las listas que
    // muestran sus contadores (jugadores, pozo). Mismo patrón que en
    // POST /api/v1/tickets — cubre el flujo "Inscribirme" sin combinada.
    revalidatePath(`/torneo/${params.id}`);
    revalidatePath("/matches");
    revalidatePath("/");

    return Response.json({ data: result });
  } catch (err) {
    logger.error(
      { err, torneoId: params.id },
      "POST /api/v1/torneos/:id/inscribir falló",
    );
    return toErrorResponse(err);
  }
}
