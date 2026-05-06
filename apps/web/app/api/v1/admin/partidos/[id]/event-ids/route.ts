// PATCH /api/v1/admin/partidos/[id]/event-ids — Lote V fase V.5.
// Spec: docs/plan-tecnico-lote-v-motor-cuotas.md § 5.2 + § 9.5.
//
// Vincula manualmente el eventId externo de UNA casa a un partido. El admin
// pega la URL del partido en la casa; el endpoint extrae el ID con la regex
// específica, persiste en `EventIdExterno` con `metodoDiscovery="MANUAL"`
// y dispara un job de captura inmediato.
//
// Body:
//   { casa: <CasaCuotas>, url: string }
//
// Casos de error:
//   - 400 si la regex no matchea la URL.
//   - 404 si el partido no existe.
//   - 401/403 si no es admin.
//
// Auth ADMIN (regla 11). Auditoría 100% (regla 21).

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
    casa: z.enum(
      CASAS_CUOTAS as unknown as readonly [CasaCuotas, ...CasaCuotas[]],
    ),
    url: z.string().min(8).max(500),
  })
  .strict();

/**
 * Patrones de extracción por casa (sección 5.2 del plan). Si la regex no
 * matchea la URL, retorna null y el endpoint responde 400.
 *
 * Te Apuesto: el ID que se guarda es el del partido; la URL típica del
 * partido es `/sport/.../id=1,476,1899` (sport,country,tournament). Si no
 * tiene ID de partido literal en la URL, lo dejamos al caller (deberá
 * pegar la URL del torneo + el index manualmente, o usar la API
 * `matches-of-the-day` directamente).
 */
function extraerEventIdDesdeURL(casa: CasaCuotas, url: string): string | null {
  const trimmed = url.trim();
  switch (casa) {
    case "apuesta_total": {
      // Patrón: cualquier tail con 15+ dígitos.
      const m = /(\d{15,})\/?(?:[?#].*)?$/.exec(trimmed);
      return m?.[1] ?? null;
    }
    case "doradobet": {
      const m = /\/partido\/(\d+)/i.exec(trimmed);
      return m?.[1] ?? null;
    }
    case "betano": {
      // Patrón: tail con 6+ dígitos.
      const m = /(\d{6,})\/?(?:[?#].*)?$/.exec(trimmed);
      return m?.[1] ?? null;
    }
    case "inkabet": {
      // Patrón: query `eventId=XXX` o trail alfanumérico.
      const q = /[?&]eventId=([\w-]+)/i.exec(trimmed);
      if (q) return q[1] ?? null;
      const last = /\/([A-Za-z0-9_-]{8,})\/?(?:[?#].*)?$/.exec(trimmed);
      return last?.[1] ?? null;
    }
    case "te_apuesto": {
      // El POC §2.7 clarificó que Te Apuesto no tiene URL por partido —
      // sólo URL de torneo + ID en la API. Aceptamos un ID directo (sin
      // slashes) como atajo manual.
      const m = /^(\d+)$/.exec(trimmed);
      if (m) return m[1] ?? null;
      // Como fallback, aceptamos cualquier tail numérico en la URL.
      const tail = /(\d{4,})\/?(?:[?#].*)?$/.exec(trimmed);
      return tail?.[1] ?? null;
    }
    default:
      return null;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden vincular event IDs.",
      );
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", {
        issues: parsed.error.flatten(),
      });
    }
    const { casa, url } = parsed.data;

    const partido = await prisma.partido.findUnique({
      where: { id: params.id },
      select: { id: true, equipoLocal: true, equipoVisita: true, liga: true },
    });
    if (!partido) throw new PartidoNoEncontrado(params.id);

    const eventId = extraerEventIdDesdeURL(casa, url);
    if (!eventId) {
      throw new ValidacionFallida(
        `No se pudo extraer el eventId desde la URL para ${casa}. Verificá que sea la URL correcta del partido en la casa.`,
        { casa, url },
      );
    }

    await prisma.eventIdExterno.upsert({
      where: { partidoId_casa: { partidoId: partido.id, casa } },
      create: {
        partidoId: partido.id,
        casa,
        eventIdExterno: eventId,
        metodoDiscovery: "MANUAL",
        resueltoPor: session.user.id,
      },
      update: {
        eventIdExterno: eventId,
        metodoDiscovery: "MANUAL",
        resueltoPor: session.user.id,
        resueltoEn: new Date(),
      },
    });

    // Lote V.12: el motor Playwright descubre eventos por matching de
    // equipos via XHR intercept, no usa EventIdExterno como hint. Igual
    // encolamos job post-vinculación para refresh inmediato si la liga
    // tiene URL listing configurada.
    const ligaCanonica = detectarLigaCanonica(partido.liga);
    let jobId: string | null = null;
    if (ligaCanonica && obtenerUrlListado(ligaCanonica, casa)) {
      jobId = await encolarJobCaptura({
        partidoId: partido.id,
        casa,
        ligaCanonica,
        esRefresh: false,
      });
    }

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "partido.event_id_vincular_manual",
      entidad: "Partido",
      entidadId: partido.id,
      resumen: `Vinculado eventId manual de ${casa} sobre ${partido.equipoLocal} vs ${partido.equipoVisita}`,
      metadata: {
        casa,
        urlPegada: url.slice(0, 200),
        eventIdExtraido: eventId,
        jobId,
      },
    });

    return Response.json({
      ok: true,
      partidoId: partido.id,
      casa,
      eventIdExterno: eventId,
      jobId: jobId ?? null,
    });
  } catch (err) {
    logger.error(
      { err, partidoId: params.id, source: "api:admin-partidos-event-ids" },
      "PATCH /api/v1/admin/partidos/[id]/event-ids falló",
    );
    return toErrorResponse(err);
  }
}
