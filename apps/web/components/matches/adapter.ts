// Adapta Torneo + Partido del dominio (Prisma) → MatchCardData para la
// capa visual. Sub-Sprint 3 lo usa en `/`, `/matches` y cualquier otra
// vista que liste torneos.
//
// Fase 3: el adapter ya no computa urgency/labels; MatchCard los
// resuelve en render desde `fechaInicio` y `cierreAt`. Esto permite
// mantener la data cruda y evitar recalcular strings si el componente
// cambia de presentación.

import type { Partido, Torneo } from "@habla/db";
import type { MatchCardData } from "./MatchCard";

export function torneoToCardData(
  torneo: Torneo & { partido: Partido },
): MatchCardData {
  return {
    id: torneo.id,
    liga: torneo.partido.liga,
    round: torneo.partido.round,
    venue: torneo.partido.venue,
    equipoLocal: torneo.partido.equipoLocal,
    equipoVisita: torneo.partido.equipoVisita,
    totalInscritos: torneo.totalInscritos,
    fechaInicio: torneo.partido.fechaInicio,
    cierreAt: torneo.cierreAt,
  };
}
