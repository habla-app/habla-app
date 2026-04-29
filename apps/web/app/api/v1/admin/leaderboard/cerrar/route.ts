// POST /api/v1/admin/leaderboard/cerrar — Lote 5.
//
// Dispara `cerrarLeaderboard()` ad-hoc para un mes. Casos de uso:
//   - Forzar cierre de un mes pasado que el cron J no procesó (raro).
//   - Crear un cierre dummy del mes en curso para inspeccionar pipeline
//     post-deploy (con `?dummy=1`).
//
// Auth: dos modos aceptados (cualquiera basta):
//   - Sesión ADMIN (cookie de NextAuth).
//   - Header `Authorization: Bearer <CRON_SECRET>` para llamadas curl
//     desde Railway shell.
//
// Body JSON:
//   {
//     "mes": "2026-04",
//     "dummy": false   // opcional. Si true y no hay actividad real, crea
//                       //  un PremioMensual con monto 0 anclado al admin
//                       //  para que /admin/premios-mensuales tenga un row.
//     "enviarEmails": true  // opcional, default true. false = no notifica
//                            //  (útil para tests y dummies).
//   }

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  cerrarLeaderboard,
  PremioMensualEnviable,
} from "@/lib/services/leaderboard.service";
import { notifyPremioMensualGanado } from "@/lib/services/notificaciones.service";
import {
  NoAutenticado,
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z.object({
  mes: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Formato esperado: YYYY-MM"),
  dummy: z.boolean().optional(),
  enviarEmails: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Auth: sesión ADMIN o Bearer CRON_SECRET.
    let adminUserId: string | undefined;
    const session = await auth();
    if (session?.user?.id && session.user.rol === "ADMIN") {
      adminUserId = session.user.id;
    } else {
      const secret = process.env.CRON_SECRET;
      if (!secret) {
        throw new NoAutorizado(
          "CRON_SECRET no configurado y sin sesión ADMIN.",
        );
      }
      if (req.headers.get("authorization") !== `Bearer ${secret}`) {
        if (!session?.user?.id) throw new NoAutenticado();
        throw new NoAutorizado(
          "Solo administradores o Bearer CRON_SECRET pueden cerrar leaderboards.",
        );
      }
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", {
        issues: parsed.error.flatten(),
      });
    }
    const { mes, dummy = false, enviarEmails = true } = parsed.data;

    const result = await cerrarLeaderboard({
      mes,
      adminUserId,
      dummy,
    });

    if (enviarEmails && !result.alreadyClosed) {
      for (const premio of result.premiosCreados as PremioMensualEnviable[]) {
        await notifyPremioMensualGanado(premio);
      }
    }

    logger.info(
      {
        mes,
        leaderboardId: result.leaderboardId,
        premios: result.premiosCreados.length,
        dummyCreado: result.dummyCreado,
        alreadyClosed: result.alreadyClosed,
      },
      "POST /api/v1/admin/leaderboard/cerrar",
    );

    return Response.json(
      {
        data: {
          leaderboardId: result.leaderboardId,
          mes: result.mes,
          totalUsuarios: result.totalUsuarios,
          premiosCreados: result.premiosCreados.length,
          dummyCreado: result.dummyCreado,
          alreadyClosed: result.alreadyClosed,
          emailsEnviados: enviarEmails && !result.alreadyClosed,
        },
      },
      { status: result.alreadyClosed ? 200 : 201 },
    );
  } catch (err) {
    logger.error({ err }, "POST /api/v1/admin/leaderboard/cerrar falló");
    return toErrorResponse(err);
  }
}
