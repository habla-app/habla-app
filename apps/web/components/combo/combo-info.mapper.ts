// Mapper puro `GET /api/v1/torneos/:id → ComboTorneoInfo`. Se extrae del
// ComboLauncher para que MatchCardCTA + AutoOpenComboFromQuery reutilicen
// la misma derivación (primer premio estimado, placeholder, pozo neto
// fallback) sin duplicar lógica — y para poder cubrirlo con test puro
// sin levantar jsdom.
//
// Si el torneo sigue ABIERTO, `pozoNeto` en BD suele ser 0 porque recién
// se calcula al cierre. Aplicamos fallback `pozoBruto × 0.88` (el 88% del
// bruto — rake del 12% fijo por §6 CLAUDE.md).

import { DISTRIB_PREMIOS_FE } from "./premios";
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
      entradaLukas: number;
      pozoBruto: number;
      pozoNeto: number;
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

  const pozoNeto =
    d.torneo.pozoNeto > 0
      ? d.torneo.pozoNeto
      : Math.floor(d.torneo.pozoBruto * 0.88);

  return {
    torneoId: d.torneo.id,
    partidoNombre: `${d.torneo.partido.equipoLocal} vs ${d.torneo.partido.equipoVisita}`,
    equipoLocal: d.torneo.partido.equipoLocal,
    equipoVisita: d.torneo.partido.equipoVisita,
    entradaLukas: d.torneo.entradaLukas,
    pozoBruto: d.torneo.pozoBruto,
    primerPremioEstimado: Math.floor(pozoNeto * DISTRIB_PREMIOS_FE.primero),
    cierreAt: d.torneo.cierreAt,
    tienePlaceholder: d.miTicket !== null,
  };
}
