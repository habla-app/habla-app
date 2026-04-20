// Tests AST del service de canjes. Sub-Sprint 6.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SERVICE_SRC = readFileSync(
  resolve(ROOT, "lib/services/canjes.service.ts"),
  "utf-8",
);

describe("canjes.service — convenciones críticas", () => {
  it("crearCanje todo en prisma.$transaction (atomicidad)", () => {
    expect(SERVICE_SRC).toMatch(/prisma\.\$transaction/);
  });

  it("dispara email via notifyCanjeSolicitado (respeta preferencias)", () => {
    expect(SERVICE_SRC).toMatch(/notifyCanjeSolicitado/);
  });

  it("decrementa stock + descuenta Lukas + crea TransaccionLukas CANJE", () => {
    expect(SERVICE_SRC).toMatch(/balanceLukas:\s*\{\s*decrement/);
    expect(SERVICE_SRC).toMatch(/stock:\s*\{\s*decrement/);
    expect(SERVICE_SRC).toMatch(/tipo:\s*["']CANJE["']/);
  });

  it("lanza BalanceInsuficiente si no alcanza", () => {
    expect(SERVICE_SRC).toMatch(/new\s+BalanceInsuficiente/);
  });

  it("lanza SIN_STOCK si stock=0", () => {
    expect(SERVICE_SRC).toMatch(/"SIN_STOCK"/);
  });

  it("valida dirección cuando requiereDireccion=true", () => {
    expect(SERVICE_SRC).toMatch(/requiereDireccion/);
    expect(SERVICE_SRC).toMatch(/ValidacionFallida/);
  });

  it("respeta auto-exclusión vía verificarLimiteCanje", () => {
    expect(SERVICE_SRC).toMatch(/verificarLimiteCanje/);
  });

  it("máquina de estados: PENDIENTE→PROCESANDO→ENVIADO→ENTREGADO + CANCELADO", () => {
    expect(SERVICE_SRC).toMatch(/PENDIENTE:\s*\["PROCESANDO",\s*"CANCELADO"\]/);
    expect(SERVICE_SRC).toMatch(/PROCESANDO:\s*\["ENVIADO",\s*"CANCELADO"\]/);
    expect(SERVICE_SRC).toMatch(/ENVIADO:\s*\["ENTREGADO",\s*"CANCELADO"\]/);
    // ENTREGADO no tiene transiciones
    expect(SERVICE_SRC).toMatch(/ENTREGADO:\s*\[\]/);
  });

  it("al cancelar: reembolsa Lukas + restituye stock + crea REEMBOLSO", () => {
    expect(SERVICE_SRC).toMatch(/tipo:\s*["']REEMBOLSO["']/);
    expect(SERVICE_SRC).toMatch(/balanceLukas:\s*\{\s*increment/);
    expect(SERVICE_SRC).toMatch(/stock:\s*\{\s*increment/);
  });

  it("envía email al transicionar a ENVIADO o ENTREGADO", () => {
    expect(SERVICE_SRC).toMatch(/notifyCanjeEnviado/);
    expect(SERVICE_SRC).toMatch(/notifyCanjeEntregado/);
  });
});
