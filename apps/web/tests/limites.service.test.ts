// Tests de limites.service — Sub-Sprint 7.
// Unit tests puros sobre la lógica de defaults y tests AST sobre el
// enforcement.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AUTOEXCLUSION_DIAS_VALIDOS,
  DEFAULT_LIMITE_DIARIO_TICKETS,
  DEFAULT_LIMITE_MENSUAL_COMPRA,
} from "../lib/services/limites.service";

const ROOT = resolve(__dirname, "..");
const SERVICE_SRC = readFileSync(
  resolve(ROOT, "lib/services/limites.service.ts"),
  "utf-8",
);
const TICKETS_SRC = readFileSync(
  resolve(ROOT, "lib/services/tickets.service.ts"),
  "utf-8",
);
const CANJES_SRC = readFileSync(
  resolve(ROOT, "lib/services/canjes.service.ts"),
  "utf-8",
);

describe("limites.service — defaults y constantes", () => {
  it("default mensual S/ 300 · default diario 10 tickets", () => {
    expect(DEFAULT_LIMITE_MENSUAL_COMPRA).toBe(300);
    expect(DEFAULT_LIMITE_DIARIO_TICKETS).toBe(10);
  });

  it("auto-exclusión admite solo 7, 30 o 90 días", () => {
    expect(AUTOEXCLUSION_DIAS_VALIDOS).toEqual([7, 30, 90]);
  });
});

describe("limites.service — contratos AST", () => {
  it("exporta verificarLimiteInscripcion para tickets.service", () => {
    expect(SERVICE_SRC).toMatch(
      /export\s+async\s+function\s+verificarLimiteInscripcion/,
    );
  });

  it("exporta verificarLimiteCanje para canjes.service", () => {
    expect(SERVICE_SRC).toMatch(
      /export\s+async\s+function\s+verificarLimiteCanje/,
    );
  });

  it("exporta verificarLimiteCompra para Sub-Sprint 2 (pagos)", () => {
    expect(SERVICE_SRC).toMatch(
      /export\s+async\s+function\s+verificarLimiteCompra/,
    );
  });

  it("exporta bloquearSiAutoExcluido como helper compartido", () => {
    expect(SERVICE_SRC).toMatch(
      /export\s+async\s+function\s+bloquearSiAutoExcluido/,
    );
  });

  it("obtenerLimites crea defaults si no existen (upsert-like)", () => {
    expect(SERVICE_SRC).toMatch(/limitesJuego\.create/);
    expect(SERVICE_SRC).toMatch(/DEFAULT_LIMITE_MENSUAL_COMPRA/);
    expect(SERVICE_SRC).toMatch(/DEFAULT_LIMITE_DIARIO_TICKETS/);
  });

  it("auto-exclusión genera fecha futura en milisegundos", () => {
    expect(SERVICE_SRC).toMatch(/dias\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  });

  it("lanza LimiteExcedido al superar límite diario", () => {
    expect(SERVICE_SRC).toMatch(/throw\s+new\s+LimiteExcedido/);
  });
});

describe("tickets.service — usa enforcement centralizado", () => {
  it("importa verificarLimiteInscripcion del nuevo service", () => {
    expect(TICKETS_SRC).toMatch(
      /import\s+\{[^}]*verificarLimiteInscripcion[^}]*\}\s+from\s+["']\.\/limites\.service["']/,
    );
  });

  it("llama verificarLimiteInscripcion al crear ticket nuevo", () => {
    expect(TICKETS_SRC).toMatch(
      /await\s+verificarLimiteInscripcion\s*\(/,
    );
  });

  it("chequea bloquearSiAutoExcluido al actualizar placeholder", () => {
    expect(TICKETS_SRC).toMatch(
      /bloquearSiAutoExcluido/,
    );
  });
});

describe("canjes.service — usa enforcement centralizado", () => {
  it("llama verificarLimiteCanje antes de descontar Lukas", () => {
    expect(CANJES_SRC).toMatch(/verificarLimiteCanje/);
  });
});
