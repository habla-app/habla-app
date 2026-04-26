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

  it("torneos.service.cancelar fallback legacy reembolsa a BONUS (Lote 6C-fix4, no a COMPRADAS)", () => {
    const src = readService("lib/services/torneos.service.ts");
    // El comentario inline explicativo de la regla dura debe estar.
    expect(src).toMatch(/REGLA DE REEMBOLSO/);
    // El bloque del fallback (después del comentario "REGLA DE REEMBOLSO")
    // debe asignar la bolsa BONUS al usuario y a la TransaccionLukas.
    const reglaIdx = src.indexOf("REGLA DE REEMBOLSO");
    expect(reglaIdx).toBeGreaterThan(-1);
    const blockAfterRegla = src.slice(reglaIdx, reglaIdx + 2000);
    expect(blockAfterRegla).toMatch(/balanceBonus:\s*\{\s*increment/);
    expect(blockAfterRegla).toMatch(/bolsa:\s*["']BONUS["']/);
    // Y NO debe asignar bolsa COMPRADAS en el fallback.
    expect(blockAfterRegla).not.toMatch(
      /balanceCompradas:\s*\{\s*increment/,
    );
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

describe("Invariantes de balance — auditoria-balances.service expone las 14", () => {
  const src = readService("lib/services/auditoria-balances.service.ts");

  it("define las 14 invariantes I1-I14", () => {
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
      "I14",
    ]) {
      expect(src).toMatch(new RegExp(`["']${codigo}["']`));
    }
  });

  it("I14 detecta REEMBOLSO sin bolsa asignada", () => {
    expect(src).toMatch(/REEMBOLSO sin bolsa asignada/);
    expect(src).toMatch(/tipo:\s*["']REEMBOLSO["']/);
    expect(src).toMatch(/bolsa:\s*null/);
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
    expect(src).toMatch(/deltaCompradas === 0/);
  });

  it("/admin/auditoria/reset-y-inyectar-bonus exige confirmación literal y borra AJUSTE", () => {
    const src = readService(
      "app/api/v1/admin/auditoria/reset-y-inyectar-bonus/route.ts",
    );
    expect(src).toMatch(/CRON_SECRET/);
    expect(src).toMatch(/INYECTAR_TEST_LUKAS/);
    expect(src).toMatch(/deleteMany/);
    expect(src).toMatch(/tipo:\s*["']AJUSTE["']/);
    expect(src).toMatch(/compensacionDeficitCompradas/);
    expect(src).toMatch(/Bonus de testing/);
  });

  it("/admin/auditoria/mover-compradas-a-bonus exige confirmación y es idempotente", () => {
    const src = readService(
      "app/api/v1/admin/auditoria/mover-compradas-a-bonus/route.ts",
    );
    expect(src).toMatch(/CRON_SECRET/);
    expect(src).toMatch(/MOVER_COMPRADAS_A_BONUS/);
    // Filtra usuarios donde ya está en 0 (idempotencia)
    expect(src).toMatch(/balanceCompradas:\s*\{\s*gt:\s*0/);
    // Crea ambas tx (BONUS + AJUSTE) en transacción atómica
    expect(src).toMatch(/tipo:\s*["']BONUS["']/);
    expect(src).toMatch(/tipo:\s*["']AJUSTE["']/);
    // balanceCompradas se setea a 0
    expect(src).toMatch(/balanceCompradas:\s*0/);
  });

  it("/admin/auditoria/sanear-historial muta bolsas legítimas y borra AJUSTE", () => {
    const src = readService(
      "app/api/v1/admin/auditoria/sanear-historial/route.ts",
    );
    expect(src).toMatch(/CRON_SECRET/);
    expect(src).toMatch(/SANEAR_HISTORIAL_PRE_PROD/);
    // Solo muta tx si countCompras == 0 (guard contra producción real)
    expect(src).toMatch(/tieneCompras/);
    expect(src).toMatch(/tipo:\s*["']COMPRA["']/);
    // Mutaciones via updateMany de bolsa
    expect(src).toMatch(/updateMany/);
    expect(src).toMatch(/bolsa:\s*["']COMPRADAS["']/);
    expect(src).toMatch(/bolsa:\s*null/);
    expect(src).toMatch(/bolsa:\s*["']BONUS["']/);
    // Borra AJUSTE
    expect(src).toMatch(/deleteMany/);
    expect(src).toMatch(/tipo:\s*["']AJUSTE["']/);
  });

  // Lote 6C-fix5: guard countCompras debe estar en los 4 endpoints
  // destructivos por-usuario. reset-completo lo lleva más lejos
  // (aborta todo el batch si hay cualquier compra).
  it.each([
    "mover-compradas-a-bonus",
    "reset-y-inyectar-bonus",
    "recategorizar-bolsas",
    "sanear-historial",
  ])(
    "/admin/auditoria/%s skippea usuarios con countCompras > 0 (Lote 6C-fix5)",
    (endpoint) => {
      const src = readService(
        `app/api/v1/admin/auditoria/${endpoint}/route.ts`,
      );
      // Tiene una query countCompras tipo=COMPRA
      expect(src).toMatch(/transaccionLukas\.count[\s\S]{0,200}?tipo:\s*["']COMPRA["']/);
      // Y los skippea (el flujo de skipping varía pero todos contienen
      // alguna referencia a "skip" o el guard "countCompras > 0").
      expect(src).toMatch(/countCompras|tieneCompras/);
    },
  );

  it("/admin/auditoria/reset-completo aborta TODO si hay cualquier compra en el sistema", () => {
    const src = readService(
      "app/api/v1/admin/auditoria/reset-completo/route.ts",
    );
    expect(src).toMatch(/CRON_SECRET/);
    expect(src).toMatch(/RESET_COMPLETO_TESTING/);
    // Aborta global si totalCompras > 0
    expect(src).toMatch(/totalCompras/);
    expect(src).toMatch(/RESET_BLOQUEADO_POR_COMPRAS/);
    // Wipea ticket, canje, transaccionLukas
    expect(src).toMatch(/ticket\.deleteMany/);
    expect(src).toMatch(/canje\.deleteMany/);
    expect(src).toMatch(/transaccionLukas\.deleteMany/);
    // Restituye stock por canjes
    expect(src).toMatch(/stock:\s*\{\s*increment/);
    // Resetea torneos (pozoBruto, pozoNeto, rake, totalInscritos)
    expect(src).toMatch(/torneo\.updateMany/);
    expect(src).toMatch(/pozoBruto:\s*0/);
    expect(src).toMatch(/totalInscritos:\s*0/);
    // Inyecta bonus de bienvenida
    expect(src).toMatch(/BONUS_BIENVENIDA_LUKAS/);
  });

  it("/admin/auditoria/reset-completo soporta flag incluirEliminados (Lote 6C-fix6)", () => {
    const src = readService(
      "app/api/v1/admin/auditoria/reset-completo/route.ts",
    );
    expect(src).toMatch(/incluirEliminados/);
    // Si está en true, expande el scope a soft-deleted
    expect(src).toMatch(/incluirEliminados\s*\?\s*\{\s*\}\s*:\s*\{\s*deletedAt:\s*null\s*\}/);
    // Soft-deleted no recibe bonus de bienvenida (esActivo == false)
    expect(src).toMatch(/esActivo/);
    expect(src).toMatch(/u\.deletedAt === null/);
  });

  it("auditoria-balances.service filtra usuarios soft-deleted (Lote 6C-fix6)", () => {
    const src = readService("lib/services/auditoria-balances.service.ts");
    // Constante SCOPE_ACTIVO compartida
    expect(src).toMatch(/SCOPE_ACTIVO/);
    expect(src).toMatch(/usuario:\s*\{\s*deletedAt:\s*null\s*\}/);
    // Aplicado en queries clave (entradas, tickets, reembolsos, premios)
    expect(src).toMatch(/tipo:\s*["']ENTRADA_TORNEO["'][\s\S]{0,80}?SCOPE_ACTIVO/);
    expect(src).toMatch(/ticket\.findMany[\s\S]{0,80}?SCOPE_ACTIVO/);
    expect(src).toMatch(/tipo:\s*["']REEMBOLSO["'][\s\S]{0,150}?SCOPE_ACTIVO/);
    expect(src).toMatch(/tipo:\s*["']PREMIO_TORNEO["'][\s\S]{0,80}?SCOPE_ACTIVO/);
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
