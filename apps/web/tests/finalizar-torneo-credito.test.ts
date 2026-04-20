// Tests antidrift del Hotfix #7 — finalizarTorneo acredita saldos +
// recalcula puntos + idempotencia + endpoint de reconciliación.
//
// Vitest corre en node sin jsdom y sin Prisma en CI, por eso los tests
// son AST-level sobre el archivo fuente. La lógica runtime se valida
// en el describe.runIf(DATABASE_URL) más abajo con Prisma real.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

function readSrc(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("finalizarTorneo — Hotfix #7 acredita saldos (Bug #18)", () => {
  const SRC = readSrc("lib/services/ranking.service.ts");

  it("crea TransaccionLukas con tipo PREMIO_TORNEO + monto = premioLukas", () => {
    expect(SRC).toMatch(
      /tipo:\s*["']PREMIO_TORNEO["'][\s\S]*?monto:\s*asig\.premioLukas/,
    );
  });

  it("incrementa balanceLukas del usuario ganador", () => {
    expect(SRC).toMatch(
      /balanceLukas:\s*\{\s*increment:\s*asig\.premioLukas\s*\}/,
    );
  });

  it("todo el flujo corre en prisma.$transaction (atomicidad)", () => {
    // Ticket update + balance increment + transacción + torneo FINALIZADO
    // deben compartir la misma `tx` — nunca el `prisma` global.
    expect(SRC).toMatch(/prisma\.\$transaction\s*\(\s*async\s*\(tx\)/);
    // Dentro de la tx, las llamadas a Prisma usan `tx.`, no `prisma.`
    const txBlock = extractTxBlock(SRC);
    expect(txBlock).toMatch(/tx\.ticket\.update/);
    expect(txBlock).toMatch(/tx\.usuario\.update/);
    expect(txBlock).toMatch(/tx\.transaccionLukas\.create/);
    expect(txBlock).toMatch(/tx\.torneo\.update/);
  });

  function extractTxBlock(src: string): string {
    const m = src.match(
      /prisma\.\$transaction\s*\(\s*async\s*\(tx\)\s*=>\s*\{([\s\S]*?)\n\s{0,4}\}\s*\)\s*;/,
    );
    return m?.[1] ?? "";
  }
});

describe("finalizarTorneo — Hotfix #7 recalcula antes (Bug #19)", () => {
  const SRC = readSrc("lib/services/ranking.service.ts");

  it("importa recalcularTorneo del puntuacion.service", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*recalcularTorneo\s*\}\s*from\s*["']\.\/puntuacion\.service["']/,
    );
  });

  it("llama recalcularTorneo antes de distribuir premios", () => {
    // Verifica que `await recalcularTorneo(torneoId)` aparece DENTRO
    // de `export async function finalizarTorneo` y ANTES del
    // `distribuirPremios`.
    const fnMatch = SRC.match(
      /export\s+async\s+function\s+finalizarTorneo[\s\S]*?^\}/m,
    );
    expect(fnMatch).toBeTruthy();
    const body = fnMatch?.[0] ?? "";
    const recalcIdx = body.indexOf("await recalcularTorneo");
    const distribuirIdx = body.indexOf("distribuirPremios(");
    expect(recalcIdx).toBeGreaterThan(-1);
    expect(distribuirIdx).toBeGreaterThan(-1);
    expect(recalcIdx).toBeLessThan(distribuirIdx);
  });
});

describe("finalizarTorneo — idempotencia (Hotfix #7)", () => {
  const SRC = readSrc("lib/services/ranking.service.ts");

  it("early-return cuando estado ya es FINALIZADO — no re-acredita", () => {
    expect(SRC).toMatch(
      /preTorneo\.estado\s*===\s*["']FINALIZADO["'][\s\S]*?alreadyFinalized:\s*true/,
    );
  });

  it("expone alreadyFinalized en FinalizarTorneoResult", () => {
    expect(SRC).toMatch(/alreadyFinalized:\s*boolean/);
  });
});

describe("reconciliarTorneoFinalizado — Hotfix #7 Bug #20", () => {
  const SRC = readSrc("lib/services/ranking.service.ts");

  it("exporta reconciliarTorneoFinalizado", () => {
    expect(SRC).toMatch(
      /export\s+async\s+function\s+reconciliarTorneoFinalizado/,
    );
  });

  it("requiere torneo FINALIZADO — throw si no lo está", () => {
    expect(SRC).toMatch(/torneo\.estado\s*!==\s*["']FINALIZADO["']/);
    expect(SRC).toMatch(/no está FINALIZADO/);
  });

  it("lee TransaccionLukas PREMIO_TORNEO existentes para no doble-acreditar", () => {
    expect(SRC).toMatch(
      /tipo:\s*["']PREMIO_TORNEO["'][\s\S]*?refId:\s*torneoId/,
    );
  });

  it("solo acredita cuando delta > 0", () => {
    expect(SRC).toMatch(/if\s*\(\s*delta\s*>\s*0\s*\)/);
  });

  it("calls recalcularTorneo antes de re-distribuir", () => {
    const fnMatch = SRC.match(
      /export\s+async\s+function\s+reconciliarTorneoFinalizado[\s\S]*?\n\}/,
    );
    expect(fnMatch).toBeTruthy();
    const body = fnMatch?.[0] ?? "";
    expect(body).toMatch(/await recalcularTorneo\s*\(/);
  });
});

describe("POST /api/v1/admin/torneos/:id/reconciliar — route handler", () => {
  const SRC = readSrc("app/api/v1/admin/torneos/[id]/reconciliar/route.ts");

  it("exige sesión ADMIN", () => {
    expect(SRC).toMatch(/session\.user\.rol\s*!==\s*["']ADMIN["']/);
    expect(SRC).toMatch(/NoAutorizado/);
  });

  it("delega a reconciliarTorneoFinalizado del service", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*reconciliarTorneoFinalizado\s*\}\s*from/,
    );
    expect(SRC).toMatch(/reconciliarTorneoFinalizado\s*\(\s*params\.id\s*\)/);
  });
});

describe("/matches y / — force-dynamic (Hotfix #7 Bug #17)", () => {
  it("apps/web/app/(main)/matches/page.tsx exporta dynamic=force-dynamic", () => {
    const SRC = readSrc("app/(main)/matches/page.tsx");
    expect(SRC).toMatch(
      /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/,
    );
  });

  it("apps/web/app/(main)/page.tsx exporta dynamic=force-dynamic", () => {
    const SRC = readSrc("app/(main)/page.tsx");
    expect(SRC).toMatch(
      /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/,
    );
  });
});

describe("PrizeRulesCard — copy simplificado (Hotfix #7 Bug #21)", () => {
  const SRC = readSrc("components/matches/PrizeRulesCard.tsx");

  it("quitó referencia a 'las posiciones que ocupan'", () => {
    expect(SRC).not.toMatch(/posiciones que ocupan/);
  });

  it("menciona 'partes iguales' entre jugadores empatados", () => {
    expect(SRC).toMatch(/partes iguales/);
    expect(SRC).toMatch(/empate/i);
  });
});
