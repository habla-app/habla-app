// POST /api/v1/admin/usuarios/[id]/cambiar-rol — Lote G.
//
// Promueve un JUGADOR a ADMIN o viceversa. Requiere motivo + auditoría.

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { cambiarRolUsuario } from "@/lib/services/usuarios.service";
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
  nuevoRol: z.enum(["JUGADOR", "ADMIN"]),
  motivo: z.string().min(5).max(1000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN")
      throw new NoAutorizado("Solo ADMIN puede cambiar roles");

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida(
        "Body inválido: nuevoRol + motivo obligatorios",
        parsed.error.flatten(),
      );
    }

    if (params.id === session.user.id && parsed.data.nuevoRol === "JUGADOR") {
      throw new ValidacionFallida(
        "No puedes degradarte a ti mismo de ADMIN. Pide a otro admin que lo haga.",
        { field: "id" },
      );
    }

    const result = await cambiarRolUsuario({
      usuarioId: params.id,
      nuevoRol: parsed.data.nuevoRol,
    });

    if (result.rolAnterior !== result.rolNuevo) {
      await logAuditoria({
        actorId: session.user.id,
        actorEmail: session.user.email,
        accion: "usuario.cambiar_rol",
        entidad: "Usuario",
        entidadId: params.id,
        resumen: `Rol ${result.rolAnterior} → ${result.rolNuevo}`,
        metadata: {
          rolAnterior: result.rolAnterior,
          rolNuevo: result.rolNuevo,
          motivo: parsed.data.motivo,
        },
      });

      void track({
        evento: "admin_usuario_rol_cambiado",
        userId: session.user.id,
        props: {
          targetId: params.id,
          rolAnterior: result.rolAnterior,
          rolNuevo: result.rolNuevo,
        },
      });
    }

    logger.info(
      {
        adminId: session.user.id,
        targetId: params.id,
        rolAnterior: result.rolAnterior,
        rolNuevo: result.rolNuevo,
        source: "admin:usuarios:cambiar-rol",
      },
      "Rol cambiado",
    );

    return Response.json({ ok: true, ...result });
  } catch (err) {
    logger.error(
      { err, source: "api:admin:usuarios:cambiar-rol" },
      "POST /api/v1/admin/usuarios/[id]/cambiar-rol falló",
    );
    return toErrorResponse(err);
  }
}
