// POST /api/v1/admin/partidos/[id]/rechazar-analisis — Lote O (May 2026).
//
// Rechaza el AnalisisPartido del partido con un motivo. El admin lo usa
// desde la cola de validación cuando el análisis no se publica (data
// inconsistente, prompt sin sentido, etc.).
//
// Cero auto-publicación. Auditoría 100% (regla 21).

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import {
  NoAutenticado,
  NoAutorizado,
  PartidoNoEncontrado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { logAuditoria } from "@/lib/services/auditoria.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z
  .object({
    motivo: z.string().min(1).max(500),
  })
  .strict();

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado("Solo administradores pueden rechazar análisis.");
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", { issues: parsed.error.flatten() });
    }

    const partido = await prisma.partido.findUnique({
      where: { id: params.id },
      include: { analisisPartido: true },
    });
    if (!partido) throw new PartidoNoEncontrado(params.id);
    if (!partido.analisisPartido) {
      throw new ValidacionFallida("El partido no tiene AnalisisPartido para rechazar.");
    }

    const analisisAntes = partido.analisisPartido;

    await prisma.analisisPartido.update({
      where: { id: analisisAntes.id },
      data: {
        estado: "RECHAZADO",
        rechazadoMotivo: parsed.data.motivo,
        aprobadoPor: null,
        aprobadoEn: null,
      },
    });

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "analisis_partido.rechazar",
      entidad: "AnalisisPartido",
      entidadId: analisisAntes.id,
      resumen: `Análisis rechazado para ${partido.equipoLocal} vs ${partido.equipoVisita}`,
      metadata: {
        partidoId: partido.id,
        estadoAntes: analisisAntes.estado,
        motivo: parsed.data.motivo,
      },
    });

    return Response.json({ ok: true, analisisId: analisisAntes.id });
  } catch (err) {
    logger.error(
      { err, partidoId: params.id, source: "api:admin-partidos-rechazar-analisis" },
      "POST /api/v1/admin/partidos/[id]/rechazar-analisis falló",
    );
    return toErrorResponse(err);
  }
}
