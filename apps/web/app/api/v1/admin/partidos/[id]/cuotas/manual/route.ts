// PATCH /api/v1/admin/partidos/[id]/cuotas/manual — Lote V.14.1.
//
// Permite al admin editar cuotas manualmente para una casa cuando el
// motor de captura no logró extraerlas (parciales) o necesita corregir
// un valor específico. Las cuotas editadas manualmente se persisten en
// las mismas columnas que las automáticas; el campo `eventIdExterno` se
// preserva. Auditoría 100%.
//
// Body:
//   {
//     "casa": "doradobet" | "apuesta_total" | ...,
//     "cuotas": {
//       "1x2"?:        { "local": 1.65, "empate": 5.45, "visita": 4.35 },
//       "doble_op"?:   { "x1": 1.23, "x12": 1.17, "xx2": 2.12 },
//       "mas_menos_25"?: { "over": 1.85, "under": 1.95 },
//       "btts"?:       { "si": 1.28, "no": 3.40 }
//     }
//   }
//
// Solo se actualizan los mercados presentes en el body. Los demás
// quedan tal cual estaban (no se borran).
//
// Auth: ADMIN (sesión).

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import {
  NoAutenticado,
  NoAutorizado,
  PartidoNoEncontrado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { logAuditoria } from "@/lib/services/auditoria.service";
import { recalcularEstadoCapturaPartido } from "@/lib/services/cuotas-persistencia";
import { CASAS_CUOTAS } from "@/lib/services/scrapers/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const Cuota = (min: number, max: number) =>
  z.number().positive().min(min).max(max);

const BodySchema = z
  .object({
    casa: z.enum(CASAS_CUOTAS),
    cuotas: z
      .object({
        "1x2": z
          .object({
            local: Cuota(1.01, 100),
            empate: Cuota(1.01, 100),
            visita: Cuota(1.01, 100),
          })
          .optional(),
        doble_op: z
          .object({
            x1: Cuota(1.01, 100),
            x12: Cuota(1.01, 100),
            xx2: Cuota(1.01, 100),
          })
          .optional(),
        mas_menos_25: z
          .object({
            over: Cuota(1.01, 100),
            under: Cuota(1.01, 100),
          })
          .optional(),
        btts: z
          .object({
            si: Cuota(1.01, 100),
            no: Cuota(1.01, 100),
          })
          .optional(),
      })
      .refine(
        (c) =>
          c["1x2"] !== undefined ||
          c.doble_op !== undefined ||
          c.mas_menos_25 !== undefined ||
          c.btts !== undefined,
        { message: "Al menos un mercado debe enviarse." },
      ),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden editar cuotas manualmente.",
      );
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", {
        issues: parsed.error.flatten(),
      });
    }
    const body = parsed.data;

    const partido = await prisma.partido.findUnique({
      where: { id: params.id },
      select: { id: true, equipoLocal: true, equipoVisita: true, liga: true },
    });
    if (!partido) throw new PartidoNoEncontrado(params.id);

    // Construir el payload de update solo con los mercados presentes
    const updateData: Record<string, unknown> = {
      ultimoExito: new Date(),
      capturadoEn: new Date(),
      ultimoIntento: new Date(),
      estado: "OK",
      errorMensaje: null,
      intentosFallidos: 0,
    };

    if (body.cuotas["1x2"]) {
      updateData.cuotaLocal = body.cuotas["1x2"].local;
      updateData.cuotaEmpate = body.cuotas["1x2"].empate;
      updateData.cuotaVisita = body.cuotas["1x2"].visita;
    }
    if (body.cuotas.doble_op) {
      updateData.cuota1X = body.cuotas.doble_op.x1;
      updateData.cuota12 = body.cuotas.doble_op.x12;
      updateData.cuotaX2 = body.cuotas.doble_op.xx2;
    }
    if (body.cuotas.mas_menos_25) {
      updateData.cuotaOver25 = body.cuotas.mas_menos_25.over;
      updateData.cuotaUnder25 = body.cuotas.mas_menos_25.under;
    }
    if (body.cuotas.btts) {
      updateData.cuotaBttsSi = body.cuotas.btts.si;
      updateData.cuotaBttsNo = body.cuotas.btts.no;
    }

    // Upsert sobre la fila (partidoId, casa)
    await prisma.cuotasCasa.upsert({
      where: {
        partidoId_casa: { partidoId: partido.id, casa: body.casa },
      },
      create: {
        partidoId: partido.id,
        casa: body.casa,
        eventIdExterno: "manual",
        estado: "OK",
        ultimoIntento: new Date(),
        ...(updateData as object),
      },
      update: updateData,
    });

    await recalcularEstadoCapturaPartido(partido.id);

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "partido.cuotas_edicion_manual",
      entidad: "Partido",
      entidadId: partido.id,
      resumen: `Edición manual de cuotas (${body.casa}) sobre ${partido.equipoLocal} vs ${partido.equipoVisita}`,
      metadata: {
        casa: body.casa,
        mercadosEditados: Object.keys(body.cuotas),
        cuotas: body.cuotas,
      },
    });

    logger.info(
      {
        partidoId: partido.id,
        casa: body.casa,
        mercados: Object.keys(body.cuotas),
        source: "api:cuotas:manual",
      },
      `cuotas manual · ${body.casa} · ${Object.keys(body.cuotas).join(",")}`,
    );

    return Response.json({
      ok: true,
      partidoId: partido.id,
      casa: body.casa,
      mercadosActualizados: Object.keys(body.cuotas),
    });
  } catch (err) {
    logger.error(
      {
        err: (err as Error).message,
        partidoId: params.id,
        source: "api:cuotas:manual",
      },
      `PATCH /partidos/[id]/cuotas/manual falló`,
    );
    return toErrorResponse(err);
  }
}
