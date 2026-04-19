// GET /api/v1/tickets/mis-tickets?estado=ACTIVOS|GANADOS|HISTORIAL&page=&limit=
//
// Requiere sesión. Lista paginada de tickets del usuario con Torneo y
// Partido embebidos. Sub-Sprint 4.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { listarMisTickets } from "@/lib/services/tickets.service";
import { ListarMisTicketsQuerySchema } from "@/lib/services/tickets.schema";
import {
  NoAutenticado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = ListarMisTicketsQuerySchema.safeParse(params);
    if (!parsed.success) {
      throw new ValidacionFallida("Parámetros inválidos.", {
        issues: parsed.error.flatten(),
      });
    }

    const data = await listarMisTickets(session.user.id, parsed.data);
    return Response.json({ data });
  } catch (err) {
    logger.error({ err }, "GET /api/v1/tickets/mis-tickets falló");
    return toErrorResponse(err);
  }
}
