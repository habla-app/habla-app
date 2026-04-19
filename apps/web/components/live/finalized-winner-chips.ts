// Helper puro: deriva las 5 chips de predicción del ganador a partir
// de su `RankingRow` (predicciones + puntosDetalle). Para un torneo
// FINALIZADO todas las chips son correct/wrong — no hay pending.
//
// Usado por `/live-match/page.tsx` al construir los `FinalizedMatchCard`
// que alimentan la sección de finalizados (Bug #16).

import type { RankingRow } from "@/lib/services/ranking.service";
import type { EstadoChipFinalizado } from "./LiveFinalizedSection";

export interface FinalizedChip {
  label: string;
  estado: EstadoChipFinalizado;
}

function cortoNombre(nombre: string): string {
  const n = nombre.trim();
  if (n.length <= 8) return n;
  return n.split(/\s+/)[0] ?? n.slice(0, 8);
}

/**
 * Traduce la row del ranking a las 5 chips con acierto/fallo final.
 * Para un torneo FINALIZADO: puntos > 0 → correct, puntos === 0 → wrong.
 * No devuelve "pending" — eso es para torneos EN_VIVO.
 */
export function buildFinalizedWinnerChips(
  row: Pick<RankingRow, "predicciones" | "puntosDetalle">,
  equipoLocal: string,
  equipoVisita: string,
): FinalizedChip[] {
  const p = row.predicciones;
  const d = row.puntosDetalle;

  const label1x2 =
    p.predResultado === "LOCAL"
      ? cortoNombre(equipoLocal)
      : p.predResultado === "VISITA"
        ? cortoNombre(equipoVisita)
        : "Empate";

  return [
    { label: label1x2, estado: d.resultado > 0 ? "correct" : "wrong" },
    {
      label: `Ambos ${p.predBtts ? "Sí" : "No"}`,
      estado: d.btts > 0 ? "correct" : "wrong",
    },
    {
      label: `+2.5 ${p.predMas25 ? "Sí" : "No"}`,
      estado: d.mas25 > 0 ? "correct" : "wrong",
    },
    {
      label: `Roja ${p.predTarjetaRoja ? "Sí" : "No"}`,
      estado: d.tarjeta > 0 ? "correct" : "wrong",
    },
    {
      label: `${p.predMarcadorLocal}-${p.predMarcadorVisita}`,
      estado: d.marcador > 0 ? "correct" : "wrong",
    },
  ];
}
