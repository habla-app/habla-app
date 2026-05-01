// PATCH /api/v1/admin/picks-premium/[id] — Lote E.
//
// Edita campos del pick antes de aprobarlo. Cuando el editor cambia el
// razonamiento, stake o cuota desde /admin/picks-premium (Lote F), llamamos
// este endpoint. Si pasa también `aprobar:true`, marcamos como
// EDITADO_Y_APROBADO y disparamos distribución (atajo del flujo).
//
// Auth: sesión ADMIN o Bearer CRON_SECRET.

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { track } from "@/lib/services/analytics.service";
import { distribuirPickAprobado } from "@/lib/services/whatsapp/picks-distribuidor.service";
import { logAuditoria } from "@/lib/services/auditoria.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z
  .object({
    razonamiento: z.string().min(20).max(4000).optional(),
    cuotaSugerida: z.number().min(1).max(50).optional(),
    stakeSugerido: z.number().min(0.005).max(0.1).optional(),
    evPctSugerido: z.number().min(0).max(0.5).nullable().optional(),
    casaRecomendadaId: z.string().nullable().optional(),
    estadisticas: z
      .object({
        h2h: z.string().optional(),
        formaReciente: z.string().optional(),
        factorClave: z.string().optional(),
      })
      .partial()
      .optional(),
    aprobar: z.boolean().optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    let adminUserId: string | undefined;
    const session = await auth();
    if (session?.user?.id && session.user.rol === "ADMIN") {
      adminUserId = session.user.id;
    } else {
      const secret = process.env.CRON_SECRET;
      if (
        !secret ||
        req.headers.get("authorization") !== `Bearer ${secret}`
      ) {
        if (!session?.user?.id) throw new NoAutenticado();
        throw new NoAutorizado(
          "Solo administradores o Bearer CRON_SECRET pueden editar picks.",
        );
      }
      adminUserId = "cron";
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", {
        issues: parsed.error.flatten(),
      });
    }
    const { aprobar, ...campos } = parsed.data;

    const pick = await prisma.pickPremium.findUnique({
      where: { id: params.id },
    });
    if (!pick) {
      throw new ValidacionFallida("Pick no encontrado", { pickId: params.id });
    }

    const data: Record<string, unknown> = {};
    if (campos.razonamiento !== undefined) data.razonamiento = campos.razonamiento;
    if (campos.cuotaSugerida !== undefined) data.cuotaSugerida = campos.cuotaSugerida;
    if (campos.stakeSugerido !== undefined) data.stakeSugerido = campos.stakeSugerido;
    if (campos.evPctSugerido !== undefined) data.evPctSugerido = campos.evPctSugerido;
    if (campos.casaRecomendadaId !== undefined)
      data.casaRecomendadaId = campos.casaRecomendadaId;
    if (campos.estadisticas !== undefined)
      data.estadisticas = campos.estadisticas;

    if (aprobar) {
      if (pick.estado === "RECHAZADO") {
        throw new ValidacionFallida(
          "El pick fue rechazado anteriormente. No puede aprobarse en este flujo.",
        );
      }
      data.estado = "EDITADO_Y_APROBADO";
      data.aprobado = true;
      data.aprobadoPor = adminUserId ?? "admin";
      data.aprobadoEn = new Date();
    }

    if (Object.keys(data).length === 0) {
      return Response.json({ ok: true, pickId: pick.id, sinCambios: true });
    }

    const updated = await prisma.pickPremium.update({
      where: { id: pick.id },
      data,
    });

    if (aprobar) {
      void track({
        evento: "pick_premium_editado_y_aprobado",
        userId: adminUserId !== "cron" ? adminUserId : undefined,
        props: { pickId: pick.id },
      });
      void distribuirPickAprobado(pick.id).catch((err) => {
        logger.error(
          { err, pickId: pick.id, source: "admin:picks-premium:patch" },
          "distribuirPickAprobado falló post-edit",
        );
      });
      await logAuditoria({
        actorId: adminUserId !== "cron" ? adminUserId ?? null : null,
        actorEmail: session?.user?.email ?? null,
        accion: "pick.editar_y_aprobar",
        entidad: "PickPremium",
        entidadId: pick.id,
        resumen: `Pick ${pick.id} editado y aprobado`,
        metadata: { camposEditados: Object.keys(campos) },
      });
    } else {
      void track({
        evento: "pick_premium_editado",
        userId: adminUserId !== "cron" ? adminUserId : undefined,
        props: { pickId: pick.id },
      });
      await logAuditoria({
        actorId: adminUserId !== "cron" ? adminUserId ?? null : null,
        actorEmail: session?.user?.email ?? null,
        accion: "pick.editar",
        entidad: "PickPremium",
        entidadId: pick.id,
        resumen: `Pick ${pick.id} editado (sin aprobar)`,
        metadata: { camposEditados: Object.keys(campos) },
      });
    }

    return Response.json({ ok: true, pickId: updated.id });
  } catch (err) {
    logger.error(
      { err, source: "api:admin-picks-premium-patch" },
      "PATCH /api/v1/admin/picks-premium/[id] falló",
    );
    return toErrorResponse(err);
  }
}
