// Tests AST de compras.service — verificación de patrones de bolsas Lote 6A.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SRC = readFileSync(
  resolve(ROOT, "lib/services/compras.service.ts"),
  "utf-8",
);

describe("compras.service — acreditación con 3 bolsas", () => {
  it("crea TransaccionLukas COMPRA con bolsa COMPRADAS", () => {
    expect(SRC).toMatch(/tipo:\s*["']COMPRA["']/);
    expect(SRC).toMatch(/bolsa:\s*["']COMPRADAS["']/);
  });

  it("setea venceEn en la COMPRA (Lukas comprados tienen TTL 36m)", () => {
    expect(SRC).toMatch(/venceEn/);
    expect(SRC).toMatch(/MESES_VENCIMIENTO_COMPRA/);
  });

  it("setea saldoVivo = montoCompradas en la COMPRA (para FIFO)", () => {
    expect(SRC).toMatch(/saldoVivo:\s*input\.montoCompradas/);
  });

  it("crea TransaccionLukas BONUS con bolsa BONUS si hay bonus", () => {
    expect(SRC).toMatch(/tipo:\s*["']BONUS["']/);
    expect(SRC).toMatch(/bolsa:\s*["']BONUS["']/);
  });

  it("incrementa balanceCompradas y balanceBonus por separado", () => {
    expect(SRC).toMatch(/balanceCompradas:\s*\{\s*increment/);
    expect(SRC).toMatch(/balanceBonus:\s*\{\s*increment/);
  });

  it("incrementa balanceLukas con el total (compradas + bonus)", () => {
    expect(SRC).toMatch(/balanceLukas:\s*\{\s*increment/);
  });

  it("retorna nuevoBalance calculado con getBalanceTotal", () => {
    expect(SRC).toMatch(/getBalanceTotal/);
    expect(SRC).toMatch(/nuevoBalance/);
  });

  it("todo en prisma.$transaction (atomicidad)", () => {
    expect(SRC).toMatch(/prisma\.\$transaction/);
  });

  it("importa MESES_VENCIMIENTO_COMPRA desde economia (fuente de verdad)", () => {
    expect(SRC).toMatch(/MESES_VENCIMIENTO_COMPRA/);
    expect(SRC).toMatch(/economia/);
  });
});

describe("compras.service — BONUS_POR_PACK", () => {
  it("exporta BONUS_POR_PACK con los 4 packs definidos", () => {
    expect(SRC).toMatch(/BONUS_POR_PACK/);
    expect(SRC).toMatch(/pack-20/);
    expect(SRC).toMatch(/pack-50/);
    expect(SRC).toMatch(/pack-100/);
    expect(SRC).toMatch(/pack-250/);
  });
});
