// nivel — helper puro que calcula el nivel de un usuario según la
// cantidad de torneos jugados. Escalón definido en §9 del CLAUDE.md
// (Sub-Sprint 7 perfil del usuario) — se usa en /torneo/:id (inscritos)
// y en /live-match (ganador del torneo finalizado).
//
//   0-10     🥉 Novato
//   11-50    🥈 Intermedio
//   51-200   🥇 Pro
//   200+     👑 Leyenda
//
// Función pura — testeada sin jsdom, reusable en server y client.

export type NivelKey = "novato" | "intermedio" | "pro" | "leyenda";

export interface Nivel {
  key: NivelKey;
  label: string;
  emoji: string;
  /** Torneos al piso del nivel (Novato=0, Intermedio=11, …). */
  min: number;
  /** Torneos al techo del nivel, exclusivo (Novato<=10 → 11, …). Null en leyenda. */
  max: number | null;
}

const NIVELES: ReadonlyArray<Nivel> = [
  { key: "novato", label: "Novato", emoji: "🥉", min: 0, max: 11 },
  { key: "intermedio", label: "Intermedio", emoji: "🥈", min: 11, max: 51 },
  { key: "pro", label: "Pro", emoji: "🥇", min: 51, max: 201 },
  { key: "leyenda", label: "Leyenda", emoji: "👑", min: 201, max: null },
];

export function calcularNivel(torneosJugados: number): Nivel {
  // Defensive: valores negativos o no-enteros se normalizan a 0
  const n = Math.max(0, Math.floor(torneosJugados || 0));
  for (const nivel of NIVELES) {
    if (nivel.max === null) return nivel;
    if (n < nivel.max) return nivel;
  }
  // Imposible por el `max: null` de leyenda, pero TS necesita fallback.
  return NIVELES[NIVELES.length - 1]!;
}

/**
 * Siguiente nivel al que apunta el usuario. Null si ya es Leyenda.
 */
export function siguienteNivel(actual: Nivel): Nivel | null {
  const idx = NIVELES.findIndex((n) => n.key === actual.key);
  if (idx === -1 || idx === NIVELES.length - 1) return null;
  return NIVELES[idx + 1] ?? null;
}

/**
 * Torneos faltantes para alcanzar el siguiente nivel. 0 si ya es
 * Leyenda o si el cálculo no aplica.
 */
export function faltanParaSiguiente(torneosJugados: number): number {
  const actual = calcularNivel(torneosJugados);
  const sig = siguienteNivel(actual);
  if (!sig) return 0;
  return Math.max(0, sig.min - torneosJugados);
}
