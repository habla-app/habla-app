// Tests del Hotfix #4 Bug #6: el ComboModal ahora tiene 6 estados
// discriminados (idle, submitting, success, insufficient-balance,
// tournament-closed, error) y cada uno rendera feedback + CTAs
// específicos. Los tests se dividen en dos bloques:
//
//   1. Unit puro sobre `computeComboModalUIState` + `statusFromBackendError`
//      (la función que derive título/copy/CTAs a partir del status).
//   2. AST-level antidrift sobre ComboModal.tsx — asserta que el
//      componente consume el helper, propaga los CTAs y tiene los
//      data-testids esperados. Vitest corre en env node sin jsdom, así
//      que no podemos render-test; pero cubrimos el contrato.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeComboModalUIState,
  statusFromBackendError,
  type ComboModalStatus,
} from "@/components/combo/combo-modal-status";

const ROOT = resolve(__dirname, "..");
const COMBO_MODAL_PATH = resolve(ROOT, "components", "combo", "ComboModal.tsx");
const COMBO_MODAL_SRC = readFileSync(COMBO_MODAL_PATH, "utf-8");

const ALL_STATUSES: ComboModalStatus[] = [
  "idle",
  "submitting",
  "success",
  "insufficient-balance",
  "tournament-closed",
  "error",
];

// ---------------------------------------------------------------------------
// Unit: computeComboModalUIState
// ---------------------------------------------------------------------------

