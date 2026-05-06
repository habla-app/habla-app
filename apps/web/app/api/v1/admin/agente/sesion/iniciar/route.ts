// POST /api/v1/admin/agente/sesion/iniciar — Lote V.14.
//
// Endpoint que la UI admin invoca al pulsar "Actualizar cuotas". Genera
// un token de sesión, encola los jobs correspondientes en BullMQ y
// devuelve la URL del Custom URL Protocol (`habla-agente://run?token=xxx`)
// para que el browser dispare el agente local del admin.
//
// Auth: ADMIN (sesión).
//
// Body:
//   {
//     "scope": "partido" | "global",
//     "partidoId"?: "..."  // solo si scope=partido
//   }
//
// Response:
//   {
//     "ok": true,
//     "token": "uuid",
//     "urlProtocol": "habla-agente://run?token=...",
//     "partidoIds": ["..."],
//     "jobsTotales": 5
//   }

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import {
  NoAutenticado,
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { crearSesionAgente } from "@/lib/services/agente-sesion.service";
import { encolarRefresh } from "@/lib/services/captura-cuotas.service";
import { logAuditoria } from "@/lib/services/auditoria.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z
  .object({
    scope: z.enum(["partido", "global"]),
    partidoId: z.string().min(1).max(40).optional(),
  })
  .strict();

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden lanzar el agente de cuotas.",
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

    if (body.scope === "partido" && !body.partidoId) {
      throw new ValidacionFallida(
        "scope=partido requiere `partidoId`.",
      );
    }

    // Resolver lista de partidoIds según el scope
    let partidoIds: string[];
    if (body.scope === "partido") {
      const p = await prisma.partido.findUnique({
        where: { id: body.partidoId! },
        select: { id: true },
      });
      if (!p) {
        return Response.json(
          { error: { code: "PARTIDO_NO_EXISTE", message: `Partido ${body.partidoId} no existe.` } },
          { status: 404 },
        );
      }
      partidoIds = [p.id];
    } else {
      // scope === "global": todos los partidos con Filtro 1 ON, futuros
      const partidos = await prisma.partido.findMany({
        where: {
          mostrarAlPublico: true,
          estado: "PROGRAMADO",
          fechaInicio: { gte: new Date() },
        },
        select: { id: true },
      });
      partidoIds = partidos.map((p) => p.id);
      if (partidoIds.length === 0) {
        return Response.json({
          ok: true,
          token: null,
          urlProtocol: null,
          partidoIds: [],
          jobsTotales: 0,
          mensaje: "No hay partidos con Filtro 1 activado.",
        });
      }
    }

    // Encolar jobs en BullMQ para cada partido
    let jobsTotales = 0;
    const erroresEncolar: string[] = [];
    for (const pid of partidoIds) {
      try {
        const r = await encolarRefresh(pid);
        jobsTotales += r.casasEncoladas;
      } catch (err) {
        erroresEncolar.push(`${pid}: ${(err as Error).message.slice(0, 80)}`);
      }
    }

    // Crear sesión en Redis con el token + lista de partidoIds
    const sesion = await crearSesionAgente({
      scope: body.scope,
      partidoIds,
    });
    if (!sesion) {
      return Response.json(
        {
          error: {
            code: "REDIS_NO_DISPONIBLE",
            message: "Redis no disponible — no se puede crear sesión del agente.",
          },
        },
        { status: 503 },
      );
    }

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "agente.sesion_iniciar",
      entidad: "MotorCuotas",
      entidadId: body.scope === "partido" ? body.partidoId! : "global",
      resumen: `Lanzar agente local · scope=${body.scope} · ${partidoIds.length} partidos · ${jobsTotales} jobs`,
      metadata: {
        scope: body.scope,
        partidoIds,
        jobsTotales,
        erroresEncolar: erroresEncolar.slice(0, 10),
      },
    });

    logger.info(
      {
        scope: body.scope,
        partidoIds: partidoIds.length,
        jobsTotales,
        erroresEncolar: erroresEncolar.length,
        source: "api:agente:sesion-iniciar",
      },
      `sesion-iniciar · scope=${body.scope} · ${jobsTotales} jobs encolados`,
    );

    return Response.json({
      ok: true,
      token: sesion.token,
      urlProtocol: sesion.urlProtocol,
      partidoIds,
      jobsTotales,
    });
  } catch (err) {
    logger.error(
      { err: (err as Error).message, source: "api:agente:sesion-iniciar" },
      "POST /api/v1/admin/agente/sesion/iniciar falló",
    );
    return toErrorResponse(err);
  }
}
