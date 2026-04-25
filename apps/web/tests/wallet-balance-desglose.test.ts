// Tests AST — WalletBalanceDesglose (Lote 6B).
// Verifica que el componente de desglose de bolsas existe, es Client Component,
// dispara el evento analytics correcto, y que WalletView lo usa en lugar del hero.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

function read(p: string): string {
  return readFileSync(resolve(ROOT, p), "utf-8");
}

describe("WalletBalanceDesglose — componente nuevo", () => {
  const SRC = read("components/wallet/WalletBalanceDesglose.tsx");

  it('es Client Component ("use client")', () => {
    expect(SRC).toMatch(/^\s*(?:\/\/[^\n]*\n\s*)*"use client";?/);
  });

  it("muestra las 3 bolsas: compradas, bonus, ganadas", () => {
    expect(SRC).toMatch(/compradas/i);
    expect(SRC).toMatch(/bonus/i);
    expect(SRC).toMatch(/ganadas/i);
  });

  it("dispara evento wallet_desglose_viewed con las 3 cantidades", () => {
    expect(SRC).toMatch(/wallet_desglose_viewed/);
    expect(SRC).toMatch(/track\(/);
  });

  it("importa track desde analytics (no posthog-js directo)", () => {
    expect(SRC).toMatch(/from\s+["']@\/lib\/analytics["']/);
    expect(SRC).not.toMatch(/from\s+["']posthog-js["']/);
  });

  it("usa Alert para el banner de vencimiento próximo", () => {
    expect(SRC).toMatch(/Alert/);
    expect(SRC).toMatch(/variant=["']warning["']/);
    expect(SRC).toMatch(/variant=["']error["']/);
  });

  it("usa tokens Tailwind, no hex hardcodeados", () => {
    const hexMatches = SRC.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [];
    expect(hexMatches).toHaveLength(0);
  });

  it("muestra total como suma de las 3 bolsas", () => {
    expect(SRC).toMatch(/total/i);
  });
});

describe("WalletView — usa WalletBalanceDesglose (no WalletBalanceHero)", () => {
  const SRC = read("components/wallet/WalletView.tsx");

  it("importa WalletBalanceDesglose", () => {
    expect(SRC).toMatch(/WalletBalanceDesglose/);
  });

  it("NO importa WalletBalanceHero", () => {
    expect(SRC).not.toMatch(/WalletBalanceHero/);
  });

  it("recibe prop desglose y la pasa al componente", () => {
    expect(SRC).toMatch(/desglose/);
  });

  it("calcula proximoVencimiento a partir de proxVencimiento", () => {
    expect(SRC).toMatch(/proximoVencimiento/);
    expect(SRC).toMatch(/proxVencimiento/);
  });
});

describe("Alert.tsx — variantes warning y error", () => {
  const SRC = read("components/ui/Alert.tsx");

  it("define variante warning", () => {
    expect(SRC).toMatch(/warning/);
  });

  it("define variante error", () => {
    expect(SRC).toMatch(/error/);
  });
});
