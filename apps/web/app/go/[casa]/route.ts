// GET /go/[casa] — redirect tracker de afiliados (Lote 7).
//
// El usuario hace click en un CTA dorado dentro de un artículo (ej.
// `<CasaCTA slug="te-apuesto" />`), llega acá, y nosotros:
//   1. Registramos el click en `clicks_afiliados` (fire-and-forget).
//   2. Disparamos el evento `casa_click_afiliado` en `eventos_analitica`
//      (fire-and-forget) — alimenta el funnel del dashboard del Lote 6.
//   3. Redirigimos 302 a la `urlBase` afiliada del operador.
//
// Si el slug no existe o `activo=false`: 404 simple con HTML mínimo y
// mensaje "Casa no disponible". Mismo mensaje en ambos casos para no
// filtrar info sobre qué slugs existen.
//
// Auth: opcional. Si hay sesión, el `userId` queda anclado al click; si
// no, click anónimo. NO bloqueamos a usuarios anónimos: la mayoría de
// clicks legítimos son de visitantes pre-signup.
//
// IP cruda nunca se persiste (ver afiliacion.service.ts: hash + sal
// in-memory rotada por proceso).

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  parsearUtm,
  registrarClick,
} from "@/lib/services/afiliacion.service";
import { track } from "@/lib/services/analytics.service";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteParams {
  params: { casa: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const slug = params.casa.trim().toLowerCase();
  const referer = req.headers.get("referer") ?? "";

  // userId opcional — si la cookie de sesión está presente, lo attacheamos
  // al click. No es obligatorio.
  let userId: string | undefined;
  try {
    const session = await auth();
    userId = session?.user?.id;
  } catch {
    /* sin sesión — sigue como anónimo */
  }

  let urlBase: string | null = null;
  let afiliadoId: string | null = null;

  try {
    const result = await registrarClick({
      slug,
      pagina: referer,
      utm: parsearUtm(req.nextUrl.searchParams),
      request: req,
      userId,
    });
    urlBase = result.urlBase;
    afiliadoId = result.afiliadoId;
  } catch (err) {
    // Si falla la lectura del afiliado (BD caída), todavía intentamos no
    // romper UX: respondemos 404 amistoso. Loggeamos como error porque la
    // home/artículos quedan con CTAs muertos hasta que vuelva.
    logger.error(
      { err, slug, source: "api:go-redirect" },
      "GET /go/[casa] falló al leer afiliado",
    );
    return casaNoDisponibleResponse();
  }

  if (!urlBase) {
    // Slug no existe o activo=false. Mismo mensaje en ambos casos.
    return casaNoDisponibleResponse();
  }

  // Lote 7: tracking del evento `casa_click_afiliado`. Server-side, no
  // pasa por el cookie consent del cliente — es operativo, alimenta el
  // funnel del dashboard.
  void track({
    evento: "casa_click_afiliado",
    props: {
      afiliado: slug,
      afiliadoId,
      pagina_origen: referer || null,
    },
    userId,
    request: req,
    pagina: `/go/${slug}`,
  });

  return NextResponse.redirect(urlBase, { status: 302 });
}

function casaNoDisponibleResponse(): Response {
  // HTML mínimo en lugar del JSON estándar de errores: este endpoint lo
  // visita un humano (click directo en CTA), no un fetch. Mostramos algo
  // legible si por algún motivo aterrizan acá con un slug inválido.
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Casa no disponible · Habla!</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #F8F9FB; color: #14171F; margin: 0; padding: 48px 20px; text-align: center; }
  h1 { font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.02em; margin: 0 0 12px; }
  p { font-size: 15px; color: #6B7280; max-width: 480px; margin: 0 auto 28px; line-height: 1.55; }
  a { display: inline-block; background: #FFB800; color: #000; padding: 12px 24px; border-radius: 6px; font-weight: 700; text-decoration: none; font-size: 14px; }
  a:hover { background: #FFD060; }
</style>
</head>
<body>
  <h1>Casa no disponible</h1>
  <p>El operador al que intentabas ir no está disponible en este momento. Volvé al inicio para ver las casas autorizadas que tenemos cargadas.</p>
  <a href="/">Volver al inicio</a>
</body>
</html>`;
  return new Response(html, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
