// POST /api/v1/admin/usuarios/[id]/soft-delete — Lote G.
//
// Soft-delete admin de un usuario (compliance). Anonimiza PII + libera
// username + invalida sesiones. NO se puede deshacer.

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { softDeleteUsuarioAdmin } from "@/lib/services/usuarios.service";
import { logAuditoria } from "@/lib/services/auditoria.service";
import { logger } from "@/lib/services/logger";
import { track } from "@/lib/services/analytics.service";
import {
  NoAutenticado,
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  motivo: z.string().min(5).max(1000),
  confirmacion: z.literal("ELIMINAR"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN")
      throw new NoAutorizado("Solo ADMIN puede eliminar usuarios");

    if (params.id === session.user.id) {
      throw new ValidacionFallida(
        "No puedes eliminarte a ti mismo desde acá",
        { field: "id" },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida(
        "Motivo y confirmación 'ELIMINAR' obligatorios",
        parsed.error.flatten(),
      );
    }

    await softDeleteUsuarioAdmin(params.id);

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email,
      accion: "usuario.soft_delete",
      entidad: "Usuario",
      entidadId: params.id,
      resumen: `Usuario eliminado (soft) por admin`,
      metadata: { motivo: parsed.data.motivo },
    });

    void track({
      evento: "admin_usuario_soft_deleted",
      userId: session.user.id,
      props: { targetId: params.id, motivo: parsed.data.motivo },
    });

    logger.info(
      { adminId: session.user.id, targetId: params.id, source: "admin:usuarios:soft-delete" },
      "Usuario eliminado por admin",
    );

    return Response.json({ ok: true });
  } catch (err) {
    logger.error(
      { err, source: "api:admin:usuarios:soft-delete" },
      "POST /api/v1/admin/usuarios/[id]/soft-delete falló",
    );
    return toErrorResponse(err);
  }
}
