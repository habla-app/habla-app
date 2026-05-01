// POST /api/v1/admin/usuarios/[id]/ban — Lote G.
//
// Banea (soft-delete con anonimización) un usuario. Acción destructiva
// requiere motivo + auditoría 100% (regla 21).

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { banearUsuario } from "@/lib/services/usuarios.service";
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
  confirmacion: z.literal("BANEAR"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN")
      throw new NoAutorizado("Solo ADMIN puede banear usuarios");

    if (params.id === session.user.id) {
      throw new ValidacionFallida(
        "No puedes banearte a ti mismo",
        { field: "id" },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida(
        "Motivo y confirmación 'BANEAR' obligatorios",
        parsed.error.flatten(),
      );
    }

    await banearUsuario(params.id);

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email,
      accion: "usuario.banear",
      entidad: "Usuario",
      entidadId: params.id,
      resumen: `Usuario baneado (soft-delete con anonimización)`,
      metadata: { motivo: parsed.data.motivo },
    });

    void track({
      evento: "admin_usuario_baneado",
      userId: session.user.id,
      props: { targetId: params.id, motivo: parsed.data.motivo },
    });

    logger.info(
      { adminId: session.user.id, targetId: params.id, source: "admin:usuarios:ban" },
      "Usuario baneado",
    );

    return Response.json({ ok: true });
  } catch (err) {
    logger.error(
      { err, source: "api:admin:usuarios:ban" },
      "POST /api/v1/admin/usuarios/[id]/ban falló",
    );
    return toErrorResponse(err);
  }
}
