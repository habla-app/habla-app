// POST /api/v1/admin/seed/premios — Hotfix #9.
//
// Requiere rol ADMIN. Siembra el catálogo de 25 premios en producción usando
// `CATALOGO_PREMIOS` de `@habla/db` como fuente de verdad. Idempotente:
// correrlo N veces termina siempre con 25 premios, nunca más.
//
// Motivación (Hotfix #9): antes del deploy, `/tienda` en producción mostraba
// "No hay premios en esta categoría" porque el seed de `packages/db/prisma/seed.ts`
// nunca corrió contra Railway (solo existe el comando `pnpm db:seed` que
// requiere acceso shell al contenedor). Este endpoint permite al admin
// sembrar el catálogo con un solo POST autenticado desde el navegador.
//
// Alternativa descartada: correr el seed en el pipeline de deploy. Riesgo:
// cada deploy mutaría el catálogo; más complejo hacerlo idempotente frente
// a cambios manuales via Prisma Studio.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { sembrarCatalogoPremios } from "@/lib/services/premios-seed.service";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden sembrar el catálogo de premios.",
      );
    }

    const data = await sembrarCatalogoPremios();
    return Response.json({ data });
  } catch (err) {
    logger.error({ err }, "POST /api/v1/admin/seed/premios falló");
    return toErrorResponse(err);
  }
}
