// Tests de la función legacy `calcularPremioEstimado` de ranking.service.
//
// Hotfix #6: la lógica de distribución migró a `premios-distribucion.ts`.
// `calcularPremioEstimado` queda como wrapper retrocompatible que delega
// al nuevo helper puro. Los tests aquí validan:
//   - Firma nueva: (pozoNeto, posicion, totalInscritos)
//   - Match con la curva top-heavy del Hotfix #6
//
// El desempate por marcador / tarjeta / creadoEn fue ELIMINADO por el
// Hotfix #6 — mismos puntos = mismo premio (split por empate). El helper
// `distribuirPremios` cubre esa semántica; los tests de split viven en
// `tests/premios-distribucion.test.ts`.

import { describe, expect, it } from "vitest";
import { calcularPremioEstimado } from "@/lib/services/ranking.service";
import { calcularShares } from "@/lib/utils/premios-distribucion";

describe("calcularPremioEstimado — Hotfix #6", () => {
  it("1° con 100 inscritos: ~45% del pozo (share[0] de la curva)", () => {
    // N=100 → M=10. share[0] ≈ 0.45 + residual.
    const expected = (calcularShares(10, 1000)[0] ?? 0);
    expect(calcularPremioEstimado(1000, 1, 100)).toBe(expected);
  });

  it("2° con 100 inscritos: share[1] de la curva", () => {
    const expected = (calcularShares(10, 1000)[1] ?? 0);
    expect(calcularPremioEstimado(1000, 2, 100)).toBe(expected);
  });

  it("11° con 100 inscritos: 0 (fuera de M=10)", () => {
    expect(calcularPremioEstimado(1000, 11, 100)).toBe(0);
  });

  it("1° con 5 inscritos (M=1): 100% del pozo", () => {
    expect(calcularPremioEstimado(1000, 1, 5)).toBe(1000);
  });

  it("2° con 5 inscritos: 0 (M=1, solo el ganador cobra)", () => {
    expect(calcularPremioEstimado(1000, 2, 5)).toBe(0);
  });

  it("2° con 10 inscritos (M=2): 35% del pozo (fixed table)", () => {
    // M=2 → [0.65, 0.35]
    expect(calcularPremioEstimado(100, 2, 10)).toBe(35);
  });

  it("posición inválida (0) → 0", () => {
    expect(calcularPremioEstimado(1000, 0, 100)).toBe(0);
  });

  it("posición negativa → 0", () => {
    expect(calcularPremioEstimado(1000, -5, 100)).toBe(0);
  });
});
