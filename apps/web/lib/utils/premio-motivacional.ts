// Copy motivacional para la fila del usuario en el ranking en vivo
// (Hotfix #6 — Ítem 1.6). Deriva estado + copy a partir de:
//
//   - miPuesto: posición actual del usuario (1-indexed)
//   - puntosPropios: los puntos de su ticket
//   - ranking: todos los rows del ranking (para calcular empates)
//   - M: cantidad de puestos pagados
//
// Estados (mutuamente excluyentes):
//
//   1. "in-money-solo" (gold)
//      - miPuesto ≤ M, el usuario es el único con sus puntos
//      - Copy: "🎯 Único ganador del {N}° puesto"
//
//   2. "in-money-tie" (gold)
//      - miPuesto ≤ M, comparte puntaje con otros N-1 jugadores
//      - Copy: "🤝 Empate con {X} jugadores — premios compartidos"
//
//   3. "close" (muted)
//      - miPuesto > M, diferencia ≤ 3 posiciones
//      - Copy: "⚡ A {N} puntos del premio — no te rindas"
//
//   4. "far" (muted)
//      - miPuesto > M + 3
//      - Copy: "💪 Sigue sumando — todo se define al final"

export type PremioTone = "gold" | "muted";

export interface MotivationalCopyInput {
  miPuesto: number;
  puntosPropios: number;
  /** Subset mínimo del ranking — solo necesitamos puestos y puntos de
   *  cada fila para computar empates + diferencia al puesto M. */
  ranking: Array<{ rank: number; puntosTotal: number }>;
  M: number;
}

export interface MotivationalCopyOutput {
  emoji: string;
  copy: string;
  tone: PremioTone;
  state: "in-money-solo" | "in-money-tie" | "close" | "far";
}

export function buildMotivationalCopy(
  input: MotivationalCopyInput,
): MotivationalCopyOutput {
  const { miPuesto, puntosPropios, ranking, M } = input;

  // Estado 1/2: dentro del dinero (puesto ≤ M)
  if (M > 0 && miPuesto >= 1 && miPuesto <= M) {
    const compañeros = ranking.filter(
      (r) => r.puntosTotal === puntosPropios && r.rank !== miPuesto,
    ).length;
    // Si hay otros con los mismos puntos, es empate. El conteo `compañeros`
    // cuenta filas con mis mismos puntos excluyéndome — si >0, es tie.
    // Nota: si el usuario mismo aparece en `ranking` con miPuesto, el
    // filtro `rank !== miPuesto` lo excluye correctamente.
    const misMismosPuntos = ranking.filter(
      (r) => r.puntosTotal === puntosPropios,
    );
    if (misMismosPuntos.length > 1) {
      const otros = misMismosPuntos.length - 1;
      return {
        emoji: "🤝",
        copy: `Empate con ${otros} jugador${otros === 1 ? "" : "es"} — premios compartidos`,
        tone: "gold",
        state: "in-money-tie",
      };
    }
    void compañeros;
    return {
      emoji: "🎯",
      copy: `Único ganador del ${ordinal(miPuesto)} puesto`,
      tone: "gold",
      state: "in-money-solo",
    };
  }

  // Estado 3: cerca del premio (miPuesto en [M+1, M+3])
  if (M > 0 && miPuesto > M && miPuesto <= M + 3) {
    // Puntos que necesitaría alcanzar para entrar a M (puntos del M°).
    const puestoM = ranking.find((r) => r.rank === M);
    const puntosM = puestoM?.puntosTotal ?? puntosPropios;
    const falta = Math.max(1, puntosM - puntosPropios);
    return {
      emoji: "⚡",
      copy: `A ${falta} punto${falta === 1 ? "" : "s"} del premio — no te rindas`,
      tone: "muted",
      state: "close",
    };
  }

  // Estado 4: lejos (miPuesto > M+3 o M=0)
  return {
    emoji: "💪",
    copy: "Sigue sumando — todo se define al final",
    tone: "muted",
    state: "far",
  };
}

function ordinal(n: number): string {
  return `${n}°`;
}
