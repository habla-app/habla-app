// suscripciones.service.ts — placeholder Lote C v3.1.
//
// El modelo Suscripcion lo crea el Lote E (backend Premium con OpenPay BBVA
// + WhatsApp Business). Mientras no exista, este service devuelve null
// siempre — los componentes de Premium en la UI usan ese null como señal
// de "no suscriptor / no Premium" y muestran los CTAs promocionales.
//
// Lote E reemplaza esta implementación con queries reales contra la tabla
// `suscripciones`. La firma pública del service NO cambia, así que los
// callers (perfil, comunidad/torneo, comunidad/[username], live-match) no
// requieren refactor cuando llegue el modelo.

export type EstadoSuscripcion = "activa" | "cancelando" | "vencida";

export type PlanSuscripcion = "mensual" | "trimestral" | "anual";

export interface EstadoPremium {
  activa: boolean;
  estado: EstadoSuscripcion;
  plan: PlanSuscripcion;
  /** ISO date del próximo cobro o fecha de fin si está cancelando. */
  proximoCobro: Date;
  /** Link de invitación al WhatsApp Channel privado. */
  channelLink: string | null;
}

/**
 * Estado Premium del usuario. En Lote C devuelve null para todos los
 * usuarios — el modelo Suscripcion aún no existe. Lote E lo implementa
 * leyendo `prisma.suscripcion.findFirst({ usuarioId, activa: true })`.
 */
export async function obtenerEstadoPremium(
  _userId: string,
): Promise<EstadoPremium | null> {
  return null;
}

/**
 * Devuelve true si el userId tiene suscripción activa. En Lote C siempre
 * false. Helper conveniente para usar en queries paralelas (Promise.all).
 */
export async function tienePremiumActivo(_userId: string): Promise<boolean> {
  return false;
}
