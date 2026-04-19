// Firma/verificación de tokens cortos para el handshake de Socket.io.
//
// NextAuth v5 usa JWE (JWT encriptado) con una rotación de clave derivada
// de AUTH_SECRET. Parsear eso desde el server WS es frágil porque la
// API es interna (v5 está en beta.30). Usamos un camino más simple y
// explícito:
//
//   1. El cliente, estando autenticado, pide GET /api/v1/realtime/token.
//      El route handler corre con `auth()` y firma un JWT corto (5 min)
//      con `AUTH_SECRET` + HS256 que contiene `{ usuarioId }`.
//   2. El cliente pasa ese token en la query del handshake de Socket.io
//      (`io(url, { auth: { token } })`).
//   3. El server WS verifica el token con `jose` y expone
//      `socket.data.usuarioId`.
//
// Beneficios: zero dependencia de internals de NextAuth, token tiene
// vida corta (aunque la sesión es larga), se puede rotar sin tirar
// sesiones.

import { jwtVerify, SignJWT } from "jose";

const ALG = "HS256";
const DEFAULT_TTL_SECONDS = 5 * 60; /* 5 min */

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET/NEXTAUTH_SECRET no configurado — WS no puede firmar tokens.",
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SocketTokenPayload {
  usuarioId: string;
  iat?: number;
  exp?: number;
}

export async function firmarSocketToken(
  usuarioId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<string> {
  const key = getSecretKey();
  const token = await new SignJWT({ usuarioId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key);
  return token;
}

export async function verificarSocketToken(
  token: string,
): Promise<SocketTokenPayload | null> {
  try {
    const key = getSecretKey();
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] });
    const usuarioId = (payload as { usuarioId?: string }).usuarioId;
    if (!usuarioId || typeof usuarioId !== "string") return null;
    return {
      usuarioId,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}
