// Tests AST de vencimiento-lukas.job — verificación de patrones Lote 6A.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SRC = readFileSync(
  resolve(ROOT, "lib/services/vencimiento-lukas.job.ts"),
  "utf-8",
);

describe("vencimiento-lukas.job — step 1: vencer compras expiradas", () => {
  it("busca COMPRA con saldoVivo > 0 y venceEn <= now", () => {
    expect(SRC).toMatch(/tipo:\s*["']COMPRA["']/);
    expect(SRC).toMatch(/saldoVivo.*gt.*0|gt.*0.*saldoVivo/);
    expect(SRC).toMatch(/venceEn.*lte|lte.*venceEn/);
  });

  it("pone saldoVivo = 0 en la compra (la marca como consumida)", () => {
    expect(SRC).toMatch(/saldoVivo:\s*0/);
  });

  it("decrementa balanceCompradas del usuario", () => {
    expect(SRC).toMatch(/balanceCompradas:\s*\{\s*decrement/);
  });

  it("decrementa balanceLukas del usuario", () => {
    expect(SRC).toMatch(/balanceLukas:\s*\{\s*decrement/);
  });

  it("crea TransaccionLukas VENCIMIENTO con bolsa COMPRADAS y monto negativo", () => {
    expect(SRC).toMatch(/tipo:\s*["']VENCIMIENTO["']/);
    expect(SRC).toMatch(/bolsa:\s*["']COMPRADAS["']/);
    expect(SRC).toMatch(/-monto/);
  });

  it("usa prisma.$transaction para atomicidad", () => {
    expect(SRC).toMatch(/prisma\.\$transaction/);
  });

  it("notifica vía notifyLukasVencidos (fire-and-forget)", () => {
    expect(SRC).toMatch(/notifyLukasVencidos/);
  });
});

describe("vencimiento-lukas.job — step 2: aviso 7d", () => {
  it("busca COMPRA con venceEn en ventana [now+7d, now+8d)", () => {
    expect(SRC).toMatch(/window7d/);
    expect(SRC).toMatch(/vencAvisado7d:\s*false/);
  });

  it("marca vencAvisado7d = true", () => {
    expect(SRC).toMatch(/vencAvisado7d:\s*true/);
  });

  it("notifica vía notifyLukasPorVencer con dias=7", () => {
    expect(SRC).toMatch(/notifyLukasPorVencer/);
    expect(SRC).toMatch(/dias:\s*7/);
  });
});

describe("vencimiento-lukas.job — step 3: aviso 30d", () => {
  it("busca COMPRA con venceEn en ventana [now+30d, now+31d)", () => {
    expect(SRC).toMatch(/window30d/);
    expect(SRC).toMatch(/vencAvisado30d:\s*false/);
  });

  it("marca vencAvisado30d = true", () => {
    expect(SRC).toMatch(/vencAvisado30d:\s*true/);
  });

  it("notifica vía notifyLukasPorVencer con dias=30", () => {
    expect(SRC).toMatch(/dias:\s*30/);
  });
});

describe("vencimiento-lukas.job — idempotencia y skip", () => {
  it("tiene guard de tiempo mínimo (23h) entre runs", () => {
    expect(SRC).toMatch(/MIN_INTERVAL_MS/);
    expect(SRC).toMatch(/lastRunAt/);
  });

  it("retorna VencimientoJobResult con vencidos/aviso7d/aviso30d/tiempoMs", () => {
    expect(SRC).toMatch(/vencidos/);
    expect(SRC).toMatch(/aviso7d/);
    expect(SRC).toMatch(/aviso30d/);
    expect(SRC).toMatch(/tiempoMs/);
  });
});
