// POST /api/v1/admin/finanzas/costos — Lote G.
//
// Upsert de costo operativo del mes. Auditoría 100% (regla 21).

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  CATEGORIAS_COSTO_PREDEFINIDAS,
  upsertarCosto,
  eliminarCosto,
} from "@/lib/services/finanzas.service";
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
  mes: z.string().regex(/^\d{4}-\d{2}$/, "mes formato YYYY-MM"),
  categoria: z.string().min(1).max(80),
  montoSoles: z.number().int().min(0).max(10_000_000),
  notas: z.string().max(500).optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN")
      throw new NoAutorizado("Solo ADMIN puede registrar costos");

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido", parsed.error.flatten());
    }

    // Si la categoría no está en el catálogo predefinido, normalizamos a
    // 'otros' o aceptamos categoría libre. Mantenemos free-form.
    void CATEGORIAS_COSTO_PREDEFINIDAS;

    const fila = await upsertarCosto({
      mes: parsed.data.mes,
      categoria: parsed.data.categoria,
      montoSoles: parsed.data.montoSoles,
      notas: parsed.data.notas ?? null,
      registradoPor: session.user.id,
    });

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email,
      accion: "costo.registrar",
      entidad: "CostoOperativo",
      entidadId: fila.id,
      resumen: `Costo ${parsed.data.categoria} ${parsed.data.mes}: S/${parsed.data.montoSoles}`,
      metadata: { ...parsed.data },
    });

    void track({
      evento: "admin_costo_registrado",
      userId: session.user.id,
      props: { mes: parsed.data.mes, categoria: parsed.data.categoria, monto: parsed.data.montoSoles },
    });

    logger.info(
      { adminId: session.user.id, mes: parsed.data.mes, source: "admin:finanzas:costos" },
      "Costo registrado",
    );

    return Response.json({ ok: true, fila });
  } catch (err) {
    logger.error(
      { err, source: "api:admin:finanzas:costos" },
      "POST /api/v1/admin/finanzas/costos falló",
    );
    return toErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN")
      throw new NoAutorizado("Solo ADMIN puede eliminar costos");

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) throw new ValidacionFallida("id obligatorio", { field: "id" });

    await eliminarCosto(id);

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email,
      accion: "costo.eliminar",
      entidad: "CostoOperativo",
      entidadId: id,
      resumen: "Costo eliminado",
    });

    return Response.json({ ok: true });
  } catch (err) {
    logger.error(
      { err, source: "api:admin:finanzas:costos:delete" },
      "DELETE /api/v1/admin/finanzas/costos falló",
    );
    return toErrorResponse(err);
  }
}
