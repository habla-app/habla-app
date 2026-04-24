// GET /api/debug/sentry-test — solo para verificar que Sentry captura
// errores. Doble guardia:
//   1) Env var `SENTRY_DEBUG_TOKEN` DEBE estar seteada en Railway.
//   2) Header `X-Debug-Token` del request DEBE igualar el token.
// Si falta cualquiera de las dos, responde 404 (no 401) para que el
// endpoint sea indistinguible de una ruta inexistente.
//
// Se puede borrar después del lote una vez validado el flujo.

import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

class SentryTestError extends Error {
  constructor() {
    super("Sentry test error — disparado manualmente desde /api/debug/sentry-test");
    this.name = "SentryTestError";
  }
}

export function GET(req: NextRequest): Response {
  const expected = process.env.SENTRY_DEBUG_TOKEN;
  const provided = req.headers.get("x-debug-token");

  if (!expected || !provided || expected !== provided) {
    return new Response("Not Found", { status: 404 });
  }

  // Sentry wrappea los route handlers automáticamente — el throw llega a
  // `captureException` sin más instrumentación.
  throw new SentryTestError();
}
