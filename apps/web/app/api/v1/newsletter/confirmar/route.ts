// GET /api/v1/newsletter/confirmar?token=... — Lote 10.
//
// Marca el suscriptor como confirmado y redirige a la home con un toast
// query param. Sin auth.

import { NextRequest, NextResponse } from "next/server";
import { confirmarSuscripcion } from "@/lib/services/newsletter.service";
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
    const result = await confirmarSuscripcion(token);
    if (!result.ok) {
      return NextResponse.redirect(
        `${baseUrl}/?suscripcion=token-invalido`,
        { status: 302 },
      );
    }
    return NextResponse.redirect(
      `${baseUrl}/?suscripcion=confirmada`,
      { status: 302 },
    );
  } catch (err) {
    logger.error(
      { err, source: "api:newsletter-confirmar" },
      "GET /newsletter/confirmar falló",
    );
    return NextResponse.redirect(
      `${baseUrl}/?suscripcion=error`,
      { status: 302 },
    );
  }
}
