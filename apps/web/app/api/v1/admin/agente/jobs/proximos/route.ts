// GET /api/v1/admin/agente/jobs/proximos — Lote V.13.
//
// Endpoint que el agente local pollea para tomar jobs pendientes de la
// cola BullMQ. Cada job devuelto se "reserva" via `changeDelay(5min)`:
// si el agente NO posta resultado en ese tiempo, el job vuelve a estado
// waiting y será re-tomado por el siguiente poll.
//
// Auth: Bearer CRON_SECRET (env var del agente).
//
// Query: ?limit=N (default 5, max 50).
//
// Response:
//   {
//     "jobs": [
//       {
//         "jobId": "...",
//         "partidoId": "...",
//         "casa": "doradobet",
//         "ligaCanonica": "Liga 1 Perú",
//         "esRefresh": true,
//         "partido": {
//           "equipoLocal": "Universitario",
//           "equipoVisita": "Alianza Lima",
//           "liga": "Liga 1 Perú · Apertura"
//         }
//       }
//     ]
//   }

import { NextRequest } from "next/server";

import { prisma } from "@habla/db";
import { logger } from "@/lib/services/logger";
import { getCuotasQueue } from "@/lib/services/cuotas-cola";
import type { CuotasJobData } from "@/lib/services/scrapers/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const RESERVA_MS = 5 * 60 * 1000;
const LIMIT_DEFAULT = 5;
const LIMIT_MAX = 50;

export async function GET(req: NextRequest): Promise<Response> {
  // Auth Bearer CRON_SECRET
  const authHeader = req.headers.get("authorization");
  if (
    !authHeader?.startsWith("Bearer ") ||
    !process.env.CRON_SECRET ||
    authHeader.slice(7) !== process.env.CRON_SECRET
  ) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Bearer CRON_SECRET requerido." } },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, LIMIT_MAX)
      : LIMIT_DEFAULT;

  const queue = getCuotasQueue() as {
    getJobs(
      states: string[],
      start?: number,
      end?: number,
    ): Promise<
      Array<{
        id?: string;
        data: CuotasJobData;
        changeDelay?: (delay: number) => Promise<void>;
      }>
    >;
  } | null;
  if (!queue) {
    return Response.json(
      { error: { code: "QUEUE_UNAVAILABLE", message: "Cola BullMQ no disponible (REDIS_URL?)." } },
      { status: 503 },
    );
  }

  const jobs = await queue.getJobs(["waiting"], 0, limit - 1);
  if (jobs.length === 0) {
    return Response.json({ jobs: [] });
  }

  // Reservar via changeDelay: el job pasa a estado "delayed" 5min. Si el
  // agente reporta antes, el endpoint POST hace job.remove() y el delayed
  // se descarta. Si el agente no reporta, el job vuelve a waiting solo.
  const partidoIds = Array.from(new Set(jobs.map((j) => j.data.partidoId)));
  const partidosBD = await prisma.partido.findMany({
    where: { id: { in: partidoIds } },
    select: {
      id: true,
      equipoLocal: true,
      equipoVisita: true,
      liga: true,
      fechaInicio: true,
    },
  });
  const porId = new Map(partidosBD.map((p) => [p.id, p]));

  const respJobs: Array<{
    jobId: string;
    partidoId: string;
    casa: string;
    ligaCanonica: string;
    esRefresh: boolean;
    partido: {
      equipoLocal: string;
      equipoVisita: string;
      liga: string;
      fechaInicio: string;
    };
  }> = [];

  for (const job of jobs) {
    const partido = porId.get(job.data.partidoId);
    if (!partido) {
      // Partido borrado — descartar el job
      try {
        const j = job as unknown as { remove?: () => Promise<void> };
        if (j.remove) await j.remove();
      } catch {
        /* ignore */
      }
      continue;
    }
    try {
      if (job.changeDelay) await job.changeDelay(RESERVA_MS);
    } catch (err) {
      logger.warn(
        { jobId: job.id, err: (err as Error).message, source: "agente:proximos" },
        "changeDelay falló (no crítico) — el job sigue waiting",
      );
    }
    respJobs.push({
      jobId: String(job.id ?? ""),
      partidoId: job.data.partidoId,
      casa: job.data.casa,
      ligaCanonica: job.data.ligaCanonica,
      esRefresh: job.data.esRefresh,
      partido: {
        equipoLocal: partido.equipoLocal,
        equipoVisita: partido.equipoVisita,
        liga: partido.liga,
        fechaInicio: partido.fechaInicio.toISOString(),
      },
    });
  }

  logger.info(
    { entregados: respJobs.length, source: "agente:proximos" },
    `agente/proximos · ${respJobs.length} jobs reservados`,
  );

  return Response.json({ jobs: respJobs });
}
