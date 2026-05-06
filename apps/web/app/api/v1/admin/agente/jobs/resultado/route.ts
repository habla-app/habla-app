// POST /api/v1/admin/agente/jobs/resultado — Lote V.13.
//
// Endpoint que el agente local invoca para reportar el resultado de un
// job de captura ejecutado en su Chrome. El backend persiste cuotas (o
// SIN_DATOS / ERROR), actualiza salud del scraper, recalcula estado del
// partido, y remueve el job de BullMQ.
//
// Auth: Bearer CRON_SECRET.
//
// Body:
//   {
//     "jobId": "cuotas-xxx-doradobet-initial-1234567890",
//     "partidoId": "abc",
//     "casa": "doradobet",
//     "ligaCanonica": "Liga 1 Perú",
//     "kind": "ok" | "sin_datos" | "error",
//     "resultado"?: {  // solo si kind="ok"
//       "cuotas": { "1x2": {...}, "doble_op": {...}, ... },
//       "fuente": { "url": "...", "capturadoEn": "ISO date" },
//       "eventIdCasa"?: "...",
//       "equipos"?: { "local": "...", "visita": "..." }
//     },
//     "mensaje"?: "..." // descripción si sin_datos o error
//   }

import { NextRequest } from "next/server";
import { z } from "zod";

import { logger } from "@/lib/services/logger";
import { getCuotasQueue } from "@/lib/services/cuotas-cola";
import { persistirResultadoAgente } from "@/lib/services/cuotas-worker";
import { CASAS_CUOTAS } from "@/lib/services/scrapers/types";
import { LIGAS_CANONICAS } from "@/lib/services/scrapers/ligas-id-map";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const CuotasSchema = z
  .object({
    "1x2": z
      .object({
        local: z.number().positive(),
        empate: z.number().positive(),
        visita: z.number().positive(),
      })
      .optional(),
    doble_op: z
      .object({
        x1: z.number().positive(),
        x12: z.number().positive(),
        xx2: z.number().positive(),
      })
      .optional(),
    mas_menos_25: z
      .object({
        over: z.number().positive(),
        under: z.number().positive(),
      })
      .optional(),
    btts: z
      .object({
        si: z.number().positive(),
        no: z.number().positive(),
      })
      .optional(),
  })
  .strict();

const BodySchema = z
  .object({
    jobId: z.string().min(1).max(200),
    partidoId: z.string().min(1).max(40),
    casa: z.enum(CASAS_CUOTAS),
    ligaCanonica: z.enum(LIGAS_CANONICAS),
    kind: z.enum(["ok", "sin_datos", "error"]),
    resultado: z
      .object({
        cuotas: CuotasSchema,
        fuente: z.object({
          url: z.string().url(),
          capturadoEn: z.string(),
        }),
        eventIdCasa: z.string().optional(),
        equipos: z
          .object({
            local: z.string().min(1).max(80),
            visita: z.string().min(1).max(80),
          })
          .optional(),
      })
      .optional(),
    mensaje: z.string().max(500).optional(),
  })
  .strict();

export async function POST(req: NextRequest): Promise<Response> {
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

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION",
          message: "Body inválido.",
          issues: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }
  const body = parsed.data;

  if (body.kind === "ok" && !body.resultado) {
    return Response.json(
      { error: { code: "VALIDATION", message: "kind=ok requiere `resultado`." } },
      { status: 400 },
    );
  }

  // Persistir resultado
  try {
    if (body.kind === "ok") {
      await persistirResultadoAgente({
        partidoId: body.partidoId,
        casa: body.casa,
        ligaCanonica: body.ligaCanonica,
        kind: "ok",
        resultado: {
          cuotas: body.resultado!.cuotas,
          fuente: {
            url: body.resultado!.fuente.url,
            capturadoEn: new Date(body.resultado!.fuente.capturadoEn),
          },
          eventIdCasa: body.resultado!.eventIdCasa,
          equipos: body.resultado!.equipos,
        },
      });
    } else {
      await persistirResultadoAgente({
        partidoId: body.partidoId,
        casa: body.casa,
        ligaCanonica: body.ligaCanonica,
        kind: body.kind,
        mensaje: body.mensaje,
      });
    }
  } catch (err) {
    logger.error(
      {
        partidoId: body.partidoId,
        casa: body.casa,
        err: (err as Error).message,
        source: "agente:resultado",
      },
      `persistirResultadoAgente falló · ${body.casa} — ${(err as Error).message}`,
    );
    return Response.json(
      {
        error: {
          code: "PERSIST_FAILED",
          message: (err as Error).message,
        },
      },
      { status: 500 },
    );
  }

  // Remover job de BullMQ (success o failure → fuera de la cola)
  const queue = getCuotasQueue() as {
    getJob?(id: string): Promise<{ remove?: () => Promise<void> } | null>;
  } | null;
  if (queue?.getJob) {
    try {
      const job = await queue.getJob(body.jobId);
      if (job?.remove) await job.remove();
    } catch (err) {
      logger.warn(
        {
          jobId: body.jobId,
          err: (err as Error).message,
          source: "agente:resultado",
        },
        "no se pudo remover el job de BullMQ (no crítico)",
      );
    }
  }

  return Response.json({ ok: true });
}
