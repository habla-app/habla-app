// POST /api/v1/usuarios/me/eliminar/inmediato — Mini-lote 7.6.
//
// Eliminación inmediata in-app (vs. el flujo email-token de la ruta
// hermana `/eliminar` + `/eliminar/confirmar`, que queda como legacy).
//
// El cliente abre un modal con confirmación typing "ELIMINAR" y, al
// confirmar, dispara este endpoint. El service decide hard vs soft según
// actividad histórica (tickets/canjes) y devuelve el modo aplicado.
//
// El cliente debe llamar `signOut()` después del 200 — la sesión actual
// ya no apunta a un usuario válido (hard) o apunta a uno anonimizado
// con todas sus Sessions borradas (soft).

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { eliminarCuentaInmediato } from "@/lib/services/usuarios.service";
import {
  NoAutenticado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

const Body = z.object({
  // Texto de confirmación literal — defensa server-side por si la UI
  // se manipula. La UI lo valida en el botón y vuelve a chequear acá.
  confirmacion: z.literal("ELIMINAR"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const body = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida(
        "Tenés que escribir ELIMINAR para confirmar.",
        { issues: parsed.error.flatten() },
      );
    }

    const result = await eliminarCuentaInmediato(session.user.id);

    return Response.json({ data: { ok: true, modo: result.modo } });
  } catch (err) {
    logger.error({ err }, "POST /usuarios/me/eliminar/inmediato falló");
    return toErrorResponse(err);
  }
}
