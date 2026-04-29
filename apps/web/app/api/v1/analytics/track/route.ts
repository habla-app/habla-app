// POST /api/v1/analytics/track — Lote 6.
//
// Recibe eventos del cliente y los persiste fire-and-forget en
// `eventos_analitica`. Diseñado para ser barato:
//   - Rate limit 60/min por IP (analytics es bursty: render de la home
//     puede disparar $pageview + signup_started + comunidad_leaderboard_visto
//     en pocos segundos si el usuario navega rápido).
//   - Responde 204 sin body.
//   - No await la inserción — devolvemos antes de tocar Postgres.
//
// Auth: opcional. Si hay sesión, attach `userId`; si no, evento anónimo.
//
// Cookie consent: la responsabilidad de chequear el toggle "Analíticas"
// vive en el CLIENTE (`lib/analytics.ts:track()` corta antes de llamar).
// Acá no se chequea — un POST que llegó hasta acá es porque el cliente
// decidió mandarlo. Eventos server-side (handlers POST que llaman
// `analyticsService.track()` directo) tampoco pasan por este endpoint.

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { extractClientIp, track } from "@/lib/services/analytics.service";
import { checkLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  evento: z.string().min(1).max(100),
  // `props` debe ser un objeto. Permitimos cualquier valor JSON-serializable
  // dentro — Prisma lo guarda en JSONB.
  props: z.record(z.unknown()).optional(),
  sessionId: z.string().min(1).max(100).optional(),
  pagina: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  // Rate limit: 60 req / 60s por IP. Analytics es bursty; estándar de
  // 10/min sería demasiado restrictivo (un usuario navegando dispararía
  // $pageview + match_viewed en segundos).
  const ip = extractClientIp(req.headers);
  const rl = checkLimit(`analytics:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return new Response(null, {
      status: 429,
      headers: {
        "Retry-After": String(rl.retryAfterSec),
      },
    });
  }

  // Parse — si falla, 204 igual (analytics nunca rompe UX cliente).
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    // Loggear como warning con stats del fallo — útil si un client
    // empieza a mandar shape inválido por bug.
    logger.warn(
      { issues: parsed.error.flatten(), source: "analytics:track" },
      "POST /analytics/track body inválido — descartado",
    );
    return new Response(null, { status: 204 });
  }

  // Identificar al usuario si hay sesión (no es obligatorio).
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;

  // Fire-and-forget: NO await. Si la BD se cae, el cliente no se entera
  // y la response sale rápida.
  void track({
    evento: parsed.data.evento,
    props: parsed.data.props,
    userId,
    sessionId: parsed.data.sessionId,
    pagina: parsed.data.pagina,
    request: req,
  });

  return new Response(null, { status: 204 });
}
