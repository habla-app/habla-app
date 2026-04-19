// GET /api/v1/realtime/token
//
// Requiere sesión. Devuelve un JWT HS256 corto (5 min) que el cliente usa
// como `auth.token` en el handshake de Socket.io. Ver
// lib/realtime/socket-auth.ts.

import { auth } from "@/lib/auth";
import { firmarSocketToken } from "@/lib/realtime/socket-auth";
import { NoAutenticado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const token = await firmarSocketToken(session.user.id);
    return Response.json({ data: { token, ttlSeconds: 5 * 60 } });
  } catch (err) {
    logger.error({ err }, "GET /api/v1/realtime/token falló");
    return toErrorResponse(err);
  }
}
