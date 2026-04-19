import { describe, it, expect } from "vitest";
import { mapRoundToEs } from "./round-mapper";

describe("mapRoundToEs", () => {
  it("traduce 'Regular Season - N' a 'Fecha N'", () => {
    expect(mapRoundToEs("Regular Season - 34")).toBe("Fecha 34");
    expect(mapRoundToEs("Regular Season - 1")).toBe("Fecha 1");
  });

  it("traduce 'Group Stage - N' a 'Fase de grupos · JN'", () => {
    expect(mapRoundToEs("Group Stage - 1")).toBe("Fase de grupos · J1");
    expect(mapRoundToEs("Group Stage - 6")).toBe("Fase de grupos · J6");
  });

  it("traduce las rondas eliminatorias conocidas", () => {
    expect(mapRoundToEs("Quarter-finals")).toBe("Cuartos de final");
    expect(mapRoundToEs("Round of 16")).toBe("Octavos de final");
    expect(mapRoundToEs("Round of 32")).toBe("16vos de final");
    expect(mapRoundToEs("Semi-finals")).toBe("Semifinal");
    expect(mapRoundToEs("Final")).toBe("Final");
    expect(mapRoundToEs("3rd Place Final")).toBe("Tercer puesto");
    expect(mapRoundToEs("Preliminary Round")).toBe("Ronda preliminar");
    expect(mapRoundToEs("Play-offs")).toBe("Playoffs");
  });

  it("devuelve null para inputs vacíos", () => {
    expect(mapRoundToEs(null)).toBeNull();
    expect(mapRoundToEs(undefined)).toBeNull();
    expect(mapRoundToEs("")).toBeNull();
    expect(mapRoundToEs("   ")).toBeNull();
  });

  it("devuelve el input tal cual cuando no hay patrón conocido", () => {
    expect(mapRoundToEs("Knockout Stage")).toBe("Knockout Stage");
    expect(mapRoundToEs("Stage 3 - Matchday 5")).toBe("Stage 3 - Matchday 5");
  });
});
