// GET /api/v1/admin/logs — Lote 6.
//
// Tabla paginada de errores recientes para /admin/logs.
//
// Query params:
//   level     warn | error | critical (opcional)
//   source    sub-string (opcional, case-insensitive)
//   desde     ISO date (opcional)
//   hasta     ISO date (opcional)
//   page      1-indexed (default 1)
//   pageSize  default 50, max 200
//
// Auth: ADMIN o Bearer CRON_SECRET.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  obtenerErroresRecientes,
  obtenerStatsErroresUltimas24h,
  type LogLevel,
} from "@/lib/services/logs.service";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LEVELS: ReadonlyArray<LogLevel> = ["warn", "error", "critical"];

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const isAdmin = session?.user?.id && session.user.rol === "ADMIN";
    if (!isAdmin) {
      const secret = process.env.CRON_SECRET;
      if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
        if (!session?.user?.id) throw new NoAutenticado();
        throw new NoAutorizado("Sólo administradores pueden ver logs.");
      }
    }

    const { searchParams } = new URL(req.url);
    const levelRaw = searchParams.get("level");
    const level =
      levelRaw && LEVELS.includes(levelRaw as LogLevel)
        ? (levelRaw as LogLevel)
        : undefined;
    const source = searchParams.get("source") || undefined;
    const desdeStr = searchParams.get("desde");
    const hastaStr = searchParams.get("hasta");
    const page = Number(searchParams.get("page") ?? "1") || 1;
    const pageSize = Number(searchParams.get("pageSize") ?? "50") || 50;

    const [logs, stats24h] = await Promise.all([
      obtenerErroresRecientes({
        level,
        source,
        desde: desdeStr ? new Date(desdeStr) : undefined,
        hasta: hastaStr ? new Date(hastaStr) : undefined,
        page,
        pageSize,
      }),
      obtenerStatsErroresUltimas24h(),
    ]);

    return Response.json({
      data: {
        ...logs,
        stats24h,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
