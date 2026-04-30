// estado-usuario.service.ts — detección del estado de session para CTAs
// jerárquicos del modelo v3.1 (Lote B). Spec:
// docs/ux-spec/01-arquitectura/flujos-navegacion.md §"Estados del usuario".
//
// Devuelve el estado en el que se encuentra una visita:
//
// - 'anonimo' → sin session
// - 'free'    → con session, sin suscripción ni FTD reportado
// - 'ftd'     → con session + cookie afiliado + flag usuario.ftdReportado
// - 'premium' → con session + suscripción Premium activa
// - 'admin'   → rol ADMIN (no es target de conversión, pero se distingue)
//
// Las columnas `ftdReportado` y `tieneSuscripcionActiva` se introducen en
// Lote D/E. Mientras esos campos no existan en `Usuario`, este servicio
// devuelve 'free' por default para usuarios autenticados — fallback seguro
// para que las vistas v3.1 ya cableen los CTAs jerárquicos sin romper el
// build cuando los modelos backend aún no estén.

import { prisma } from "@habla/db";

export type EstadoUsuario =
  | "anonimo"
  | "free"
  | "ftd"
  | "premium"
  | "admin";

/**
 * Detecta el estado del usuario para personalizar la UI.
 *
 * Acepta `userId` undefined (visitante anónimo). Si se pasa un id que no
 * existe en BD, fallback a 'anonimo' — el caller que sí tiene session pero
 * cuyo usuario fue eliminado debería volver a auth signin (lo maneja el
 * middleware existente).
 */
export async function detectarEstadoUsuario(
  userId: string | undefined | null,
): Promise<EstadoUsuario> {
  if (!userId) return "anonimo";

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { rol: true, deletedAt: true },
    });
    if (!usuario || usuario.deletedAt) return "anonimo";
    if (usuario.rol === "ADMIN") return "admin";

    // FTD y Premium dependen de columnas/modelos que se introducen en
    // Lotes D y E. Por ahora todos los autenticados son "free". Cuando
    // los modelos existan, este servicio se extiende sin tocar callers.
    return "free";
  } catch {
    return "anonimo";
  }
}
