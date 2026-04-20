// GET /api/v1/premios — Sub-Sprint 6. Lista el catálogo de premios.
// Público (no requiere sesión para ver la tienda).

import { NextRequest } from "next/server";
import {
  CATEGORIAS_VALIDAS,
  listarPremios,
  type CategoriaPremio,
} from "@/lib/services/premios.service";
import { toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoria = searchParams.get("categoria") as CategoriaPremio | null;
    const soloConStock = searchParams.get("soloConStock") === "true";

    const result = await listarPremios({
      categoria:
        categoria && (CATEGORIAS_VALIDAS as readonly string[]).includes(categoria)
          ? categoria
          : undefined,
      soloConStock,
    });

    return Response.json({ data: result });
  } catch (err) {
    logger.error({ err }, "GET /api/v1/premios falló");
    return toErrorResponse(err);
  }
}
