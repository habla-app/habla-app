// GET /api/v1/admin/seed/premios/status — Hotfix #9.
//
// Requiere rol ADMIN. Devuelve el estado actual del catálogo de premios en
// BD: total, con stock, breakdown por categoría, y si el seed necesita
// correr. Permite al admin verificar sin tener que inspeccionar /tienda a
// mano o entrar a Prisma Studio.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { obtenerStatusCatalogo } from "@/lib/services/premios-seed.service";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden consultar el status del catálogo.",
      );
    }

    const data = await obtenerStatusCatalogo();
    return Response.json({ data });
  } catch (err) {
    logger.error({ err }, "GET /api/v1/admin/seed/premios/status falló");
    return toErrorResponse(err);
  }
}
