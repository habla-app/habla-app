// Tests AST — Wallet redesign (Lote 6B-fix2).
// Verifica que WalletView usa WalletBalanceHero (no Desglose), que WalletStats
// tiene los 5 nuevos contenidos.

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

  it("pasa los 5 totales del filtro de historial a WalletStats (Lote 6C-fix7)", () => {
    expect(SRC).toMatch(/comprado=\{totales\.comprado\}/);
    expect(SRC).toMatch(/inscripciones=\{totales\.inscripciones\}/);
    expect(SRC).toMatch(/ganado=\{totales\.ganado\}/);
    expect(SRC).toMatch(/canjeado=\{totales\.canjeado\}/);
    expect(SRC).toMatch(/bonos=\{totales\.bonos\}/);
  });

  it("usa tokens Tailwind, no hex hardcodeados", () => {
    const hexMatches = SRC.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [];
    expect(hexMatches).toHaveLength(0);
  });
});

describe("WalletStats — 5 cards alineadas con filtros del historial (Lote 6C-fix7)", () => {
  const SRC = read("components/wallet/WalletStats.tsx");

  it("tiene los 5 labels: Compras, Inscripciones, Premios, Canjes, Bonus", () => {
    expect(SRC).toMatch(/label="Compras"/);
    expect(SRC).toMatch(/label="Inscripciones"/);
    expect(SRC).toMatch(/label="Premios"/);
    expect(SRC).toMatch(/label="Canjes"/);
    expect(SRC).toMatch(/label="Bonus"/);
  });

  it("usa los emojis del filtro del historial (💳 ⚽ 🏆 🎁 ⭐)", () => {
    expect(SRC).toMatch(/icon="💳"/);
    expect(SRC).toMatch(/icon="⚽"/);
    expect(SRC).toMatch(/icon="🏆"/);
    expect(SRC).toMatch(/icon="🎁"/);
    expect(SRC).toMatch(/icon="⭐"/);
  });

  it("acepta props comprado, inscripciones, ganado, canjeado, bonos", () => {
    expect(SRC).toMatch(/comprado:\s*number/);
    expect(SRC).toMatch(/inscripciones:\s*number/);
    expect(SRC).toMatch(/ganado:\s*number/);
    expect(SRC).toMatch(/canjeado:\s*number/);
    expect(SRC).toMatch(/bonos:\s*number/);
  });

  it("usa grid responsive de 5 columnas en lg", () => {
    expect(SRC).toMatch(/lg:grid-cols-5/);
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
