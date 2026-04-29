// PATCH  /api/v1/admin/afiliados/[id] — editar afiliado (Lote 7).
// DELETE /api/v1/admin/afiliados/[id] — soft delete (activo=false).
//
// Soft delete: NO borramos la fila para preservar histórico de clicks y
// conversiones. Si en el futuro hace falta volver a activar el afiliado,
// se hace por PATCH activo=true.

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  actualizarAfiliado,
  desactivarAfiliado,
  MODELOS_COMISION,
} from "@/lib/services/afiliacion.service";
import {
  NoAutenticado,
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SlugRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const StringArraySchema = z
  .array(z.string().trim().min(1).max(200))
  .max(20);

const PatchSchema = z.object({
  slug: z.string().min(2).max(60).regex(SlugRe).optional(),
  nombre: z.string().min(1).max(100).optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  autorizadoMincetur: z.boolean().optional(),
  urlBase: z.string().url().max(2000).optional(),
  modeloComision: z.enum(MODELOS_COMISION).optional(),
  montoCpa: z.number().int().nonnegative().nullable().optional(),
  porcentajeRevshare: z.number().min(0).max(100).nullable().optional(),
  bonoActual: z.string().max(200).nullable().optional(),
  metodosPago: StringArraySchema.optional(),
  pros: StringArraySchema.optional(),
  contras: StringArraySchema.optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  activo: z.boolean().optional(),
  ordenDestacado: z.number().int().min(0).max(9999).optional(),
  ultimaVerificacionMincetur: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .transform((v) => (v == null ? v : new Date(v))),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado("Solo administradores.");
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", {
        issues: parsed.error.flatten(),
      });
    }

    const updated = await actualizarAfiliado(params.id, parsed.data);
    logger.info(
      { afiliadoId: params.id },
      "PATCH /api/v1/admin/afiliados/[id]",
    );
    return Response.json({ data: { afiliado: updated } });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return toErrorResponse(
        new ValidacionFallida(
          "Ya existe otro afiliado con ese slug.",
          { field: "slug" },
        ),
      );
    }
    if ((err as { code?: string })?.code === "P2025") {
      return toErrorResponse(
        new ValidacionFallida("Afiliado no encontrado.", { id: params.id }),
      );
    }
    logger.error(
      { err, afiliadoId: params.id, source: "api:admin-afiliados" },
      "PATCH /api/v1/admin/afiliados/[id] falló",
    );
    return toErrorResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado("Solo administradores.");
    }

    const updated = await desactivarAfiliado(params.id);
    logger.info(
      { afiliadoId: params.id },
      "DELETE /api/v1/admin/afiliados/[id] — soft delete",
    );
    return Response.json({ data: { afiliado: updated } });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2025") {
      return toErrorResponse(
        new ValidacionFallida("Afiliado no encontrado.", { id: params.id }),
      );
    }
    logger.error(
      { err, afiliadoId: params.id, source: "api:admin-afiliados" },
      "DELETE /api/v1/admin/afiliados/[id] falló",
    );
    return toErrorResponse(err);
  }
}
