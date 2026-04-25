// Tests AST — TxList bolsa badge (Lote 6B).
// Verifica que cada tx muestra el chip de bolsa (Comprados/Bonus/Ganados)
// con los colores del design system.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

function read(p: string): string {
  return readFileSync(resolve(ROOT, p), "utf-8");
}

describe("TxList — bolsa badge Lote 6B", () => {
  const SRC = read("components/wallet/TxList.tsx");

  it("define BOLSA_CHIP con las 3 bolsas", () => {
    expect(SRC).toMatch(/BOLSA_CHIP/);
    expect(SRC).toMatch(/COMPRADAS/);
    expect(SRC).toMatch(/BONUS/);
    expect(SRC).toMatch(/GANADAS/);
  });

  it("etiqueta COMPRADAS → 'Comprados'", () => {
    expect(SRC).toMatch(/COMPRADAS[\s\S]{0,120}Comprados/);
  });

  it("etiqueta BONUS → 'Bonus'", () => {
    expect(SRC).toMatch(/BONUS[\s\S]{0,80}Bonus/);
  });

  it("etiqueta GANADAS → 'Ganados'", () => {
    expect(SRC).toMatch(/GANADAS[\s\S]{0,120}Ganados/);
  });

  it("chip COMPRADAS usa token brand-blue-light (no hex)", () => {
    expect(SRC).toMatch(/brand-blue-light/);
    const hexMatches = SRC.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [];
    expect(hexMatches).toHaveLength(0);
  });

  it("chip BONUS usa token brand-gold (no hex)", () => {
    expect(SRC).toMatch(/brand-gold/);
  });

  it("chip GANADAS usa token brand-green (no hex)", () => {
    expect(SRC).toMatch(/brand-green/);
  });

  it("guarda el chip con doble guard tx.bolsa && BOLSA_CHIP[tx.bolsa]", () => {
    expect(SRC).toMatch(/tx\.bolsa\s*&&\s*BOLSA_CHIP\[tx\.bolsa\]/);
  });

  it("el chip se renderiza inline en TxItem (no función separada BolsaChip)", () => {
    expect(SRC).not.toMatch(/function\s+BolsaChip/);
  });
});

describe("WalletTransaccion — tipo incluye bolsa opcional", () => {
  const SRC = read("lib/services/wallet-view.service.ts");

  it("WalletTransaccion incluye campo bolsa", () => {
    expect(SRC).toMatch(/bolsa/);
  });
});
