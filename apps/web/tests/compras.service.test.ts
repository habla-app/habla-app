// Tests AST de compras.service — verificación de patrones de bolsas Lote 6A.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SRC = readFileSync(
  resolve(ROOT, "lib/services/compras.service.ts"),
  "utf-8",
);
const PACKS_SRC = readFileSync(
  resolve(ROOT, "lib/constants/packs-lukas.ts"),
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

describe("packs-lukas — fuente única (Lote 8 repricing)", () => {
  it("define los 4 packs nuevos: basic, medium, large, vip", () => {
    expect(PACKS_SRC).toMatch(/id:\s*["']basic["']/);
    expect(PACKS_SRC).toMatch(/id:\s*["']medium["']/);
    expect(PACKS_SRC).toMatch(/id:\s*["']large["']/);
    expect(PACKS_SRC).toMatch(/id:\s*["']vip["']/);
  });

  it("aplica los precios autoritativos 10/25/50/100", () => {
    expect(PACKS_SRC).toMatch(/soles:\s*10\b/);
    expect(PACKS_SRC).toMatch(/soles:\s*25\b/);
    expect(PACKS_SRC).toMatch(/soles:\s*50\b/);
    expect(PACKS_SRC).toMatch(/soles:\s*100\b/);
  });

  it("aplica los bonos autoritativos 0/5/10/20", () => {
    // basic 0, medium 5, large 10, vip 20
    expect(PACKS_SRC).toMatch(/bonus:\s*0\b/);
    expect(PACKS_SRC).toMatch(/bonus:\s*5\b/);
    expect(PACKS_SRC).toMatch(/bonus:\s*10\b/);
    expect(PACKS_SRC).toMatch(/bonus:\s*20\b/);
  });

  it("compras.service re-exporta BONUS_POR_PACK desde la fuente única", () => {
    expect(SRC).toMatch(/from\s+["']\.\.\/constants\/packs-lukas["']/);
    expect(SRC).toMatch(/BONUS_POR_PACK/);
  });
});
