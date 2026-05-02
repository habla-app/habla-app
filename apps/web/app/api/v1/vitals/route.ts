// POST /api/v1/vitals — Lote G.
//
// Recibe Core Web Vitals samples del cliente (web-vitals lib) y los persiste
// en `metricas_vitales`. Sample 10% en cliente — este endpoint procesa cada
// request que recibe.
//
// Diseño:
//   - Sin auth (público — cliente anónimo o logueado).
//   - Rate limit 100 req/min por IP (más generoso que /analytics/track porque
//     vitals son menos frecuentes pero pueden venir en burst de varias
//     métricas por pageview).
//   - 204 always — vitals nunca rompen UX.
//   - Fire-and-forget al insertar (no bloquea cliente).

import { NextRequest } from "next/server";
import { z } from "zod";
import { extractClientIp } from "@/lib/services/analytics.service";
import { checkLimit } from "@/lib/rate-limit";
import { insertarVitalSample } from "@/lib/services/vitals.service";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  // Soportamos tanto un sample único como un array (web-vitals puede
  // mandar batched al cerrar la pestaña con sendBeacon).
  samples: z
    .array(
      z.object({
        nombre: z.enum(["LCP", "INP", "CLS", "FCP", "TTFB"]),
        valor: z.number().finite(),
        ruta: z.string().min(1).max(500),
        deviceType: z.enum(["mobile", "desktop", "tablet"]).nullish(),
        connectionType: z.string().max(50).nullish(),
      }),
    )
    .min(1)
    .max(20),
});

export async function POST(req: NextRequest) {
  const ip = extractClientIp(req.headers);
  const rl = checkLimit(`vitals:${ip}`, 100, 60_000);
  if (!rl.ok) {
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfterSec) },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    logger.warn(
      { issues: parsed.error.flatten(), source: "vitals:track" },
      "POST /vitals body inválido — descartado",
    );
    return new Response(null, { status: 204 });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  for (const s of parsed.data.samples) {
    void insertarVitalSample({
      nombre: s.nombre,
      valor: s.valor,
      ruta: s.ruta,
      deviceType: s.deviceType ?? null,
      connectionType: s.connectionType ?? null,
      userAgent,
    });
  }

  return new Response(null, { status: 204 });
}
