// Tests del Hotfix #8 Bug #23 — auto-reconciliación de crédito faltante.
//
// Contexto: el Hotfix #7 arregló `finalizarTorneo` para acreditar Lukas
// al ganador. Pero el early-return por idempotencia (`alreadyFinalized`)
// dejaba en un estado irreparable cualquier torneo que llegó a
// FINALIZADO sin haber acreditado (torneos pre-Hotfix #7, o corridas
// donde el credit block falló por race condition). La próxima corrida
// del poller veía el estado FINALIZADO y retornaba sin chequear el
// crédito.
//
// Fix: el early-return ahora consulta si hay tickets con `premioLukas>0`
// cuya suma total exceda la suma de TransaccionLukas PREMIO_TORNEO del
// torneo. Si detecta crédito incompleto, dispara `reconciliarTorneo
// Finalizado` automáticamente (idempotente, solo acredita deltas > 0).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

function readSrc(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("finalizarTorneo — auto-reconcile al detectar estado FINALIZADO (Hotfix #8 Bug #23)", () => {
  const SRC = readSrc("lib/services/ranking.service.ts");

  it("el guard de idempotencia invoca detectarCreditoIncompleto", () => {
    // Buscar el bloque `if (preTorneo.estado === "FINALIZADO")` y
    // verificar que dentro se llama a `detectarCreditoIncompleto`.
    const idx = SRC.indexOf('if (preTorneo.estado === "FINALIZADO")');
    expect(idx).toBeGreaterThan(-1);
    // El `await detectarCreditoIncompleto(torneoId)` debe aparecer en
    // las siguientes 30 líneas.
    const after = SRC.slice(idx, idx + 2_000);
    expect(after).toMatch(/await\s+detectarCreditoIncompleto\s*\(/);
  });

  it("si el crédito está incompleto, loggea WARN y dispara reconciliación", () => {
    const idx = SRC.indexOf('if (preTorneo.estado === "FINALIZADO")');
    const after = SRC.slice(idx, idx + 2_000);
    // Debería haber un logger.warn con contexto `torneoId`.
    expect(after).toMatch(/logger\.warn\([\s\S]*?torneoId/);
    // Y debería llamar a reconciliarTorneoFinalizado.
    expect(after).toMatch(/await\s+reconciliarTorneoFinalizado\s*\(\s*torneoId\s*\)/);
  });

  it("el reconcile en el guard está envuelto en try/catch (no revienta al poller)", () => {
    const idx = SRC.indexOf("auto-reconciliando");
    expect(idx).toBeGreaterThan(-1);
    const around = SRC.slice(Math.max(0, idx - 200), idx + 1_500);
    expect(around).toMatch(/try\s*\{[\s\S]*?reconciliarTorneoFinalizado[\s\S]*?\}\s*catch/);
  });

  it("devuelve alreadyFinalized: true tras auto-reconcile (idempotente)", () => {
    const idx = SRC.indexOf('if (preTorneo.estado === "FINALIZADO")');
    const after = SRC.slice(idx, idx + 2_500);
    expect(after).toMatch(/return\s*\{\s*torneoId\s*,\s*ganadores:\s*\[\]\s*,\s*alreadyFinalized:\s*true\s*\}/);
  });
});

describe("detectarCreditoIncompleto — helper exportado (Hotfix #8 Bug #23)", () => {
  const SRC = readSrc("lib/services/ranking.service.ts");

  it("exporta detectarCreditoIncompleto como función async", () => {
    expect(SRC).toMatch(
      /export\s+async\s+function\s+detectarCreditoIncompleto\s*\(/,
    );
  });

  it("lee tickets con premioLukas > 0", () => {
    const idx = SRC.indexOf("export async function detectarCreditoIncompleto");
    const body = SRC.slice(idx);
    expect(body).toMatch(/premioLukas\s*:\s*\{\s*gt:\s*0\s*\}/);
  });

  it("lee TransaccionLukas filtradas por tipo=PREMIO_TORNEO + refId=torneoId", () => {
    const idx = SRC.indexOf("export async function detectarCreditoIncompleto");
    const body = SRC.slice(idx);
    expect(body).toMatch(
      /tipo:\s*["']PREMIO_TORNEO["'][\s\S]*?refId:\s*torneoId/,
    );
  });

  it("compara totalPremiosEsperado vs totalPremiosAcreditado y devuelve delta", () => {
    const idx = SRC.indexOf("export async function detectarCreditoIncompleto");
    const body = SRC.slice(idx);
    expect(body).toMatch(/totalPremiosEsperado/);
    expect(body).toMatch(/totalPremiosAcreditado/);
    expect(body).toMatch(/deltaPendiente/);
  });

  it("devuelve null cuando no hay tickets premiados (torneo sin pozo)", () => {
    const idx = SRC.indexOf("export async function detectarCreditoIncompleto");
    const body = SRC.slice(idx);
    expect(body).toMatch(/ticketsPremiados\.length\s*===\s*0[\s\S]*?return\s+null/);
  });

  it("devuelve null cuando delta <= 0 (crédito completo o sobre-crédito)", () => {
    const idx = SRC.indexOf("export async function detectarCreditoIncompleto");
    const body = SRC.slice(idx);
    expect(body).toMatch(/deltaPendiente\s*<=\s*0[\s\S]*?return\s+null/);
  });

  it("devuelve stats completas cuando detecta delta > 0", () => {
    const idx = SRC.indexOf("export async function detectarCreditoIncompleto");
    const body = SRC.slice(idx);
    expect(body).toMatch(
      /return\s*\{\s*stats:\s*\{\s*ticketsPremiados[\s\S]*?totalPremiosEsperado[\s\S]*?totalPremiosAcreditado[\s\S]*?deltaPendiente[\s\S]*?\}/,
    );
  });
});

describe("Preservación del comportamiento del Hotfix #7 (no regresión)", () => {
  const SRC = readSrc("lib/services/ranking.service.ts");

  it("finalizarTorneo sigue llamando recalcularTorneo antes de distribuir", () => {
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

  it("finalizarTorneo sigue acreditando PREMIO_TORNEO dentro de $transaction", () => {
    expect(SRC).toMatch(/prisma\.\$transaction\s*\(\s*async\s*\(tx\)/);
    // tx.transaccionLukas.create con tipo PREMIO_TORNEO.
    expect(SRC).toMatch(
      /tx\.transaccionLukas\.create\([\s\S]*?tipo:\s*["']PREMIO_TORNEO["']/,
    );
  });

  it("reconciliarTorneoFinalizado sigue siendo idempotente (delta > 0)", () => {
    expect(SRC).toMatch(/if\s*\(\s*delta\s*>\s*0\s*\)/);
  });

  it("detectarCreditoIncompleto es consultado en el mismo path del early-return", () => {
    // Garantiza que la función se usa — evita que quede como código
    // muerto si algún refactor la desenchufa.
    const idx = SRC.indexOf("export async function finalizarTorneo");
    const body = SRC.slice(idx, idx + 3_500);
    expect(body).toMatch(/detectarCreditoIncompleto\s*\(\s*torneoId\s*\)/);
  });
});
