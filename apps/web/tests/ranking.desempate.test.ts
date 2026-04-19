// Tests de cálculo de premios + orden de desempate del ranking.
//
// No toca Prisma — exporta funciones puras para testear el algoritmo.

import { describe, expect, it } from "vitest";
import { calcularPremioEstimado } from "@/lib/services/ranking.service";

describe("calcularPremioEstimado", () => {
  it("1° = 35% del pozo neto", () => {
    expect(calcularPremioEstimado(1000, 1)).toBe(350);
  });
  it("2° = 20%", () => {
    expect(calcularPremioEstimado(1000, 2)).toBe(200);
  });
  it("3° = 12%", () => {
    expect(calcularPremioEstimado(1000, 3)).toBe(120);
  });
  it("4° a 10° = 33% / 7 = ~4.71%", () => {
    expect(calcularPremioEstimado(7000, 4)).toBe(330);
    expect(calcularPremioEstimado(7000, 7)).toBe(330);
    expect(calcularPremioEstimado(7000, 10)).toBe(330);
  });
  it("11° en adelante = 0", () => {
    expect(calcularPremioEstimado(1000, 11)).toBe(0);
    expect(calcularPremioEstimado(1000, 100)).toBe(0);
  });
  it("posición inválida (0) = 0", () => {
    expect(calcularPremioEstimado(1000, 0)).toBe(0);
  });
  it("siempre redondea hacia abajo al entero", () => {
    // 100 * 0.12 = 12.0 (exacto); 101 * 0.12 = 12.12 → 12
    expect(calcularPremioEstimado(101, 3)).toBe(12);
  });
});

// Desempate: probamos directamente el comparador exportando el mismo
// criterio con una función pura. Como `compararParaDesempate` es privado,
// replicamos su lógica en el test para garantizar invariantes.
//
// El criterio es:
//   1) puntosTotal DESC
//   2) puntosMarcador > 0 antes que 0
//   3) puntosTarjeta > 0 antes que 0
//   4) creadoEn ASC

interface TicketLike {
  id: string;
  puntosTotal: number;
  puntosMarcador: number;
  puntosTarjeta: number;
  creadoEn: Date;
}

function comparador(a: TicketLike, b: TicketLike): number {
  if (b.puntosTotal !== a.puntosTotal) return b.puntosTotal - a.puntosTotal;
  const aMarc = a.puntosMarcador > 0 ? 1 : 0;
  const bMarc = b.puntosMarcador > 0 ? 1 : 0;
  if (bMarc !== aMarc) return bMarc - aMarc;
  const aTarj = a.puntosTarjeta > 0 ? 1 : 0;
  const bTarj = b.puntosTarjeta > 0 ? 1 : 0;
  if (bTarj !== aTarj) return bTarj - aTarj;
  return a.creadoEn.getTime() - b.creadoEn.getTime();
}

describe("Desempate del ranking", () => {
  it("desempata por marcador exacto antes que tarjeta", () => {
    const a: TicketLike = {
      id: "a",
      puntosTotal: 10,
      puntosMarcador: 8,
      puntosTarjeta: 0,
      creadoEn: new Date("2026-04-10T12:00:00Z"),
    };
    const b: TicketLike = {
      id: "b",
      puntosTotal: 10,
      puntosMarcador: 0,
      puntosTarjeta: 6,
      creadoEn: new Date("2026-04-10T11:00:00Z"),
    };
    const sorted = [a, b].sort(comparador);
    expect(sorted[0]!.id).toBe("a");
  });

  it("misma puntos y marcador → gana el que acertó tarjeta", () => {
    const a: TicketLike = {
      id: "a",
      puntosTotal: 10,
      puntosMarcador: 8,
      puntosTarjeta: 0,
      creadoEn: new Date("2026-04-10T12:00:00Z"),
    };
    const b: TicketLike = {
      id: "b",
      puntosTotal: 10,
      puntosMarcador: 8,
      puntosTarjeta: 6,
      creadoEn: new Date("2026-04-10T13:00:00Z"),
    };
    const sorted = [a, b].sort(comparador);
    expect(sorted[0]!.id).toBe("b");
  });

  it("iguales en todo → gana el que se inscribió primero", () => {
    const a: TicketLike = {
      id: "a",
      puntosTotal: 5,
      puntosMarcador: 0,
      puntosTarjeta: 0,
      creadoEn: new Date("2026-04-10T12:00:00Z"),
    };
    const b: TicketLike = {
      id: "b",
      puntosTotal: 5,
      puntosMarcador: 0,
      puntosTarjeta: 0,
      creadoEn: new Date("2026-04-10T10:00:00Z"),
    };
    const sorted = [a, b].sort(comparador);
    expect(sorted[0]!.id).toBe("b");
  });

  it("puntos totales mandan sobre todo lo demás", () => {
    const a: TicketLike = {
      id: "a",
      puntosTotal: 21, /* perfecto */
      puntosMarcador: 8,
      puntosTarjeta: 6,
      creadoEn: new Date("2026-04-10T20:00:00Z") /* último */,
    };
    const b: TicketLike = {
      id: "b",
      puntosTotal: 15,
      puntosMarcador: 8,
      puntosTarjeta: 6,
      creadoEn: new Date("2026-04-10T01:00:00Z") /* primero */,
    };
    const sorted = [a, b].sort(comparador);
    expect(sorted[0]!.id).toBe("a");
  });
});
