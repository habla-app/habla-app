// POST /api/v1/newsletter/suscribir — Lote 10.
//
// Crea (o reactiva) un SuscriptorNewsletter y manda email de confirmación
// con magic link firmado (TTL 7d). Sin auth — el form de /suscribir y el
// componente <NewsletterCTA> en footers son públicos.
//
// Body: { email: string, fuente?: string }
// Rate-limit: 5/min por IP (in-memory). Usa el mismo helper que /analytics/track.
// Tracking: dispara `newsletter_suscripcion` server-side (bypass del toggle
// del cookie banner — es un evento de producto, no de UX).

import { NextRequest } from "next/server";
import { z } from "zod";
import { suscribirEmail } from "@/lib/services/newsletter.service";
import { track } from "@/lib/services/analytics.service";
import { checkLimit } from "@/lib/rate-limit";
import {
  toErrorResponse,
  ValidacionFallida,
  DomainError,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SuscribirSchema = z.object({
  email: z
    .string()
    .email("Email inválido.")
    .max(254)
    .transform((s) => s.trim().toLowerCase()),
  fuente: z.string().min(1).max(50).optional(),
});

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

export async function POST(req: NextRequest) {
  try {
    // Rate limit por IP (cf-connecting-ip o x-forwarded-for primer hop).
    const ip = extractIp(req.headers);
    const limit = checkLimit(`newsletter:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!limit.ok) {
      return Response.json(
        {
          error: {
            code: "RATE_LIMIT",
            message: `Muchas solicitudes. Intentá de nuevo en ${limit.retryAfterSec}s.`,
          },
        },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      );
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = SuscribirSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Datos inválidos.", {
        issues: parsed.error.flatten(),
      });
    }

    const result = await suscribirEmail({
      email: parsed.data.email,
      fuente: parsed.data.fuente ?? "page-suscribir",
    });

    // Lote 10 — analytics: trackeamos cada suscripción (estado ∈
    // creado|reenvio-confirm|ya-confirmado para distinguir métricas).
    void track({
      evento: "newsletter_suscripcion",
      props: {
        fuente: parsed.data.fuente ?? "page-suscribir",
        estado: result.estado,
      },
      request: req,
    });

    return Response.json({
      ok: true,
      data: { email: result.email, estado: result.estado },
    });
  } catch (err) {
    if (!(err instanceof DomainError)) {
      logger.error(
        { err, source: "api:newsletter-suscribir" },
        "POST /newsletter/suscribir falló",
      );
    }
    return toErrorResponse(err);
  }
}

function extractIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
