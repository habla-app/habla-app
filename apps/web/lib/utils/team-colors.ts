// Colores deterministas para los avatares de equipo de MatchCard.
// Mapeamos un seed estable (team.id o nombre) a un palette fijo para
// evitar problemas de trademark con escudos/colores oficiales. Cada
// equipo siempre recibe el mismo color dentro de la app.

const TEAM_PALETTE: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: "#DC2626", fg: "#FFFFFF" }, // red
  { bg: "#1E40AF", fg: "#FFFFFF" }, // indigo
  { bg: "#0891B2", fg: "#FFFFFF" }, // cyan
  { bg: "#059669", fg: "#FFFFFF" }, // emerald
  { bg: "#7C3AED", fg: "#FFFFFF" }, // violet
  { bg: "#EA580C", fg: "#FFFFFF" }, // orange
  { bg: "#DB2777", fg: "#FFFFFF" }, // pink
  { bg: "#0D9488", fg: "#FFFFFF" }, // teal
  { bg: "#9333EA", fg: "#FFFFFF" }, // purple
  { bg: "#0284C7", fg: "#FFFFFF" }, // sky
  { bg: "#B45309", fg: "#FFFFFF" }, // amber-dark
  { bg: "#1E3A8A", fg: "#FFFFFF" }, // blue-dark
];

/**
 * Color determinista del equipo a partir de un seed estable.
 * Idealmente pasar `team.id`; si no está disponible cae al nombre del
 * equipo (que también es estable).
 */
export function getTeamColor(seed: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return TEAM_PALETTE[Math.abs(hash) % TEAM_PALETTE.length];
}

/**
 * Iniciales para el avatar (2 letras). Ejemplos:
 *   "Sporting Cristal"  → "SC"
 *   "Liverpool"         → "LV"
 *   "Manchester City"   → "MC"
 */
export function getTeamInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