describe("computeComboModalUIState", () => {
  it("idle sin placeholder: CTA submit con precio", () => {
    const ui = computeComboModalUIState({
      status: "idle",
      tienePlaceholder: false,
      entradaLukas: 5,
    });
    expect(ui.primaryCta?.kind).toBe("submit");
    expect(ui.primaryCta?.label).toMatch(/Inscribir por 5/);
    expect(ui.tone).toBe("neutral");
  });

  it("idle con placeholder: CTA submit con 'Confirmar'", () => {
    const ui = computeComboModalUIState({
      status: "idle",
      tienePlaceholder: true,
      entradaLukas: 5,
    });
    expect(ui.primaryCta?.label).toBe("Confirmar mi combinada");
  });

  it("submitting: sin CTAs, copy 'un momento'", () => {
    const ui = computeComboModalUIState({
      status: "submitting",
      tienePlaceholder: false,
      entradaLukas: 5,
    });
    expect(ui.primaryCta).toBeNull();
    expect(ui.secondaryCta).toBeNull();
    expect(ui.bodyTitle).toMatch(/Enviando/);
  });

  it("success sin placeholder: CTA 'Ver mis combinadas' + 'Crear otra'", () => {
    const ui = computeComboModalUIState({
      status: "success",
      tienePlaceholder: false,
      entradaLukas: 5,
    });
    expect(ui.primaryCta?.kind).toBe("link");
    expect(ui.primaryCta?.href).toBe("/mis-combinadas");
    expect(ui.primaryCta?.label).toMatch(/mis combinadas/i);
    expect(ui.secondaryCta?.kind).toBe("reset");
    expect(ui.secondaryCta?.label).toMatch(/Crear otra/);
    expect(ui.tone).toBe("success");
  });

  it("success con placeholder: copy 'Confirmada', CTA mis-combinadas sigue", () => {
    const ui = computeComboModalUIState({
      status: "success",
      tienePlaceholder: true,
      entradaLukas: 5,
    });
    expect(ui.bodyTitle).toMatch(/confirmada/i);
    expect(ui.primaryCta?.href).toBe("/mis-combinadas");
  });

  it("insufficient-balance: CTA a /wallet + copy con faltantes", () => {
    const ui = computeComboModalUIState({
      status: "insufficient-balance",
      tienePlaceholder: false,
      entradaLukas: 10,
      faltanLukas: 5,
    });
    expect(ui.primaryCta?.kind).toBe("link");
    expect(ui.primaryCta?.href).toBe("/wallet");
    expect(ui.bodyCopy).toMatch(/5/);
    expect(ui.tone).toBe("warning");
  });

  it("tournament-closed: CTA a /matches", () => {
    const ui = computeComboModalUIState({
      status: "tournament-closed",
      tienePlaceholder: false,
      entradaLukas: 5,
    });
    expect(ui.primaryCta?.kind).toBe("link");
    expect(ui.primaryCta?.href).toBe("/matches");
    expect(ui.bodyTitle).toMatch(/cerró/i);
  });

  it("error: CTA 'Reintentar' (kind=retry) + Cerrar", () => {
    const ui = computeComboModalUIState({
      status: "error",
      tienePlaceholder: false,
      entradaLukas: 5,
      errorMessage: "Error custom",
    });
    expect(ui.primaryCta?.kind).toBe("retry");
    expect(ui.primaryCta?.label).toMatch(/Reintentar/);
    expect(ui.secondaryCta?.kind).toBe("close");
    expect(ui.bodyCopy).toMatch(/Error custom/);
    expect(ui.tone).toBe("error");
  });

  it("error sin mensaje: copy default genérico", () => {
    const ui = computeComboModalUIState({
      status: "error",
      tienePlaceholder: false,
      entradaLukas: 5,
    });
    expect(ui.bodyCopy).toMatch(/conexión|servidor/i);
  });

  it("cada status devuelve un bodyTitle no vacío", () => {
    for (const s of ALL_STATUSES) {
      const ui = computeComboModalUIState({
        status: s,
        tienePlaceholder: false,
        entradaLukas: 5,
      });
      expect(ui.bodyTitle.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Unit: statusFromBackendError
// ---------------------------------------------------------------------------

describe("statusFromBackendError", () => {
  it("BALANCE_INSUFICIENTE → insufficient-balance", () => {
    expect(statusFromBackendError("BALANCE_INSUFICIENTE")).toBe(
      "insufficient-balance",
    );
  });
  it("TORNEO_CERRADO → tournament-closed", () => {
    expect(statusFromBackendError("TORNEO_CERRADO")).toBe("tournament-closed");
  });
  it("TORNEO_NO_ENCONTRADO → tournament-closed", () => {
    expect(statusFromBackendError("TORNEO_NO_ENCONTRADO")).toBe(
      "tournament-closed",
    );
  });
  it("código desconocido → error", () => {
    expect(statusFromBackendError("TICKET_DUPLICADO")).toBe("error");
    expect(statusFromBackendError("VALIDACION_FALLIDA")).toBe("error");
  });
  it("undefined → error", () => {
    expect(statusFromBackendError(undefined)).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// AST: ComboModal consume el helper y propaga el status
// ---------------------------------------------------------------------------

describe("ComboModal.tsx — AST antidrift Bug #6", () => {
  it("importa computeComboModalUIState desde combo-modal-status", () => {
    expect(COMBO_MODAL_SRC).toMatch(
      /import\s*\{[^}]*computeComboModalUIState[^}]*\}\s+from\s+["']\.\/combo-modal-status["']/,
    );
  });

  it("mantiene un estado `status` tipado con ComboModalStatus", () => {
    expect(COMBO_MODAL_SRC).toMatch(
      /useState<ComboModalStatus>\s*\(\s*["']idle["']\s*\)/,
    );
  });

  it("setea status 'submitting' antes del fetch", () => {
    expect(COMBO_MODAL_SRC).toMatch(/setStatus\s*\(\s*["']submitting["']\s*\)/);
  });

  it("setea status 'success' tras respuesta 200", () => {
    expect(COMBO_MODAL_SRC).toMatch(/setStatus\s*\(\s*["']success["']\s*\)/);
  });

  it("usa statusFromBackendError para mapear errores del backend", () => {
    expect(COMBO_MODAL_SRC).toMatch(/statusFromBackendError\s*\(/);
  });

  it("propaga CTA primario con data-testid='combo-primary-cta'", () => {
    expect(COMBO_MODAL_SRC).toMatch(/combo-primary-cta/);
  });

  it("propaga CTA secundario con data-testid='combo-secondary-cta'", () => {
    expect(COMBO_MODAL_SRC).toMatch(/combo-secondary-cta/);
  });

  it("el panel de éxito tiene data-testid='combo-success-details' para assertion", () => {
    expect(COMBO_MODAL_SRC).toMatch(/combo-success-details/);
  });

  it("cada feedback panel usa data-testid='combo-feedback-<status>'", () => {
    expect(COMBO_MODAL_SRC).toMatch(/combo-feedback-/);
  });

  it("defense-in-depth: handleSubmit gatea con balanceInsuficiente", () => {
    // Si balanceInsuficiente es true, debemos setear el status a
    // 'insufficient-balance' y salir sin POST.
    expect(COMBO_MODAL_SRC).toMatch(
      /if\s*\(\s*balanceInsuficiente\s*\)\s*\{[\s\S]*?setStatus\s*\(\s*["']insufficient-balance["']/,
    );
  });
});
