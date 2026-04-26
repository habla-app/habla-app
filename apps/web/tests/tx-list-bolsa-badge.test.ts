// Tests AST — TxList: chips de bolsa removidos (Lote 6B-fix2).
// Originalmente Lote 6B introdujo chips Comprados/Bonus/Ganados en cada tx.
// Lote 6B-fix2 los removió (CLAUDE.md sección 8) por decisión de UX.
// Este test ahora verifica que los chips siguen FUERA del componente.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

function read(p: string): string {
  return readFileSync(resolve(ROOT, p), "utf-8");
}

describe("TxList — sin chips de bolsa (Lote 6B-fix2)", () => {
  const SRC = read("components/wallet/TxList.tsx");

  it("NO define BOLSA_CHIP", () => {
    expect(SRC).not.toMatch(/BOLSA_CHIP/);
  });

  it("NO renderiza chips Comprados/Bonus/Ganados inline", () => {
    expect(SRC).not.toMatch(/>Comprados</);
    expect(SRC).not.toMatch(/>Ganados</);
  });

  it("usa tokens Tailwind, sin hex hardcodeados", () => {
    const hexMatches = SRC.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [];
    expect(hexMatches).toHaveLength(0);
  });
});

describe("WalletTransaccion — tipo incluye bolsa opcional", () => {
  // Aunque la UI ya no muestra chip, el tipo sigue exponiendo bolsa
  // para futuros usos (ej. agrupados o filtros adicionales).
  const SRC = read("lib/services/wallet-view.service.ts");

  it("WalletTransaccion incluye campo bolsa", () => {
    expect(SRC).toMatch(/bolsa/);
  });
});
