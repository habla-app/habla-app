// Tests AST de la UI de /tienda. Sub-Sprint 6.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

function read(p: string): string {
  return readFileSync(resolve(ROOT, p), "utf-8");
}

describe("/tienda — page.tsx (RSC)", () => {
  const SRC = read("app/(main)/tienda/page.tsx");

  it("exporta force-dynamic", () => {
    expect(SRC).toMatch(/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/);
  });

  it("llama listarPremios en el server", () => {
    expect(SRC).toMatch(/listarPremios/);
  });

  it("pasa isLoggedIn y initialBalance a TiendaContent", () => {
    expect(SRC).toMatch(/isLoggedIn/);
    expect(SRC).toMatch(/initialBalance/);
  });
});

describe("/tienda — PrizeCardV2", () => {
  const SRC = read("components/tienda/PrizeCardV2.tsx");

  it('es Client Component ("use client")', () => {
    expect(SRC).toMatch(/^\s*(?:\/\/[^\n]*\n\s*)*"use client";?/);
  });

  it("3 estados visuales: agotado, afordable, no-afordable", () => {
    expect(SRC).toMatch(/agotado/);
    expect(SRC).toMatch(/afordable/);
    expect(SRC).toMatch(/faltan/);
  });

  it("abre CanjearModal al hacer click cuando afordable", () => {
    expect(SRC).toMatch(/CanjearModal/);
    expect(SRC).toMatch(/onClick=\{.*setOpen\(true\)/);
  });

  it("muestra badges POPULAR/NUEVO/LIMITADO con colores del design system", () => {
    expect(SRC).toMatch(/POPULAR[\s\S]*NUEVO[\s\S]*LIMITADO/);
  });
});

describe("/tienda — CanjearModal", () => {
  const SRC = read("components/tienda/CanjearModal.tsx");

  it('es Client Component ("use client")', () => {
    expect(SRC).toMatch(/^\s*(?:\/\/[^\n]*\n\s*)*"use client";?/);
  });

  it("usa authedFetch para el POST (§14)", () => {
    expect(SRC).toMatch(/authedFetch\(/);
    expect(SRC).not.toMatch(/fetch\(["']\/api\/v1\//);
  });

  it("actualiza balance via setBalance del store post-canje (§14)", () => {
    expect(SRC).toMatch(/setBalance\(json\.data\.nuevoBalance\)/);
  });

  it("renderiza form de dirección solo si requiereDireccion", () => {
    expect(SRC).toMatch(/premio\.requiereDireccion/);
  });

  it("valida form antes de habilitar submit", () => {
    expect(SRC).toMatch(/formValido/);
  });

  it("status machine: idle → submitting → success/error", () => {
    expect(SRC).toMatch(/"idle"/);
    expect(SRC).toMatch(/"submitting"/);
    expect(SRC).toMatch(/"success"/);
    expect(SRC).toMatch(/"error"/);
  });
});

describe("/tienda — TiendaContent", () => {
  const SRC = read("components/tienda/TiendaContent.tsx");

  it("lee balance del store (Hotfix #5 §14)", () => {
    expect(SRC).toMatch(/useLukasStore/);
  });

  it("muestra chips de categoría + featured + grid", () => {
    expect(SRC).toMatch(/CatFilters/);
    expect(SRC).toMatch(/FeaturedPrize/);
    expect(SRC).toMatch(/PrizeCardV2/);
  });

  it("nota legal sobre Lukas (no son efectivo)", () => {
    // Wording vigente: "no son efectivo". Versiones anteriores usaban
    // variantes "no son convertibles a efectivo" / "no se retiran como
    // efectivo" — todas semánticamente equivalentes.
    expect(SRC).toMatch(/no\s+son\s+(convertibles\s+a\s+)?efectivo/i);
  });
});
