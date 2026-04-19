// Tests del mapper api-football events → EventoPartido.

import { describe, expect, it } from "vitest";
import { mapEvento } from "@/lib/services/eventos.mapper";
import type {
  ApiFootballEvent,
  ApiFootballFixture,
} from "@/lib/services/api-football.client";

const fixture = {
  fixture: { id: 1, date: "", timestamp: 0, status: { long: "", short: "1H", elapsed: 45 } },
  league: { id: 0, name: "", country: "", season: 2025, round: "" },
  teams: {
    home: { id: 100, name: "Local FC", logo: "" },
    away: { id: 200, name: "Visita FC", logo: "" },
  },
  goals: { home: null, away: null },
} as unknown as ApiFootballFixture;

function ev(partial: Partial<ApiFootballEvent>): ApiFootballEvent {
  return {
    time: { elapsed: 45, extra: null },
    team: { id: 100, name: "Local FC" },
    player: { id: 10, name: "Guerrero" },
    assist: { id: null, name: null },
    type: "Goal",
    detail: "Normal Goal",
    comments: null,
    ...partial,
  } as ApiFootballEvent;
}

describe("mapEvento", () => {
  it("mapea un gol normal del local", () => {
    const m = mapEvento(ev({ type: "Goal", detail: "Normal Goal" }), fixture);
    expect(m).toEqual({
      tipo: "GOL",
      minuto: 45,
      equipo: "LOCAL",
      jugador: "Guerrero",
      detalle: "Normal Goal",
    });
  });

  it("mapea gol con tiempo extra", () => {
    const m = mapEvento(
      ev({ time: { elapsed: 45, extra: 3 } }),
      fixture,
    );
    expect(m?.minuto).toBe(48);
  });

  it("identifica tarjeta amarilla", () => {
    const m = mapEvento(
      ev({ type: "Card", detail: "Yellow Card" }),
      fixture,
    );
    expect(m?.tipo).toBe("TARJETA_AMARILLA");
  });

  it("identifica tarjeta roja directa", () => {
    const m = mapEvento(
      ev({ type: "Card", detail: "Red Card" }),
      fixture,
    );
    expect(m?.tipo).toBe("TARJETA_ROJA");
  });

  it("identifica doble amarilla como roja", () => {
    const m = mapEvento(
      ev({ type: "Card", detail: "Second Yellow card" }),
      fixture,
    );
    expect(m?.tipo).toBe("TARJETA_ROJA");
  });

  it("marca equipo VISITA correctamente", () => {
    const m = mapEvento(
      ev({ team: { id: 200, name: "Visita FC" } }),
      fixture,
    );
    expect(m?.equipo).toBe("VISITA");
  });

  it("ignora Missed Penalty", () => {
    const m = mapEvento(
      ev({ type: "Goal", detail: "Missed Penalty" }),
      fixture,
    );
    expect(m).toBeNull();
  });

  it("mapea subst como SUSTITUCION", () => {
    const m = mapEvento(
      ev({ type: "subst", detail: "Substitution 1" }),
      fixture,
    );
    expect(m?.tipo).toBe("SUSTITUCION");
  });

  it("devuelve null para tipos desconocidos", () => {
    const m = mapEvento(ev({ type: "Var", detail: "VAR" }), fixture);
    expect(m).toBeNull();
  });
});
