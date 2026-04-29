// GET /api/v1/cuotas/[partidoId] — Lote 9.
//
// Endpoint público que sirve el cache de odds de un partido. Tres respuestas
// posibles:
//
//   - hit             → 200 { status: 'ok', data: OddsCacheEntry }
//                        Cache-Control: public, max-age=300, stale-while-revalidate=1800
//   - miss            → 200 { status: 'updating' }
//                        Dispara `actualizarOddsPartido` fire-and-forget.
//                        El cliente debe reintentar 1-2 veces en 3-6s.
//   - partido inexistente → 404 { status: 'error', message: '...' }
//
// El motivo por el que miss devuelve 200 (en vez de 202): es un endpoint de
// lectura desde RSC + client polling, y muchos infra layers (CDNs, fetch
// retries) tratan 202 como "intentá de nuevo automáticamente" — preferimos
// que el cliente decida cuándo reintenta.

import { NextRequest } from "next/server";
import { prisma } from "@habla/db";
import {
  actualizarOddsPartido,
  obtenerOddsCacheadas,
} from "@/lib/services/odds-cache.service";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteParams {
  params: { partidoId: string };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const partidoId = params.partidoId;

  if (!partidoId || partidoId.length > 50) {
    return Response.json(
      { status: "error", message: "partidoId inválido" },
      { status: 400 },
    );
  }

  // Hit primero (rápido).
  const cached = await obtenerOddsCacheadas(partidoId);
  if (cached) {
    return Response.json(
      { status: "ok", data: cached },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, max-age=300, stale-while-revalidate=1800",
        },
      },
    );
  }

  // Miss: validar que el partido existe antes de gastar un fetch a
  // api-football. 404 si no existe (ahorra quota y le da feedback al cliente).
  const exists = await prisma.partido.findUnique({
    where: { id: partidoId },
    select: { id: true },
  });
  if (!exists) {
    return Response.json(
      { status: "error", message: "Partido no encontrado" },
      { status: 404 },
    );
  }

  // Fire-and-forget: el cliente reintentará. No await — no queremos bloquear
  // el response del cliente esperando a api-football.
  void actualizarOddsPartido(partidoId).catch((err) => {
    logger.warn(
      { err, partidoId, source: "api:cuotas-miss" },
      "actualizarOddsPartido (miss) falló en background",
    );
  });

  return Response.json({ status: "updating" }, { status: 200 });
}
