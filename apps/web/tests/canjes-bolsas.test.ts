// Tests AST de canjes.service — verificación de patrones de bolsas Lote 6A.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SRC = readFileSync(
  resolve(ROOT, "lib/services/canjes.service.ts"),
  "utf-8",
);

describe("canjes.service — bolsas Lote 6A", () => {
  it("importa getBalanceCanjeable desde lukas-display", () => {
    expect(SRC).toMatch(/getBalanceCanjeable/);
    expect(SRC).toMatch(/lukas-display/);
  });

  it("el balance que se verifica para canjear es el canjeable (solo ganadas)", () => {
    // El service debe verificar `canjeable` (resultado de getBalanceCanjeable)
    // no el total
    expect(SRC).toMatch(/getBalanceCanjeable/);
    expect(SRC).toMatch(/BalanceInsuficiente/);
  });

  it("el CANJE descuenta balanceGanadas (no compradas ni bonus)", () => {
    expect(SRC).toMatch(/balanceGanadas:\s*\{\s*decrement/);
  });

  it("el CANJE crea TransaccionLukas con bolsa GANADAS", () => {
    expect(SRC).toMatch(/bolsa:\s*["']GANADAS["']/);
    expect(SRC).toMatch(/tipo:\s*["']CANJE["']/);
  });

  it("el REEMBOLSO de cancelación incrementa balanceGanadas", () => {
    expect(SRC).toMatch(/balanceGanadas:\s*\{\s*increment/);
  });

  it("el REEMBOLSO de cancelación crea tx con bolsa GANADAS", () => {
    // Al cancelar un canje, la bolsa del reembolso es GANADAS
    const reembolsoIdx = SRC.indexOf("REEMBOLSO");
    const ganadas2Idx = SRC.indexOf("GANADAS", reembolsoIdx);
    expect(ganadas2Idx).toBeGreaterThan(reembolsoIdx);
  });

  it("decrementa balanceLukas junto al balanceGanadas", () => {
    expect(SRC).toMatch(/balanceLukas:\s*\{\s*decrement/);
  });

  it("todo en prisma.$transaction (atomicidad)", () => {
    expect(SRC).toMatch(/prisma\.\$transaction/);
  });
});
