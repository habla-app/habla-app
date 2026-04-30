// GET /api/v1/newsletter/unsubscribe?token=... — Lote 10.
//
// Marca el suscriptor como desuscrito (`unsubscribedEn=now`) y, si hay
// Usuario con ese email, también pone `notifSemanal=false`. Sin auth.

import { NextRequest, NextResponse } from "next/server";
import { desuscribir } from "@/lib/services/newsletter.service";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

  if (!token) {
    return NextResponse.redirect(
      `${baseUrl}/?suscripcion=token-faltante`,
      { status: 302 },
    );
  }

  try {
    const result = await desuscribir(token);
    if (!result.ok) {
      return NextResponse.redirect(
        `${baseUrl}/?suscripcion=token-invalido`,
        { status: 302 },
      );
    }
    return NextResponse.redirect(
      `${baseUrl}/?suscripcion=cancelada`,
      { status: 302 },
    );
  } catch (err) {
    logger.error(
      { err, source: "api:newsletter-unsubscribe" },
      "GET /newsletter/unsubscribe falló",
    );
    return NextResponse.redirect(
      `${baseUrl}/?suscripcion=error`,
      { status: 302 },
    );
  }
}
