// POST /api/v1/admin/channel-whatsapp/forzar-sync — Lote F.
//
// Dispara manualmente el cron de sync de membresía Channel desde el botón
// "Forzar sync ahora" en /admin/channel-whatsapp. El cron real corre cada
// 1h desde instrumentation.ts; este endpoint permite re-disparar antes de
// la próxima ventana cuando el admin lo necesita (ej. tras eliminar
// manualmente miembros del Channel).
//
// Auth: sesión ADMIN obligatoria. Auditoría: log la acción.

import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { syncMembresiaChannel } from "@/lib/services/sync-membresia.service";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { logAuditoria } from "@/lib/services/auditoria.service";
import { track } from "@/lib/services/analytics.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") throw new NoAutorizado("Solo ADMIN");

    const reporte = await syncMembresiaChannel();

    void track({
      evento: "admin_sync_membresia_forzado",
      userId: session.user.id,
      props: { reporte },
    });

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "channel.forzar_sync",
      entidad: "MiembroChannel",
      resumen: `Sync de membresía forzado manualmente`,
      metadata: { reporte },
    });

    logger.info(
      { actor: session.user.email, ...reporte, source: "admin:channel:forzar-sync" },
      "POST /api/v1/admin/channel-whatsapp/forzar-sync ejecutado",
    );

    return Response.json({ ok: true, reporte });
  } catch (err) {
    logger.error(
      { err, source: "api:admin:channel:forzar-sync" },
      "POST /api/v1/admin/channel-whatsapp/forzar-sync falló",
    );
    return toErrorResponse(err);
  }
}
