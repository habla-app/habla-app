// Tests para lib/lukas-display.ts — Lote 6A.

import { describe, expect, it } from "vitest";
import {
  getBalanceTotal,
  getBalanceCanjeable,
  getBalanceDisponibleParaJugar,
  getBalanceDesglosado,
} from "../lib/lukas-display";

const mk = (compradas: number, bonus: number, ganadas: number) => ({
  balanceCompradas: compradas,
  balanceBonus: bonus,
  balanceGanadas: ganadas,
});

describe("getBalanceTotal", () => {
  it("suma las 3 bolsas", () => {
    expect(getBalanceTotal(mk(10, 5, 20))).toBe(35);
  });

  it("retorna 0 cuando todas las bolsas están vacías", () => {
    expect(getBalanceTotal(mk(0, 0, 0))).toBe(0);
  });

  it("funciona con solo compradas", () => {
    expect(getBalanceTotal(mk(100, 0, 0))).toBe(100);
  });

  it("funciona con solo bonus", () => {
    expect(getBalanceTotal(mk(0, 15, 0))).toBe(15);
  });

  it("funciona con solo ganadas", () => {
    expect(getBalanceTotal(mk(0, 0, 50))).toBe(50);
  });
});

describe("getBalanceCanjeable", () => {
  it("devuelve solo la bolsa ganadas", () => {
    expect(getBalanceCanjeable(mk(100, 50, 30))).toBe(30);
  });

  it("devuelve 0 si ganadas = 0 aunque haya otras bolsas", () => {
    expect(getBalanceCanjeable(mk(200, 15, 0))).toBe(0);
  });
});

describe("getBalanceDisponibleParaJugar", () => {
  it("es igual al total (las 3 bolsas sirven para jugar)", () => {
    const u = mk(10, 5, 20);
    expect(getBalanceDisponibleParaJugar(u)).toBe(getBalanceTotal(u));
  });
});

describe("getBalanceDesglosado", () => {
  it("devuelve desglose completo con total y canjeable", () => {
    const d = getBalanceDesglosado(mk(10, 5, 20));
    expect(d).toEqual({
      compradas: 10,
      bonus: 5,
      ganadas: 20,
      total: 35,
      canjeable: 20,
    });
  });

  it("canjeable == ganadas", () => {
    const d = getBalanceDesglosado(mk(50, 15, 7));
    expect(d.canjeable).toBe(d.ganadas);
  });

  it("total == compradas + bonus + ganadas", () => {
    const d = getBalanceDesglosado(mk(33, 12, 8));
    expect(d.total).toBe(d.compradas + d.bonus + d.ganadas);
  });
});
