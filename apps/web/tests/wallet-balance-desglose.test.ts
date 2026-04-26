// Tests AST — Wallet redesign (Lote 6B-fix2).
// Verifica que WalletView usa WalletBalanceHero (no Desglose), que WalletStats
// tiene los 3 nuevos contenidos, y que wallet_desglose_viewed se sigue trackeando.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

function read(p: string): string {
  return readFileSync(resolve(ROOT, p), "utf-8");
}

describe("WalletView — restaura WalletBalanceHero (no WalletBalanceDesglose)", () => {
  const SRC = read("components/wallet/WalletView.tsx");

  it("importa WalletBalanceHero", () => {
    expect(SRC).toMatch(/WalletBalanceHero/);
  });

  it("NO importa WalletBalanceDesglose", () => {
    expect(SRC).not.toMatch(/WalletBalanceDesglose/);
  });

  it("trackea wallet_desglose_viewed con las 3 bolsas", () => {
    expect(SRC).toMatch(/wallet_desglose_viewed/);
    expect(SRC).toMatch(/track\(/);
  });

  it("importa track desde analytics (no posthog-js directo)", () => {
    expect(SRC).toMatch(/from\s+["']@\/lib\/analytics["']/);
    expect(SRC).not.toMatch(/from\s+["']posthog-js["']/);
  });

  it("pasa gastadoEnCombinadas como totales.inscripciones", () => {
    expect(SRC).toMatch(/inscripciones/);
    expect(SRC).toMatch(/gastadoEnCombinadas/);
  });

  it("usa tokens Tailwind, no hex hardcodeados", () => {
    const hexMatches = SRC.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [];
    expect(hexMatches).toHaveLength(0);
  });
});

describe("WalletStats — nuevos contenidos", () => {
  const SRC = read("components/wallet/WalletStats.tsx");

  it("tiene card Ganadas en premios", () => {
    expect(SRC).toMatch(/[Gg]anadas/);
    expect(SRC).toMatch(/premios/i);
  });

  it("tiene card Lukas compradas", () => {
    expect(SRC).toMatch(/[Cc]ompradas/);
  });

  it("tiene card Gastadas en combinadas", () => {
    expect(SRC).toMatch(/[Gg]astadas/i);
    expect(SRC).toMatch(/combinadas/i);
  });

  it("acepta props ganadas, compradas, gastadoEnCombinadas", () => {
    expect(SRC).toMatch(/ganadas/);
    expect(SRC).toMatch(/compradas/);
    expect(SRC).toMatch(/gastadoEnCombinadas/);
  });

  it("usa responsive grid 2+1 en sm", () => {
    expect(SRC).toMatch(/sm:col-span-2/);
    expect(SRC).toMatch(/lg:col-span-1/);
  });

  it("usa tokens Tailwind, no hex hardcodeados", () => {
    const hexMatches = SRC.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [];
    expect(hexMatches).toHaveLength(0);
  });
});

describe("WalletBalanceHero — sigue existiendo con shimmer dorado", () => {
  const SRC = read("components/wallet/WalletBalanceHero.tsx");

  it('es Client Component ("use client")', () => {
    expect(SRC).toMatch(/^\s*(?:\/\/[^\n]*\n\s*)*"use client";?/);
  });

  it("muestra bh-v2-expire badge si hay proxVencimiento", () => {
    expect(SRC).toMatch(/proxVencimiento/);
    expect(SRC).toMatch(/Lukas vencen el/);
  });

  it("usa useLukasStore para balance hidratado", () => {
    expect(SRC).toMatch(/useLukasStore/);
  });
});

describe("Alert.tsx — variantes warning y error siguen existiendo", () => {
  const SRC = read("components/ui/Alert.tsx");

  it("define variante warning", () => {
    expect(SRC).toMatch(/warning/);
  });

  it("define variante error", () => {
    expect(SRC).toMatch(/error/);
  });
});
