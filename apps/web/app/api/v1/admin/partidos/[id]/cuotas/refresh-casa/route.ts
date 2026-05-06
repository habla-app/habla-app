// POST /api/v1/admin/partidos/[id]/cuotas/refresh-casa — Lote V fase V.2.
// Spec: docs/plan-tecnico-lote-v-motor-cuotas.md § 9.5 + § 13 (Fase V.2).
//
// Encola un job individual de captura para UNA casa específica del partido.
// Pensado para que el admin pueda forzar refresh de una casa puntual desde
// la UI de Lote V.5 (botón ↻ por casa) sin esperar al cron diario o forzar
// el refresh global.
//
// Flujo:
//   1. Auth ADMIN obligatoria (regla 11 del CLAUDE.md). No aceptamos
//      CRON_SECRET — la mutación es decisión humana.
//   2. Parse del body con Zod: `{ casa: <una de CASAS_CUOTAS> }`.
//   3. Verifica que el partido exista y que tenga `EventIdExterno`
//      resuelto para la casa pedida. Sin event ID, 409 con mensaje claro
//      ("vincular manualmente primero").
//   4. Encola job en BullMQ con `esRefresh=true` (jobId compartido con el
//      cron diario — idempotente: si ya hay job pendiente, BullMQ ignora).
//   5. Auditoría 100% (regla 21 del CLAUDE.md).

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
import { encolarJobCaptura } from "@/lib/services/cuotas-cola";
import { CASAS_CUOTAS, type CasaCuotas } from "@/lib/services/scrapers/types";
import { detectarLigaCanonica } from "@/lib/services/scrapers/ligas-id-map";
import { obtenerUrlListado } from "@/lib/services/scrapers/urls-listing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z
  .object({
    casa: z.enum(CASAS_CUOTAS as unknown as readonly [CasaCuotas, ...CasaCuotas[]]),
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
      throw new NoAutorizado(
        "Solo administradores pueden forzar refresh de cuotas.",
      );
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", {
        issues: parsed.error.flatten(),
      });
    }
    const { casa } = parsed.data;

    const partido = await prisma.partido.findUnique({
      where: { id: params.id },
      select: { id: true, equipoLocal: true, equipoVisita: true, liga: true },
    });
    if (!partido) throw new PartidoNoEncontrado(params.id);

    // Lote V.12: detectar liga canónica + verificar URL listing.
    const ligaCanonica = detectarLigaCanonica(partido.liga);
    if (!ligaCanonica || !obtenerUrlListado(ligaCanonica, casa)) {
      return Response.json(
        {
          error: {
            code: "LIGA_NO_MAPEADA",
            message: `La liga "${partido.liga}" no tiene URL configurada para la casa "${casa}". Agregar la URL en apps/web/lib/services/scrapers/urls-listing.ts.`,
          },
        },
        { status: 409 },
      );
    }

    const jobId = await encolarJobCaptura({
      partidoId: partido.id,
      casa,
      ligaCanonica,
      esRefresh: true,
    });

    if (!jobId) {
      // Cola no disponible (sin REDIS_URL). El motor degrada graciosamente
      // pero el admin debe saberlo — devolvemos 503 con mensaje claro.
      logger.warn(
        { partidoId: partido.id, casa, source: "admin:partidos:cuotas:refresh-casa" },
        "encolarJobCaptura devolvió null (¿REDIS_URL?)",
      );
      return Response.json(
        {
          error: {
            code: "COLA_NO_DISPONIBLE",
            message:
              "La cola de captura no está disponible. Verificar REDIS_URL en Railway.",
          },
        },
        { status: 503 },
      );
    }

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "partido.cuotas_refresh_casa",
      entidad: "Partido",
      entidadId: partido.id,
      resumen: `Refresh manual de cuotas (${casa}) sobre ${partido.equipoLocal} vs ${partido.equipoVisita}`,
      metadata: {
        casa,
        ligaCanonica,
        jobId,
      },
    });

    return Response.json({
      ok: true,
      partidoId: partido.id,
      casa,
      jobId,
    });
  } catch (err) {
    logger.error(
      { err, partidoId: params.id, source: "api:admin-partidos-cuotas-refresh-casa" },
      "POST /api/v1/admin/partidos/[id]/cuotas/refresh-casa falló",
    );
    return toErrorResponse(err);
  }
}
