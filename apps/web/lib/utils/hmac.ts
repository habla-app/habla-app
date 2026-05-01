// HMAC-SHA256 + comparación constant-time usando Web Crypto.
//
// Por qué no `node:crypto`: cualquier archivo que importe `node:crypto`
// es arrastrado al edge bundle por Next vía imports transitivos (auth →
// adapter → service → ...) y rompe el build con UnhandledSchemeError.
// Mismo problema ya documentado en `analytics.service.ts:21-25` y
// resuelto allá con `globalThis.crypto.subtle.digest`. Este módulo
// extiende la misma estrategia a HMAC-SHA256.
//
// Web Crypto está disponible en Node 20+ (Railway runtime) y en edge.

/**
 * Calcula HMAC-SHA256(secret, body) y devuelve el hex (64 chars).
 * Funciona en edge y en node sin imports nativos.
 */
export async function hmacSha256Hex(
  secret: string,
  body: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(body));
  const bytes = new Uint8Array(sig);
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Comparación constant-time de dos strings hex de igual longitud.
 * Reemplaza `crypto.timingSafeEqual` para evitar `node:crypto`.
 * Si las longitudes difieren, retorna false (igual que la versión nativa).
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
