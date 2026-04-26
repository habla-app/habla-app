// Tests del service de notificaciones. Sub-Sprint 6+7.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PREFERENCIAS_DEFAULT } from "../lib/services/notificaciones.service";

const ROOT = resolve(__dirname, "..");
const SERVICE_SRC = readFileSync(
  resolve(ROOT, "lib/services/notificaciones.service.ts"),
  "utf-8",
);
const RANKING_SRC = readFileSync(
  resolve(ROOT, "lib/services/ranking.service.ts"),
  "utf-8",
);

describe("notificaciones.service — preferencias default", () => {
  it("notifPremios, notifResultados, notifInicioTorneo default true", () => {
    expect(PREFERENCIAS_DEFAULT.notifPremios).toBe(true);
    expect(PREFERENCIAS_DEFAULT.notifResultados).toBe(true);
    expect(PREFERENCIAS_DEFAULT.notifInicioTorneo).toBe(true);
  });

  it("notifPromos y emailSemanal default FALSE (opt-in explícito)", () => {
    expect(PREFERENCIAS_DEFAULT.notifPromos).toBe(false);
    expect(PREFERENCIAS_DEFAULT.emailSemanal).toBe(false);
  });

  it("define 8 toggles (7 base + notifVencimientos del Lote 6A)", () => {
    const keys = Object.keys(PREFERENCIAS_DEFAULT);
    expect(keys.length).toBe(8);
    for (const k of [
      "notifInicioTorneo",
      "notifResultados",
      "notifPremios",
      "notifSugerencias",
      "notifCierreTorneo",
      "notifPromos",
      "emailSemanal",
      "notifVencimientos",
    ]) {
      expect(keys).toContain(k);
    }
  });
});

describe("notificaciones.service — contrato AST", () => {
  it("debeNotificar consulta PreferenciasNotif antes de despachar", () => {
    expect(SERVICE_SRC).toMatch(
      /preferenciasNotif\.findUnique/,
    );
  });

  it("exporta 8 wrappers específicos (fire-and-forget)", () => {
    expect(SERVICE_SRC).toMatch(/export\s+async\s+function\s+notifyPremioGanado/);
    expect(SERVICE_SRC).toMatch(/export\s+async\s+function\s+notifyCanjeSolicitado/);
    expect(SERVICE_SRC).toMatch(/export\s+async\s+function\s+notifyCanjeEnviado/);
    expect(SERVICE_SRC).toMatch(/export\s+async\s+function\s+notifyCanjeEntregado/);
    expect(SERVICE_SRC).toMatch(/export\s+async\s+function\s+notifyTorneoCancelado/);
    expect(SERVICE_SRC).toMatch(/export\s+async\s+function\s+notifyVerifCodigoEmail/);
    expect(SERVICE_SRC).toMatch(/export\s+async\s+function\s+notifySolicitudEliminar/);
    expect(SERVICE_SRC).toMatch(/export\s+async\s+function\s+notifyDatosDescargados/);
  });

  it("wrappers NO lanzan errores — try/catch con logger.error", () => {
    // 8 try { ... } catch (err) { logger.error }
    const matches = SERVICE_SRC.match(/catch\s*\(\s*err\s*\)\s*\{[^}]*logger\.error/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(6);
  });

  it("skippea usuarios soft-deleted (deletedAt check)", () => {
    expect(SERVICE_SRC).toMatch(/deletedAt/);
  });
});

describe("ranking.service.finalizarTorneo — despacha email por ganador", () => {
  it("importa notifyPremioGanado", () => {
    expect(RANKING_SRC).toMatch(
      /import\s+\{\s*notifyPremioGanado\s*\}\s+from\s+["']\.\/notificaciones\.service["']/,
    );
  });

  it("dispara notify por cada ganador con premioLukas > 0", () => {
    expect(RANKING_SRC).toMatch(/notifyPremioGanado/);
    expect(RANKING_SRC).toMatch(/for\s+\(\s*const\s+g\s+of\s+resultado/);
  });
});
