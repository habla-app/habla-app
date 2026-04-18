// Adapta Torneo + Partido del dominio (Prisma) → MatchCardData para la
// capa visual. Sub-Sprint 3 lo usa en `/`, `/matches` y cualquier otra
// vista que liste torneos.

import type { Partido, Torneo } from "@habla/db";
import type { MatchCardData } from "./MatchCard";
import { calcularUrgencia, formatearUrgencyLabel, inferirTipoBadge } from "@/lib/urgency";

export function torneoToCardData(
  torneo: Torneo & { partido: Partido },
  now: Date = new Date(),
): MatchCardData {
  const urgency = calcularUrgencia(torneo.cierreAt, now);
  return {
    id: torneo.id,
    liga: torneo.partido.liga,
    /* ligaIcon/equipo icons no están en el modelo — Sub-Sprint 5+ los
       puede enriquecer con el logo URL de api-football */
    ligaIcon: "⚽",
    tipoBadge: inferirTipoBadge(torneo.tipo, torneo.partido.liga),
    equipoLocal: torneo.partido.equipoLocal,
    equipoVisita: torneo.partido.equipoVisita,
    pozoBruto: torneo.pozoBruto,
    entradaLukas: torneo.entradaLukas,
    totalInscritos: torneo.totalInscritos,
    urgency,
    urgencyLabel: formatearUrgencyLabel(torneo.cierreAt, urgency, now),
  };
}
