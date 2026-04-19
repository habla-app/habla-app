// Traduce la string `league.round` de api-football al español para
// guardar en Partido.round. Corre una sola vez por fixture, dentro del
// poller — no queremos mapear en cada render.
//
// Inputs típicos:
//  - "Regular Season - 34"   → "Fecha 34"
//  - "Quarter-finals"         → "Cuartos de final"
//  - "Round of 16"            → "Octavos de final"
//  - "Round of 32"            → "16vos de final"
//  - "Group Stage - 1"        → "Fase de grupos · J1"
//  - "Semi-finals"            → "Semifinal"
//  - "Final"                  → "Final"
//  - "3rd Place Final"        → "Tercer puesto"
//  - "Preliminary Round"      → "Ronda preliminar"
//  - "Play-offs"              → "Playoffs"
//
// Si el input no matchea ningún patrón conocido se devuelve tal cual: al
// menos el usuario ve algo y el poller no se rompe ante rounds nuevos.

export function mapRoundToEs(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const r = raw.trim();
  if (r === "") return null;

  const regularMatch = r.match(/^Regular Season\s*-\s*(\d+)$/i);
  if (regularMatch) return `Fecha ${regularMatch[1]}`;

  const groupMatch = r.match(/^Group Stage\s*-\s*(\d+)$/i);
  if (groupMatch) return `Fase de grupos · J${groupMatch[1]}`;

  const exact: Record<string, string> = {
    "Final": "Final",
    "Semi-finals": "Semifinal",
    "Quarter-finals": "Cuartos de final",
    "Round of 16": "Octavos de final",
    "Round of 32": "16vos de final",
    "3rd Place Final": "Tercer puesto",
    "Preliminary Round": "Ronda preliminar",
    "Play-offs": "Playoffs",
  };
  if (exact[r]) return exact[r];

  return r;
}
