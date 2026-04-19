// Tests de la nueva distribución de premios — Hotfix #6.
//
// Cubre los brackets chicos (tablas fijas M=1/2/3/5), la curva geométrica
// (M=10, 20, 50), el manejo de empates (single group, tail overflow,
// empate que cruza M), y el redondeo + residual.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  calcularPagados,
  calcularShares,
  calcularSharesFloat,
  distribuirPremios,
  premioEstimadoSinEmpate,
} from "@/lib/utils/premios-distribucion";

// ---------------------------------------------------------------------------
// calcularPagados — cortes del Hotfix #6
// ---------------------------------------------------------------------------

describe("calcularPagados (cortes de pagados)", () => {
  it("N<2 → 0 (torneo se cancela antes)", () => {
    expect(calcularPagados(0)).toBe(0);
    expect(calcularPagados(1)).toBe(0);
  });
  it("N 2-9 → 1", () => {
    expect(calcularPagados(2)).toBe(1);
    expect(calcularPagados(5)).toBe(1);
    expect(calcularPagados(9)).toBe(1);
  });
  it("N 10-19 → 2", () => {
    expect(calcularPagados(10)).toBe(2);
    expect(calcularPagados(19)).toBe(2);
  });
  it("N 20-29 → 3", () => {
    expect(calcularPagados(20)).toBe(3);
    expect(calcularPagados(29)).toBe(3);
  });
  it("N 30-49 → 5", () => {
    expect(calcularPagados(30)).toBe(5);
    expect(calcularPagados(49)).toBe(5);
  });
  it("N 50-99 → 10", () => {
    expect(calcularPagados(50)).toBe(10);
    expect(calcularPagados(99)).toBe(10);
  });
  it("N 100+ → round(N * 0.10)", () => {
    expect(calcularPagados(100)).toBe(10);
    expect(calcularPagados(200)).toBe(20);
    expect(calcularPagados(500)).toBe(50);
    expect(calcularPagados(1000)).toBe(100);
    // 145 * 0.1 = 14.5 → round = 15
    expect(calcularPagados(145)).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// calcularSharesFloat — porcentajes puros
// ---------------------------------------------------------------------------

describe("calcularSharesFloat (porcentajes)", () => {
  it("M=1 → [1.0]", () => {
    expect(calcularSharesFloat(1)).toEqual([1.0]);
  });
  it("M=2 → [0.65, 0.35]", () => {
    expect(calcularSharesFloat(2)).toEqual([0.65, 0.35]);
  });
  it("M=3 → [0.50, 0.30, 0.20]", () => {
    expect(calcularSharesFloat(3)).toEqual([0.5, 0.3, 0.2]);
  });
  it("M=5 → [0.40, 0.25, 0.18, 0.10, 0.07]", () => {
    expect(calcularSharesFloat(5)).toEqual([0.4, 0.25, 0.18, 0.1, 0.07]);
  });
  it("M=10: share[0]=0.45, sum=1.0, decrecientes", () => {
    const s = calcularSharesFloat(10);
    expect(s).toHaveLength(10);
    expect(s[0]).toBeCloseTo(0.45, 6);
    const sum = s.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 6);
    // estrictamente decreciente
    for (let i = 1; i < s.length; i++) {
      expect(s[i]!).toBeLessThan(s[i - 1]!);
    }
    // suma de 1..M son exactamente 0.55
    const sum2aM = s.slice(1).reduce((a, b) => a + b, 0);
    expect(sum2aM).toBeCloseTo(0.55, 6);
  });
  it("M=20: share[0]=0.45, sum=1.0, decrecientes", () => {
    const s = calcularSharesFloat(20);
    expect(s).toHaveLength(20);
    expect(s[0]).toBeCloseTo(0.45, 6);
    const sum = s.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 6);
    for (let i = 1; i < s.length; i++) {
      expect(s[i]!).toBeLessThan(s[i - 1]!);
    }
  });
});

// ---------------------------------------------------------------------------
// calcularShares — enteros con residual en el 1°
// ---------------------------------------------------------------------------

describe("calcularShares (enteros)", () => {
  it("M=10, P=880: share[0]=396, sum=880, decrecientes", () => {
    const s = calcularShares(10, 880);
    expect(s[0]).toBe(Math.floor(880 * 0.45) + residualFor(10, 880));
    // La suma tras redondeo + residual debe igualar P exacto
    expect(s.reduce((a, b) => a + b, 0)).toBe(880);
    // shares son estrictamente decrecientes (el residual en el 1°
    // sólo lo hace más grande, no compromete el orden)
    for (let i = 1; i < s.length; i++) {
      expect(s[i]!).toBeLessThanOrEqual(s[i - 1]!);
    }
  });
  it("M=1, P=100 → [100]", () => {
    expect(calcularShares(1, 100)).toEqual([100]);
  });
  it("M=2, P=100 → 1° 65, 2° 35", () => {
    expect(calcularShares(2, 100)).toEqual([65, 35]);
  });
  it("M=3, P=103: residual va al 1°", () => {
    // 103 * 0.50 = 51.5 → floor 51; 103*0.30 = 30.9 → 30; 103*0.20 = 20.6 → 20
    // suma = 101; residual = 2 → 1° recibe 51+2 = 53
    const s = calcularShares(3, 103);
    expect(s).toEqual([53, 30, 20]);
    expect(s.reduce((a, b) => a + b, 0)).toBe(103);
  });
});

function residualFor(M: number, P: number): number {
  const floatShares = calcularSharesFloat(M);
  const intShares = floatShares.map((s) => Math.floor(s * P));
  return P - intShares.reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// distribuirPremios — sin empates (caso base)
// ---------------------------------------------------------------------------

describe("distribuirPremios - sin empates", () => {
  it("100 inscritos, 10 tickets únicos — cada uno recibe su share exacto", () => {
    const tickets = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i + 1}`,
      puntosTotal: 100 - i, // todos distintos
      creadoEn: new Date(2026, 3, 19, 10, i),
    }));
    const pozoNeto = 880;
    const asignaciones = distribuirPremios(tickets, 100, pozoNeto);

    const expectedShares = calcularShares(10, pozoNeto);
    expect(asignaciones.reduce((a, b) => a + b.premioLukas, 0)).toBe(pozoNeto);
    for (let i = 0; i < 10; i++) {
      expect(asignaciones[i]!.ticketId).toBe(`t${i + 1}`);
      expect(asignaciones[i]!.posicionFinal).toBe(i + 1);
      expect(asignaciones[i]!.premioLukas).toBe(expectedShares[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// distribuirPremios - empates
// ---------------------------------------------------------------------------

describe("distribuirPremios - empates", () => {
  it("TC2: 3-way tie en 1° con M=10 → cada uno recibe (share[0]+share[1]+share[2])/3", () => {
    const pozo = 1000;
    const shares = calcularShares(10, pozo);
    // Para M=10 necesitamos N entre 50-99. Usamos 80 inscritos.
    // 3 empatados en 100 pts, luego 77 más con puntos únicos decrecientes.
    const tickets = [
      { id: "a", puntosTotal: 100, creadoEn: new Date(2026, 3, 19, 10, 0) },
      { id: "b", puntosTotal: 100, creadoEn: new Date(2026, 3, 19, 10, 1) },
      { id: "c", puntosTotal: 100, creadoEn: new Date(2026, 3, 19, 10, 2) },
      ...Array.from({ length: 77 }, (_, i) => ({
        id: `d${i}`,
        puntosTotal: Math.max(1, 90 - i), // decrecientes únicos hasta 13
        creadoEn: new Date(2026, 3, 19, 11, i),
      })),
    ];
    const res = distribuirPremios(tickets, 80, pozo);
    // Los 3 empatados en 1° comparten posicionFinal=1
    const top3 = res.filter((r) => ["a", "b", "c"].includes(r.ticketId));
    expect(top3).toHaveLength(3);
    expect(top3.every((r) => r.posicionFinal === 1)).toBe(true);
    const suma123 = (shares[0] ?? 0) + (shares[1] ?? 0) + (shares[2] ?? 0);
    const total3 = top3.reduce((a, b) => a + b.premioLukas, 0);
    expect(total3).toBe(suma123);
    // cada uno recibe ≈ suma/3 (residual va al primero del grupo)
    const base = Math.floor(suma123 / 3);
    const residual = suma123 - base * 3;
    expect(top3[0]!.premioLukas).toBe(base + residual);
    expect(top3[1]!.premioLukas).toBe(base);
    expect(top3[2]!.premioLukas).toBe(base);
  });

  it("TC3: 1 puntero solo + 15-way tie en 2° con M=10 → los 15 reparten sum(shares[1..9])/15", () => {
    const pozo = 10000;
    const shares = calcularShares(10, pozo); // M=10 implica 50 ≤ N ≤ 99, usaremos N=80
    const tickets = [
      // 1 solo en 1° con 100 pts
      { id: "p1", puntosTotal: 100, creadoEn: new Date(2026, 3, 19, 9, 0) },
      // 15 empatados en 50 pts
      ...Array.from({ length: 15 }, (_, i) => ({
        id: `e${i}`,
        puntosTotal: 50,
        creadoEn: new Date(2026, 3, 19, 10, i),
      })),
      // 64 más con puntajes decrecientes
      ...Array.from({ length: 64 }, (_, i) => ({
        id: `x${i}`,
        puntosTotal: 40 - (i % 30),
        creadoEn: new Date(2026, 3, 19, 11, i),
      })),
    ];
    const res = distribuirPremios(tickets, 80, pozo);

    // p1 recibe share[0]
    const p1 = res.find((r) => r.ticketId === "p1")!;
    expect(p1.posicionFinal).toBe(1);
    expect(p1.premioLukas).toBe(shares[0]);

    // 15 empatados comparten posicionFinal=2 y reparten sum(shares[1..9])
    const grupo = res.filter((r) => r.ticketId.startsWith("e"));
    expect(grupo).toHaveLength(15);
    expect(grupo.every((r) => r.posicionFinal === 2)).toBe(true);
    const sumaShare2a10 = shares.slice(1).reduce((a, b) => a + b, 0);
    const totalGrupo = grupo.reduce((a, b) => a + b.premioLukas, 0);
    expect(totalGrupo).toBe(sumaShare2a10);
    // todos recibieron pago (ninguno cero)
    expect(grupo.every((r) => r.premioLukas > 0)).toBe(true);
  });

  it("grupo empatado fuera del top (posStart > M) — todos reciben 0", () => {
    const pozo = 1000;
    const tickets = [
      // 10 ganadores únicos
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `g${i}`,
        puntosTotal: 100 - i,
        creadoEn: new Date(2026, 3, 19, 9, i),
      })),
      // 5 empatados en 50 pts después del top
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `p${i}`,
        puntosTotal: 50,
        creadoEn: new Date(2026, 3, 19, 10, i),
      })),
    ];
    const res = distribuirPremios(tickets, 15, pozo);
    const perdedores = res.filter((r) => r.ticketId.startsWith("p"));
    expect(perdedores).toHaveLength(5);
    expect(perdedores.every((r) => r.premioLukas === 0)).toBe(true);
    expect(perdedores.every((r) => r.posicionFinal === 11)).toBe(true);
  });

  it("empate en posiciones finales genera share individual < entry → se acepta (opción 1)", () => {
    // M=2 (N=10), empate en 2° 3-way:
    // 2° share = 100 * 0.35 = 35
    // 3 empatados reciben floor(35/3) = 11 cada uno (+residual 2 al primero = 13)
    // Si la entrada del torneo fue 15, cobran menos que su entrada. OK, se acepta.
    const pozo = 100;
    const tickets = [
      { id: "winner", puntosTotal: 80, creadoEn: new Date(2026, 3, 19, 9) },
      { id: "a", puntosTotal: 30, creadoEn: new Date(2026, 3, 19, 10) },
      { id: "b", puntosTotal: 30, creadoEn: new Date(2026, 3, 19, 11) },
      { id: "c", puntosTotal: 30, creadoEn: new Date(2026, 3, 19, 12) },
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `x${i}`,
        puntosTotal: 10 - i,
        creadoEn: new Date(2026, 3, 19, 13, i),
      })),
    ];
    const res = distribuirPremios(tickets, 10, pozo);
    const winner = res.find((r) => r.ticketId === "winner")!;
    expect(winner.posicionFinal).toBe(1);
    expect(winner.premioLukas).toBe(65); // share[0] para M=2 es 65
    // 3 empatados en 2° comparten 35 — uno recibe 13 (con residual 2), dos reciben 11
    const grupo = res.filter((r) => ["a", "b", "c"].includes(r.ticketId));
    expect(grupo.every((r) => r.posicionFinal === 2)).toBe(true);
    const sumaGrupo = grupo.reduce((a, b) => a + b.premioLukas, 0);
    expect(sumaGrupo).toBe(35);
    const primeroGrupo = grupo.find((r) => r.ticketId === "a")!;
    expect(primeroGrupo.premioLukas).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// distribuirPremios — escalado grande
// ---------------------------------------------------------------------------

describe("distribuirPremios - escalado", () => {
  it("200 inscritos → M=20, suma exacta de premios = pozoNeto", () => {
    const pozo = 50_000;
    const tickets = Array.from({ length: 200 }, (_, i) => ({
      id: `t${i}`,
      puntosTotal: 200 - i,
      creadoEn: new Date(2026, 3, 19, 9, 0, i),
    }));
    const res = distribuirPremios(tickets, 200, pozo);
    expect(res).toHaveLength(200);
    const suma = res.reduce((a, b) => a + b.premioLukas, 0);
    expect(suma).toBe(pozo);
    // Top 20 reciben pago, del 21 en adelante 0
    const pagados = res.filter((r) => r.premioLukas > 0);
    expect(pagados).toHaveLength(20);
  });

  it("500 inscritos → M=50", () => {
    const pozo = 100_000;
    const tickets = Array.from({ length: 500 }, (_, i) => ({
      id: `t${i}`,
      puntosTotal: 500 - i,
      creadoEn: new Date(2026, 3, 19, 9, 0, i),
    }));
    const res = distribuirPremios(tickets, 500, pozo);
    const pagados = res.filter((r) => r.premioLukas > 0);
    expect(pagados).toHaveLength(50);
    expect(res.reduce((a, b) => a + b.premioLukas, 0)).toBe(pozo);
  });
});

// ---------------------------------------------------------------------------
// premioEstimadoSinEmpate — helper para UI live
// ---------------------------------------------------------------------------

describe("premioEstimadoSinEmpate", () => {
  it("posición > M → 0", () => {
    expect(premioEstimadoSinEmpate(15, 80, 1000)).toBe(0);
    expect(premioEstimadoSinEmpate(11, 50, 1000)).toBe(0);
  });
  it("posición 1 = share[0]", () => {
    const shares = calcularShares(10, 880);
    expect(premioEstimadoSinEmpate(1, 80, 880)).toBe(shares[0]);
  });
  it("posición 0 o negativa → 0", () => {
    expect(premioEstimadoSinEmpate(0, 100, 1000)).toBe(0);
    expect(premioEstimadoSinEmpate(-1, 100, 1000)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Antidrift — literales del viejo 35/20/12 fuera del código
// ---------------------------------------------------------------------------

describe("antidrift: literales viejos fuera del código", () => {
  const ROOT = path.resolve(__dirname, "..");
  function readClean(relPath: string): string {
    const content = fs.readFileSync(path.join(ROOT, relPath), "utf8");
    return stripComments(content);
  }

  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  }

  it("ranking.service.ts no referencia DISTRIB_PREMIOS ni 0.35/0.20/0.12 en código", () => {
    const src = readClean("lib/services/ranking.service.ts");
    // DISTRIB_PREMIOS ya no debe importarse ni usarse fuera de comentarios
    expect(src).not.toMatch(/DISTRIB_PREMIOS(?!_FE)/);
    expect(src).not.toMatch(/0\.35\b/);
    expect(src).not.toMatch(/0\.20\b/);
    expect(src).not.toMatch(/0\.12\b/);
    // Debe referenciar el helper nuevo
    expect(src).toMatch(/premios-distribucion|distribuirPremios|premioEstimadoSinEmpate/);
  });

  it("torneos.service.ts limpió referencias a la vieja distribución", () => {
    const src = readClean("lib/services/torneos.service.ts");
    // DISTRIB_PREMIOS sólo puede aparecer en `distribPremios: Json` (es el
    // campo de Prisma) — chequeamos que NO haya literales numéricos.
    expect(src).not.toMatch(/"1":\s*0\.35/);
    expect(src).not.toMatch(/"4-10":\s*0\.33/);
  });
});
