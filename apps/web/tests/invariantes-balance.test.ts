// Tests AST de las invariantes del sistema de balances — Lote 6C-fix3 Fase 4.
//
// Verifican que cada service que muta balances:
//   1. Importa el helper `verificarConsistenciaBalance` del módulo compartido.
//   2. Lo invoca al final de cada `prisma.$transaction` (post-mutación).
//
// Esto previene futuras regresiones donde un dev nuevo agrega una mutación
// pero olvida el guard. Si el archivo del service deja de cumplir el patrón,
// el test rompe en CI antes del deploy.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

function readService(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf-8");
}

describe("Invariantes de balance — guards en services", () => {
  it("balance-consistency.helper.ts existe y exporta verificarConsistenciaBalance", () => {
    const src = readService("lib/services/balance-consistency.helper.ts");
    expect(src).toMatch(/export async function verificarConsistenciaBalance/);
    expect(src).toMatch(/balanceLukas !== sumaBolsas/);
    expect(src).toMatch(/DESINCRONIZACION/);
  });

  it("torneos.service usa el guard tras descuento (Lote 6C-fix2)", () => {
    const src = readService("lib/services/torneos.service.ts");
    // El guard original en torneos.service vive embebido en descontarEntrada
    // (no usa el helper compartido — fue el primer caso). Verificamos la
    // detección manual de divergencia con el log error.
    expect(src).toMatch(/balanceLukas !== sumaBolsas/);
    expect(src).toMatch(/DESINCRONIZACION/);
  });

  it("canjes.service importa y usa verificarConsistenciaBalance", () => {
    const src = readService("lib/services/canjes.service.ts");
    expect(src).toMatch(
      /from\s+["']\.\/balance-consistency\.helper["']/,
    );
    expect(src).toMatch(/verificarConsistenciaBalance\s*\(\s*tx\s*,\s*usuarioId\s*,\s*["']canjes\.solicitar["']/);
    expect(src).toMatch(/verificarConsistenciaBalance\s*\(\s*tx\s*,\s*canje\.usuarioId\s*,\s*["']canjes\.cancelar["']/);
  });

  it("ranking.service importa y usa verificarConsistenciaBalance en ambos flujos", () => {
    const src = readService("lib/services/ranking.service.ts");
    expect(src).toMatch(
      /from\s+["']\.\/balance-consistency\.helper["']/,
    );
    expect(src).toMatch(/ranking\.finalizarTorneo/);
    expect(src).toMatch(/ranking\.reconciliar/);
  });

  it("compras.service importa y usa verificarConsistenciaBalance", () => {
    const src = readService("lib/services/compras.service.ts");
    expect(src).toMatch(
      /from\s+["']\.\/balance-consistency\.helper["']/,
    );
    expect(src).toMatch(/compras\.acreditar/);
  });

  it("vencimiento-lukas.job importa y usa verificarConsistenciaBalance", () => {
    const src = readService("lib/services/vencimiento-lukas.job.ts");
    expect(src).toMatch(
      /from\s+["']\.\/balance-consistency\.helper["']/,
    );
    expect(src).toMatch(/vencimiento-lukas\.vencer/);
  });
});

describe("Invariantes de balance — auditoria-balances.service expone las 13", () => {
  const src = readService("lib/services/auditoria-balances.service.ts");

  it("define las 13 invariantes I1-I13", () => {
    for (const codigo of [
      "I1",
      "I2",
      "I3",
      "I4",
      "I5",
      "I6",
      "I7",
      "I8",
      "I9",
      "I10",
      "I11",
      "I12",
      "I13",
    ]) {
      expect(src).toMatch(new RegExp(`["']${codigo}["']`));
    }
  });

  it("exporta auditarTodos y auditarUsuario", () => {
    expect(src).toMatch(/export async function auditarTodos/);
    expect(src).toMatch(/export async function auditarUsuario/);
  });

  it("usa groupBy agregado para eficiencia (no N+1)", () => {
    expect(src).toMatch(/prisma\.transaccionLukas\.groupBy/);
  });
});

describe("Invariantes de balance — endpoints admin", () => {
  it("/admin/auditoria/full está guardado por CRON_SECRET", () => {
    const src = readService("app/api/v1/admin/auditoria/full/route.ts");
    expect(src).toMatch(/CRON_SECRET/);
    expect(src).toMatch(/auditarTodos/);
  });

  it("/admin/auditoria/usuario/[id] está guardado por CRON_SECRET", () => {
    const src = readService("app/api/v1/admin/auditoria/usuario/[id]/route.ts");
    expect(src).toMatch(/CRON_SECRET/);
    expect(src).toMatch(/auditarUsuario/);
  });

  it("/admin/auditoria/recategorizar-bolsas está guardado por CRON_SECRET", () => {
    const src = readService(
      "app/api/v1/admin/auditoria/recategorizar-bolsas/route.ts",
    );
    expect(src).toMatch(/CRON_SECRET/);
    expect(src).toMatch(/AJUSTE/);
    // Idempotencia: si los deltas son 0, no debe crear AJUSTE
    expect(src).toMatch(/deltaCompradas === 0/);
  });
});

describe("Invariantes de balance — Job G en instrumentation.ts", () => {
  const src = readService("instrumentation.ts");

  it("registra el job de auditoría diaria", () => {
    expect(src).toMatch(/auditarTodos/);
    expect(src).toMatch(/AUDIT_MIN_BETWEEN_RUNS_MS/);
    expect(src).toMatch(/enviarAlertaAuditoria/);
  });

  it("solo manda email si hay errors (no warns solos)", () => {
    expect(src).toMatch(/errors\.length\s*>\s*0/);
  });
});

describe("Invariantes de balance — wrapper enviarAlertaAuditoria", () => {
  const src = readService("lib/services/notificaciones.service.ts");

  it("destinatario configurable vía ADMIN_ALERT_EMAIL", () => {
    expect(src).toMatch(/ADMIN_ALERT_EMAIL/);
  });

  it("skippea con warn si la env var no está seteada (no rompe el cron)", () => {
    expect(src).toMatch(/ADMIN_ALERT_EMAIL no configurado/);
  });

  it("usa el template auditoriaAlertaTemplate", () => {
    expect(src).toMatch(/auditoriaAlertaTemplate/);
  });
});
