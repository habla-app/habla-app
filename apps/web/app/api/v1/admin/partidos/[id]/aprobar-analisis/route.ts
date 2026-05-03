// POST /api/v1/admin/partidos/[id]/aprobar-analisis — Lote O (May 2026).
//
// Aprueba el AnalisisPartido (objeto rico) asociado al partido. La vista
// /admin/picks usa este endpoint cuando el editor confirma el análisis
// Free + Socios desde la cola de validación.
//
// Diferencia con `/api/v1/admin/picks-premium/[id]/aprobar` del Lote E:
// ese era para PickPremium (1 pick=1 mercado, modelo legacy del canal
// WhatsApp). Este es para AnalisisPartido (objeto rico v3.2 que cubre
// Free + Socios juntos).
//
// Cero auto-publicación: el análisis solo se publica cuando un humano
// pulsa "Aprobar". Auditoría 100% en cada cambio (regla 21).

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
    analisisBasico: z.string().min(1).max(10000).optional(),
    razonamientoDetallado: z.string().min(1).max(20000).optional(),
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
      throw new NoAutorizado("Solo administradores pueden aprobar análisis.");
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", { issues: parsed.error.flatten() });
    }
    const body = parsed.data;

    const partido = await prisma.partido.findUnique({
      where: { id: params.id },
      include: { analisisPartido: true },
    });
    if (!partido) throw new PartidoNoEncontrado(params.id);
    if (!partido.analisisPartido) {
      throw new ValidacionFallida("El partido no tiene AnalisisPartido para aprobar.");
    }

    const analisisAntes = partido.analisisPartido;

    const updates: Record<string, unknown> = {
      estado: "APROBADO",
      aprobadoPor: session.user.email ?? session.user.id,
      aprobadoEn: new Date(),
      rechazadoMotivo: null,
    };
    if (body.analisisBasico !== undefined) updates.analisisBasico = body.analisisBasico;
    if (body.razonamientoDetallado !== undefined) {
      updates.razonamientoDetallado = body.razonamientoDetallado;
    }

    await prisma.analisisPartido.update({
      where: { id: analisisAntes.id },
      data: updates,
    });

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "analisis_partido.aprobar",
      entidad: "AnalisisPartido",
      entidadId: analisisAntes.id,
      resumen: `Análisis aprobado para ${partido.equipoLocal} vs ${partido.equipoVisita}`,
      metadata: {
        partidoId: partido.id,
        estadoAntes: analisisAntes.estado,
        editado:
          body.analisisBasico !== undefined || body.razonamientoDetallado !== undefined,
      },
    });

    return Response.json({ ok: true, analisisId: analisisAntes.id });
  } catch (err) {
    logger.error(
      { err, partidoId: params.id, source: "api:admin-partidos-aprobar-analisis" },
      "POST /api/v1/admin/partidos/[id]/aprobar-analisis falló",
    );
    return toErrorResponse(err);
  }
}
