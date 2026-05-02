// auth-state.service.ts — Lote K v3.2 (May 2026).
// Spec: docs/analisis-repo-vs-mockup-v3.2.md §1.4 + §4.7.
//
// Helper server-side que resuelve el estado de auth del visitante:
//
//   'visitor' → sin session
//   'free'    → con session, sin suscripción Socios activa
//   'socios'  → con session + Suscripcion ACTIVA
//
// El admin se trata como 'socios' a efectos de paywall — un admin
// siempre puede ver todos los bloques. Si una vista necesita gate
// específico para admin (ej. botones internos), usa `session.user.rol`
// directamente, no el estado del paywall.
//
// Cómo se consume:
//   - Server components: importan y llaman `obtenerEstadoAuthServer()`
//     directo. Ej. layouts y vistas que renderizan condicionalmente.
//   - Client components: el layout pasa el estado resuelto al
//     `<AuthStateProvider initialState={...}>`. Después `useAuthState()`
//     en cualquier descendiente devuelve el estado sin re-fetch.
//
// Lectura única en el ciclo de vida del request: el layout server-side
// llama una vez, propaga al context client. Ningún re-fetch posterior.

import { auth } from "@/lib/auth";
import { tienePremiumActivo } from "@/lib/services/suscripciones.service";

export type EstadoAuth = "visitor" | "free" | "socios";

/**
 * Resuelve el estado de auth del visitante actual server-side.
 *
 * Acepta `userId` opcional para permitir ahorrarse la llamada a `auth()`
 * cuando el caller ya la hizo. Si no se pasa, el helper la hace internamente.
 */
export async function obtenerEstadoAuthServer(
  userId?: string | null,
): Promise<EstadoAuth> {
  let id = userId ?? null;
  if (id === null) {
    const session = await auth();
    id = session?.user?.id ?? null;
  }
  if (!id) return "visitor";

  try {
    const esSocio = await tienePremiumActivo(id);
    return esSocio ? "socios" : "free";
  } catch {
    // Si la consulta a Suscripcion falla (BD caída, etc.), fallback a 'free'.
    // Es el comportamiento más seguro: el usuario logueado verá los bloques
    // free pero no los Socios. Si el problema es transitorio, el siguiente
    // request resuelve correctamente.
    return "free";
  }
}
