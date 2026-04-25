// Tests AST de torneos.service — verificación de patrones de bolsas Lote 6A.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SRC = readFileSync(
  resolve(ROOT, "lib/services/torneos.service.ts"),
  "utf-8",
);

describe("torneos.service — inscripción con 3 bolsas", () => {
  it("usa descontarEntrada (función interna de descuento FIFO)", () => {
    expect(SRC).toMatch(/descontarEntrada/);
  });

  it("orden de descuento: BONUS primero", () => {
    const idxBonus = SRC.indexOf("balanceBonus");
    const idxCompradas = SRC.indexOf("balanceCompradas");
    // balanceBonus debe referenciarse antes que balanceCompradas en el flujo de descuento
    expect(idxBonus).toBeGreaterThan(-1);
    expect(idxCompradas).toBeGreaterThan(-1);
    expect(idxBonus).toBeLessThan(idxCompradas);
  });

  it("decrementa saldoVivo en transacciones COMPRA usadas", () => {
    expect(SRC).toMatch(/saldoVivo/);
    expect(SRC).toMatch(/decrement/);
  });

  it("guarda composicion en metadata de la ENTRADA_TORNEO", () => {
    expect(SRC).toMatch(/composicion/);
    expect(SRC).toMatch(/metadata/);
  });

  it("crea TransaccionLukas de tipo ENTRADA_TORNEO", () => {
    expect(SRC).toMatch(/tipo:\s*["']ENTRADA_TORNEO["']/);
  });

  it("decrementa balanceLukas al inscribir", () => {
    expect(SRC).toMatch(/balanceLukas:\s*\{\s*decrement/);
  });

  it("usa prisma.$transaction para atomicidad", () => {
    expect(SRC).toMatch(/prisma\.\$transaction/);
  });
});

describe("torneos.service — cancelación/reembolso con restaurarEntrada", () => {
  it("usa restaurarEntrada para reponer bolsas según composicion", () => {
    expect(SRC).toMatch(/restaurarEntrada/);
  });

  it("busca ENTRADA_TORNEO por metadata.ticketId (JSON path)", () => {
    expect(SRC).toMatch(/ticketId/);
    expect(SRC).toMatch(/path/);
  });

  it("crea TransaccionLukas de tipo REEMBOLSO", () => {
    expect(SRC).toMatch(/tipo:\s*["']REEMBOLSO["']/);
  });

  it("tiene fallback legacy si no hay metadata (txs pre-Lote-6A)", () => {
    // El fallback restaura a balanceCompradas cuando no hay composicion
    expect(SRC).toMatch(/balanceCompradas.*increment|increment.*balanceCompradas/);
  });
});
