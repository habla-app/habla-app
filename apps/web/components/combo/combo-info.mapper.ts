// Mapper puro `GET /api/v1/torneos/:id → ComboTorneoInfo`. Lo reusan
// MatchCardCTA + AutoOpenComboFromQuery para no duplicar lógica.
//
// Lote 2 (Abr 2026): se demolió el sistema de Lukas. El mapper queda
// reducido a la info no-económica: nombre del partido, equipos, cierre y
// si el usuario tiene un placeholder previo.

import type { ComboTorneoInfo } from "./ComboModal";

/**
 * Forma mínima que devuelve `GET /api/v1/torneos/:id` y que consumen los
 * launchers del ComboModal. Mantenerla en sync con
 * `apps/web/app/api/v1/torneos/[id]/route.ts`.
 */
export interface TorneoApiResponse {
  data?: {
    torneo: {
      id: string;
      nombre: string;
      cierreAt: string;
      partido: { equipoLocal: string; equipoVisita: string };
    };
    miTicket: { id: string } | null;
  };
}

export function buildComboTorneoInfo(
  payload: TorneoApiResponse,
): ComboTorneoInfo | null {
  const d = payload.data;
  if (!d) return null;

  return {
    torneoId: d.torneo.id,
    partidoNombre: `${d.torneo.partido.equipoLocal} vs ${d.torneo.partido.equipoVisita}`,
    equipoLocal: d.torneo.partido.equipoLocal,
    equipoVisita: d.torneo.partido.equipoVisita,
    cierreAt: d.torneo.cierreAt,
    tienePlaceholder: d.miTicket !== null,
  };
}
