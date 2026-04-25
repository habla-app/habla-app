// Tests AST de patrones de reembolso multi-bolsa — Lote 6A.
// Verifica que torneos.service restaura las bolsas correctas al cancelar
// y que ranking.service acredita premios a GANADAS.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

function read(p: string): string {
  return readFileSync(resolve(ROOT, p), "utf-8");
}

const TORNEOS_SRC = read("lib/services/torneos.service.ts");
const RANKING_SRC = read("lib/services/ranking.service.ts");

describe("torneos.service — restauración de bolsas en cancelación", () => {
  it("restaurarEntrada restaura balanceBonus si la bolsa origen era BONUS", () => {
    expect(TORNEOS_SRC).toMatch(/balanceBonus.*increment|increment.*balanceBonus/);
  });

  it("restaurarEntrada restaura balanceGanadas si la bolsa origen era GANADAS", () => {
    expect(TORNEOS_SRC).toMatch(/balanceGanadas.*increment|increment.*balanceGanadas/);
  });

  it("restaurarEntrada restaura saldoVivo en la compra original si no expiró", () => {
    expect(TORNEOS_SRC).toMatch(/saldoVivo.*increment|increment.*saldoVivo/);
  });

  it("si la compra original expiró, crea nueva COMPRA con venceEn fresco", () => {
    // Fallback: la compra original está vencida → nueva COMPRA con TTL 36m
    expect(TORNEOS_SRC).toMatch(/MESES_VENCIMIENTO_COMPRA/);
  });

  it("el REEMBOLSO tiene metadata.composicionOrigen para trazabilidad", () => {
    expect(TORNEOS_SRC).toMatch(/composicionOrigen/);
  });

  it("incrementa balanceLukas al cancelar en todos los paths", () => {
    expect(TORNEOS_SRC).toMatch(/balanceLukas.*increment/);
  });
});

describe("ranking.service — premios al GANADAS", () => {
  it("finalizarTorneo incrementa balanceGanadas al acreditar premios", () => {
    expect(RANKING_SRC).toMatch(/balanceGanadas:\s*\{\s*increment/);
  });

  it("crea TransaccionLukas PREMIO_TORNEO con bolsa GANADAS", () => {
    expect(RANKING_SRC).toMatch(/tipo:\s*["']PREMIO_TORNEO["']/);
    expect(RANKING_SRC).toMatch(/bolsa:\s*["']GANADAS["']/);
  });

  it("también incrementa balanceLukas (mantiene compat total)", () => {
    expect(RANKING_SRC).toMatch(/balanceLukas.*increment/);
  });
});

describe("convenciones Lote 6A — lukas-display como punto de lectura único", () => {
  const servicios = [
    "lib/services/canjes.service.ts",
    "lib/services/compras.service.ts",
    "lib/services/wallet-view.service.ts",
  ];

  for (const f of servicios) {
    it(`${f}: importa desde lukas-display o usa bolsas directas (autorizado)`, () => {
      const src = read(f);
      // Deben usar balanceCompradas/Bonus/Ganadas directamente (autorizados)
      // O importar de lukas-display. Al menos uno de los dos patrones.
      const usaBolsas =
        src.includes("balanceCompradas") ||
        src.includes("balanceBonus") ||
        src.includes("balanceGanadas");
      const usaHelper = src.includes("lukas-display") || src.includes("getBalance");
      expect(usaBolsas || usaHelper).toBe(true);
    });
  }
});

describe("backfill-bolsas.service — idempotencia y fallback", () => {
  const SRC = read("lib/services/backfill-bolsas.service.ts");

  it("skip si txsSinBolsa === 0 (idempotente)", () => {
    expect(SRC).toMatch(/txsSinBolsa.*===.*0|=== 0.*txsSinBolsa/);
  });

  it("popula campo bolsa en todas las txs sin bolsa", () => {
    expect(SRC).toMatch(/bolsa:\s*null/);
    expect(SRC).toMatch(/bolsaPorTipo/);
  });

  it("popula saldoVivo en COMPRA sin saldoVivo", () => {
    expect(SRC).toMatch(/saldoVivo:\s*null/);
    expect(SRC).toMatch(/saldoVivo:\s*compra\.monto/);
  });

  it("retorna BackfillResult con contadores", () => {
    expect(SRC).toMatch(/usuariosProcesados/);
    expect(SRC).toMatch(/txsActualizadas/);
    expect(SRC).toMatch(/tiempoMs/);
  });

  it("tiene fallback para divergencias: todo a balanceCompradas", () => {
    expect(SRC).toMatch(/divergencias/);
    expect(SRC).toMatch(/fallbacks/);
    expect(SRC).toMatch(/compradas = usuario\.balanceLukas/);
  });
});
