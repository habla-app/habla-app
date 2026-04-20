// GET /api/v1/usuarios/me/datos-download/file — Sub-Sprint 7.
// Sirve el JSON con los datos del usuario directamente (como attachment).
// Al usar la cookie de sesión, solo el usuario dueño puede descargar.

import { auth } from "@/lib/auth";
import { generarExportDatos } from "@/lib/services/usuarios.service";
import { NoAutenticado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const data = await generarExportDatos(session.user.id);
    const filename = `habla-datos-${session.user.id}-${new Date().toISOString().slice(0, 10)}.json`;
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /usuarios/me/datos-download/file falló");
    return toErrorResponse(err);
  }
}
