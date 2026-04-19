// Constantes de tipo de evento de partido. Son strings planos porque el
// modelo Prisma `EventoPartido.tipo` es string (no enum) — así el poller
// puede aceptar nuevos tipos del API sin migración de BD.

export const TIPO_EVENTO = {
  GOL: "GOL",
  TARJETA_AMARILLA: "TARJETA_AMARILLA",
  TARJETA_ROJA: "TARJETA_ROJA",
  SUSTITUCION: "SUSTITUCION",
  FIN_PARTIDO: "FIN_PARTIDO",
  HALFTIME: "HALFTIME",
  INICIO: "INICIO",
} as const;

export type TipoEventoPartido = (typeof TIPO_EVENTO)[keyof typeof TIPO_EVENTO];

export const EQUIPO_EVENTO = {
  LOCAL: "LOCAL",
  VISITA: "VISITA",
  NEUTRAL: "NEUTRAL",
} as const;

export type EquipoEvento = (typeof EQUIPO_EVENTO)[keyof typeof EQUIPO_EVENTO];

export function esTipoEventoValido(tipo: string): tipo is TipoEventoPartido {
  return Object.values(TIPO_EVENTO).includes(tipo as TipoEventoPartido);
}
