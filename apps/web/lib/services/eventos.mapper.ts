// Mapper api-football events → EventoPartido (Prisma).
//
// api-football devuelve eventos con shape:
//   { time: { elapsed, extra }, team: {...}, player: {...}, type, detail }
//
// Tipos relevantes (type):
//   - "Goal"    → GOL  (detail: "Normal Goal" | "Penalty" | "Own Goal" | "Missed Penalty")
//   - "Card"    → TARJETA_AMARILLA | TARJETA_ROJA  (detail: "Yellow Card" | "Red Card" | "Second Yellow card")
//   - "subst"   → SUSTITUCION

import type { ApiFootballEvent, ApiFootballFixture } from "./api-football.client";
import type { EquipoEvento, TipoEventoPartido } from "../realtime/eventos";

export interface EventoPartidoInput {
  tipo: TipoEventoPartido;
  minuto: number;
  equipo: EquipoEvento;
  jugador: string | null;
  detalle: string | null;
}

/**
 * Traduce un evento individual de api-football a nuestro shape. Devuelve
 * null si es un tipo que no nos interesa (VAR no confirmado, etc.).
 */
export function mapEvento(
  ev: ApiFootballEvent,
  fixture: ApiFootballFixture,
): EventoPartidoInput | null {
  const minuto = (ev.time.elapsed ?? 0) + (ev.time.extra ?? 0);
  const equipo = mapEquipo(ev.team.id, fixture);
  const jugador = ev.player?.name ?? null;
  const detalle = ev.detail;

  const type = (ev.type || "").toLowerCase();
  const detailLower = (ev.detail || "").toLowerCase();

  if (type === "goal") {
    // Ignoramos "Missed Penalty" y "Own Goal" técnicamente NO son goal
    // para el equipo del que juega el jugador, pero api-football
    // reporta team=equipo-que-anota-o-pierde. Confiamos en que team.id
    // refleja al equipo que suma en goles.
    if (detailLower.includes("missed")) return null;
    return { tipo: "GOL", minuto, equipo, jugador, detalle };
  }

  if (type === "card") {
    if (
      detailLower.includes("red") ||
      detailLower.includes("second yellow")
    ) {
      return { tipo: "TARJETA_ROJA", minuto, equipo, jugador, detalle };
    }
    if (detailLower.includes("yellow")) {
      return {
        tipo: "TARJETA_AMARILLA",
        minuto,
        equipo,
        jugador,
        detalle,
      };
    }
    return null;
  }

  if (type === "subst") {
    return { tipo: "SUSTITUCION", minuto, equipo, jugador, detalle };
  }

  return null;
}

export function mapEquipo(
  teamId: number,
  fixture: ApiFootballFixture,
): EquipoEvento {
  if (teamId === fixture.teams.home.id) return "LOCAL";
  if (teamId === fixture.teams.away.id) return "VISITA";
  return "NEUTRAL";
}

// ---------------------------------------------------------------------------
// Stats mapper — devuelve 7 métricas estándar por lado
// ---------------------------------------------------------------------------

export interface EstadisticasPartidoLado {
  posesion: number | null; /* % entero 0-100 */
  tiros: number | null;
  tirosAlArco: number | null;
  tarjetas: number | null;
  corners: number | null;
  faltas: number | null;
  offsides: number | null;
  pases: number | null;
}

export function parsePorcentaje(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = Number.parseInt(val.replace("%", "").trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function parseEntero(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val === "string") {
    const n = Number.parseInt(val.trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
