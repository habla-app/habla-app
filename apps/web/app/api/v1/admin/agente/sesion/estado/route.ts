// GET /api/v1/admin/agente/sesion/estado?token=xxx — Lote V.14.1.
//
// La UI admin invoca este endpoint cada 5s tras pulsar "↻ Actualizar
// cuotas" para detectar cuándo el agente terminó. Cuando devuelve
// `terminada: true`, la UI hace `router.refresh()` y para el polling.
//
// Auth: ADMIN (sesión).
//
// Query: ?token=xxx
//
// Response:
//   {
//     "ok": true,
//     "terminada": boolean,
//     "jobsRestantes": number,
//     "partidoIds": string[],
//     "jobsTotalesEnSesion": number,
//     "jobsProcesados": number
//   }

import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import {
  NoAutenticado,
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { getCuotasQueue } from "@/lib/services/cuotas-cola";
import { validarSesionAgente } from "@/lib/services/agente-sesion.service";
import { CUOTAS_CONFIG } from "@/lib/config/cuotas";
import type { CuotasJobData } from "@/lib/services/scrapers/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden ver el estado del agente.",
      );
    }

    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      throw new ValidacionFallida("Falta `token` en query.");
    }

    const sesion = await validarSesionAgente(token);
    if (!sesion) {
      // Token expiró o no existe → tratamos como "terminada" para que
      // la UI refresque y deje de pollear.
      return Response.json({
        ok: true,
        terminada: true,
        jobsRestantes: 0,
        partidoIds: [],
        jobsTotalesEnSesion: 0,
        jobsProcesados: 0,
      });
    }

    const queue = getCuotasQueue() as {
      getJobs(
        states: string[],
        start?: number,
        end?: number,
      ): Promise<Array<{ data: CuotasJobData }>>;
    } | null;
    if (!queue) {
      return Response.json(
        {
          error: {
            code: "QUEUE_UNAVAILABLE",
            message: "Cola BullMQ no disponible.",
          },
        },
        { status: 503 },
      );
    }

    // Contar jobs pendientes (waiting + active + delayed) cuyos
    // partidoIds estén en la sesión.
    const partidoIdsSet = new Set(sesion.partidoIds);
    const pendientes = await queue.getJobs(
      ["waiting", "active", "delayed"],
      0,
      999,
    );
    const jobsRestantes = pendientes.filter((j) =>
      partidoIdsSet.has(j.data.partidoId),
    ).length;

    const jobsTotalesEnSesion =
      sesion.partidoIds.length * CUOTAS_CONFIG.CASAS.length;
    const jobsProcesados = Math.max(
      0,
      jobsTotalesEnSesion - jobsRestantes,
    );

    return Response.json({
      ok: true,
      terminada: jobsRestantes === 0,
      jobsRestantes,
      partidoIds: sesion.partidoIds,
      jobsTotalesEnSesion,
      jobsProcesados,
    });
  } catch (err) {
    logger.error(
      { err: (err as Error).message, source: "api:agente:sesion-estado" },
      "GET /agente/sesion/estado falló",
    );
    return toErrorResponse(err);
  }
}
