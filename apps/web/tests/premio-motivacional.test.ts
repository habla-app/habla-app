// Tests del helper `buildMotivationalCopy` — Hotfix #6 Ítem 1.6.
// Cubre los 4 estados del badge + copy motivacional del RankingTable.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildMotivationalCopy } from "@/lib/utils/premio-motivacional";

const ROOT = path.resolve(__dirname, "..");

function rank(rows: Array<[number, number]>) {
  // [rank, puntos][] → ranking shape
  return rows.map(([rank, puntosTotal]) => ({ rank, puntosTotal }));
}

describe("buildMotivationalCopy", () => {
  it("1° solo con M=10 → in-money-solo (gold)", () => {
    // Usuario en el 1° con 21 pts; nadie más tiene 21.
    const r = buildMotivationalCopy({
      miPuesto: 1,
      puntosPropios: 21,
      ranking: rank([
        [1, 21],
        [2, 18],
        [3, 15],
        [4, 12],
      ]),
      M: 10,
    });
    expect(r.state).toBe("in-money-solo");
    expect(r.tone).toBe("gold");
    expect(r.emoji).toBe("🎯");
    expect(r.copy).toMatch(/Único ganador del 1° puesto/);
  });

  it("3-way tie en 1° → in-money-tie (gold, menciona 2 jugadores)", () => {
    const r = buildMotivationalCopy({
      miPuesto: 1,
      puntosPropios: 21,
      ranking: rank([
        [1, 21],
        [2, 21],
        [3, 21],
        [4, 10],
      ]),
      M: 10,
    });
    expect(r.state).toBe("in-money-tie");
    expect(r.tone).toBe("gold");
    expect(r.emoji).toBe("🤝");
    expect(r.copy).toMatch(/2 jugadores/);
    expect(r.copy).toMatch(/compartidos/);
  });

  it("empate 2-way en 2° con M=10 → 1 jugador (singular)", () => {
    const r = buildMotivationalCopy({
      miPuesto: 2,
      puntosPropios: 18,
      ranking: rank([
        [1, 21],
        [2, 18],
        [3, 18],
        [4, 10],
      ]),
      M: 10,
    });
    expect(r.state).toBe("in-money-tie");
    expect(r.copy).toMatch(/1 jugador\b/);
  });

  it("A 1 puesto del dinero (M=10, miPuesto=11) → close", () => {
    const r = buildMotivationalCopy({
      miPuesto: 11,
      puntosPropios: 5,
      ranking: rank([
        ...Array.from({ length: 9 }, (_, i): [number, number] => [i + 1, 15 - i]),
        [10, 6], // M-ésimo
        [11, 5],
      ]),
      M: 10,
    });
    expect(r.state).toBe("close");
    expect(r.tone).toBe("muted");
    expect(r.emoji).toBe("⚡");
    expect(r.copy).toMatch(/A 1 punto del premio/);
  });

  it("A 3 posiciones del dinero (miPuesto=13 con M=10) → close", () => {
    const r = buildMotivationalCopy({
      miPuesto: 13,
      puntosPropios: 5,
      ranking: rank([
        ...Array.from({ length: 9 }, (_, i): [number, number] => [i + 1, 20 - i]),
        [10, 12],
        [11, 8],
        [12, 6],
        [13, 5],
      ]),
      M: 10,
    });
    expect(r.state).toBe("close");
    expect(r.copy).toMatch(/A 7 puntos del premio/);
  });

  it("lejos del dinero (miPuesto=20 con M=10) → far", () => {
    const r = buildMotivationalCopy({
      miPuesto: 20,
      puntosPropios: 2,
      ranking: rank([
        ...Array.from({ length: 20 }, (_, i): [number, number] => [i + 1, 20 - i]),
      ]),
      M: 10,
    });
    expect(r.state).toBe("far");
    expect(r.tone).toBe("muted");
    expect(r.emoji).toBe("💪");
  });

  it("M=0 (torneo sin pagados aún) → far", () => {
    const r = buildMotivationalCopy({
      miPuesto: 1,
      puntosPropios: 10,
      ranking: rank([[1, 10]]),
      M: 0,
    });
    expect(r.state).toBe("far");
  });
});

// ---------------------------------------------------------------------------
// AST antidrift — RankingTable consume el helper
// ---------------------------------------------------------------------------

describe("RankingTable.tsx consume buildMotivationalCopy", () => {
  const SRC = fs.readFileSync(
    path.join(ROOT, "components", "live", "RankingTable.tsx"),
    "utf8",
  );

  it("importa buildMotivationalCopy", () => {
    expect(SRC).toMatch(
      /import\s*\{[\s\S]*buildMotivationalCopy[\s\S]*\}\s*from\s*["']@\/lib\/utils\/premio-motivacional["']/,
    );
  });

  it("llama al helper en la fila del usuario (render condicional isMe)", () => {
    expect(SRC).toMatch(/buildMotivationalCopy\s*\(/);
  });

  it("NO duplica los strings literales del copy motivacional en el JSX", () => {
    // La copy debe venir del helper; si alguien hardcodea los literales,
    // los cambios futuros se olvidan en un lado. Los 4 literales base
    // NO deben aparecer fuera de llamadas al helper.
    expect(SRC).not.toMatch(/["']Único ganador del["']/);
    expect(SRC).not.toMatch(/["']Sigue sumando — todo["']/);
  });
});
