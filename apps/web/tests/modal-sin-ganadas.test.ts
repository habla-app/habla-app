// Tests AST — ModalSinGanadas + integración con CanjearModal/FeaturedPrize/PrizeCardV2 (Lote 6B).
// Verifica la nueva ruta de error BALANCE_INSUFICIENTE y el modal que la maneja.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

function read(p: string): string {
  return readFileSync(resolve(ROOT, p), "utf-8");
}

describe("ModalSinGanadas — componente nuevo", () => {
  const SRC = read("components/tienda/ModalSinGanadas.tsx");

  it('es Client Component ("use client")', () => {
    expect(SRC).toMatch(/^\s*(?:\/\/[^\n]*\n\s*)*"use client";?/);
  });

  it("dispara evento tienda_canje_bloqueado_sin_ganadas al abrirse", () => {
    expect(SRC).toMatch(/tienda_canje_bloqueado_sin_ganadas/);
    expect(SRC).toMatch(/track\(/);
  });

  it("dispara evento tienda_sin_ganadas_cta_partidos_clicked al ir a partidos", () => {
    expect(SRC).toMatch(/tienda_sin_ganadas_cta_partidos_clicked/);
  });

  it("importa track desde analytics (no posthog-js directo)", () => {
    expect(SRC).toMatch(/from\s+["']@\/lib\/analytics["']/);
    expect(SRC).not.toMatch(/from\s+["']posthog-js["']/);
  });

  it("usa Modal de components/ui/Modal", () => {
    expect(SRC).toMatch(/from\s+["']@\/components\/ui\/Modal["']/);
  });

  it("muestra el balance Ganados y el coste del premio", () => {
    expect(SRC).toMatch(/ganadas/);
    expect(SRC).toMatch(/coste/);
  });

  it("enlaza a /matches para ganar más Lukas", () => {
    expect(SRC).toMatch(/href=["']\/matches["']/);
  });

  it("NO menciona Lukas Comprados ni Bonus (solo Ganados son canjeables)", () => {
    expect(SRC).not.toMatch(/compradas/i);
    expect(SRC).not.toMatch(/bonus/i);
  });
});

describe("CanjearModal — maneja BALANCE_INSUFICIENTE con callback", () => {
  const SRC = read("components/tienda/CanjearModal.tsx");

  it("declara prop onBalanceInsuficiente", () => {
    expect(SRC).toMatch(/onBalanceInsuficiente/);
  });

  it("detecta código BALANCE_INSUFICIENTE en el error de la API", () => {
    expect(SRC).toMatch(/BALANCE_INSUFICIENTE/);
  });

  it("llama onBalanceInsuficiente en lugar de mostrar error de texto", () => {
    expect(SRC).toMatch(/onBalanceInsuficiente\?\.\(\)/);
  });
});

describe("FeaturedPrize — usa balanceGanadas + ModalSinGanadas", () => {
  const SRC = read("components/tienda/FeaturedPrize.tsx");

  it("importa ModalSinGanadas", () => {
    expect(SRC).toMatch(/ModalSinGanadas/);
  });

  it("declara prop balanceGanadas", () => {
    expect(SRC).toMatch(/balanceGanadas/);
  });

  it("usa balanceGanadas para afordable (no balanceActual)", () => {
    expect(SRC).toMatch(/balanceGanadas\s*>=\s*premio\.costeLukas/);
  });

  it("declara prop onCanjeado", () => {
    expect(SRC).toMatch(/onCanjeado/);
  });

  it("pasa onBalanceInsuficiente a CanjearModal", () => {
    expect(SRC).toMatch(/onBalanceInsuficiente/);
  });
});

describe("PrizeCardV2 — usa balanceGanadas + ModalSinGanadas", () => {
  const SRC = read("components/tienda/PrizeCardV2.tsx");

  it("importa ModalSinGanadas", () => {
    expect(SRC).toMatch(/ModalSinGanadas/);
  });

  it("declara prop balanceGanadas", () => {
    expect(SRC).toMatch(/balanceGanadas/);
  });

  it("declara prop onCanjeado", () => {
    expect(SRC).toMatch(/onCanjeado/);
  });
});

describe("analytics.ts — incluye los 3 eventos de Lote 6B", () => {
  const SRC = read("lib/analytics.ts");

  it("define wallet_desglose_viewed", () => {
    expect(SRC).toMatch(/wallet_desglose_viewed/);
  });

  it("define tienda_canje_bloqueado_sin_ganadas", () => {
    expect(SRC).toMatch(/tienda_canje_bloqueado_sin_ganadas/);
  });

  it("define tienda_sin_ganadas_cta_partidos_clicked", () => {
    expect(SRC).toMatch(/tienda_sin_ganadas_cta_partidos_clicked/);
  });
});
