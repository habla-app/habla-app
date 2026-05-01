// POST /api/v1/admin/picks-premium/[id]/aprobar — Lote E.
//
// Aprueba un pick PENDIENTE → APROBADO + dispara distribución 1:1 al bot
// de WhatsApp Business API. Idempotente: si ya está aprobado, no
// reprocesa pero retorna ok.
//
// Body opcional: { editado?: boolean } — si true, marca como
// EDITADO_Y_APROBADO (sub-flujo: editar antes de aprobar = PATCH a
// /api/v1/admin/picks-premium/[id] que setea estado y deja aprobado=false,
// luego este endpoint con editado:true completa).
//
// Auth: sesión ADMIN o Bearer CRON_SECRET (para tests one-shot).

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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Distribución puede tardar varios segundos (envíos por WhatsApp + retries).
export const maxDuration = 120;

const BodySchema = z
  .object({
    editado: z.boolean().optional(),
  })
  .strict()
  .partial();

export async function POST(
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
          "Solo administradores o Bearer CRON_SECRET pueden aprobar picks.",
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
    const editado = parsed.data.editado === true;

    const pick = await prisma.pickPremium.findUnique({
      where: { id: params.id },
    });
    if (!pick) {
      throw new ValidacionFallida("Pick no encontrado", { pickId: params.id });
    }

    // Idempotencia: ya aprobado → solo aseguramos distribución.
    if (pick.aprobado) {
      logger.info(
        { pickId: pick.id, source: "admin:picks-premium:aprobar" },
        "aprobar: pick ya aprobado, re-disparando distribución",
      );
    } else {
      await prisma.pickPremium.update({
        where: { id: pick.id },
        data: {
          estado: editado ? "EDITADO_Y_APROBADO" : "APROBADO",
          aprobado: true,
          aprobadoPor: adminUserId ?? "admin",
          aprobadoEn: new Date(),
        },
      });
      void track({
        evento: "pick_premium_aprobado",
        userId: adminUserId !== "cron" ? adminUserId : undefined,
        props: { pickId: pick.id, editado },
      });
    }

    // Distribución fire-and-forget. No bloqueamos la respuesta del admin.
    void distribuirPickAprobado(pick.id).catch((err) => {
      logger.error(
        { err, pickId: pick.id, source: "admin:picks-premium:aprobar" },
        "distribuirPickAprobado falló",
      );
    });

    return Response.json({ ok: true, pickId: pick.id });
  } catch (err) {
    logger.error(
      { err, source: "api:admin-picks-premium-aprobar" },
      "POST /api/v1/admin/picks-premium/[id]/aprobar falló",
    );
    return toErrorResponse(err);
  }
}
