// Tests AST + smoke del service de premios. Sub-Sprint 6.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CATEGORIAS_VALIDAS } from "../lib/services/premios.service";

const ROOT = resolve(__dirname, "..");
const SERVICE_SRC = readFileSync(
  resolve(ROOT, "lib/services/premios.service.ts"),
  "utf-8",
);
const SEED_SRC = readFileSync(
  resolve(ROOT, "..", "..", "packages/db/prisma/seed.ts"),
  "utf-8",
);

describe("premios.service — contrato público", () => {
  it("exporta CATEGORIAS_VALIDAS con las 5 categorías del §10.6", () => {
    expect(CATEGORIAS_VALIDAS).toEqual([
      "ENTRADA",
      "CAMISETA",
      "GIFT",
      "TECH",
      "EXPERIENCIA",
    ]);
  });

  it("listarPremios ordena por featured desc, costeLukas asc", () => {
    expect(SERVICE_SRC).toMatch(/orderBy:\s*\[/);
    expect(SERVICE_SRC).toMatch(/featured.*desc/);
    expect(SERVICE_SRC).toMatch(/costeLukas.*asc/);
  });

  it("filtra premios inactivos por default", () => {
    expect(SERVICE_SRC).toMatch(/where\.activo\s*=\s*true/);
  });

  it("obtenerPremio lanza DomainError 404 si no existe", () => {
    expect(SERVICE_SRC).toMatch(/PREMIO_NO_ENCONTRADO/);
    expect(SERVICE_SRC).toMatch(/404/);
  });
});

describe("seed de premios — cumple requisitos de catálogo", () => {
  it("define al menos 20 premios", () => {
    const matches = SEED_SRC.match(/\{\s*nombre:/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(20);
  });

  it("cubre las 5 categorías", () => {
    for (const cat of CATEGORIAS_VALIDAS) {
      expect(SEED_SRC).toContain(`"${cat}" as const`);
    }
  });

  it("tiene al menos un featured", () => {
    expect(SEED_SRC).toMatch(/featured:\s*true/);
  });

  it("usa badges POPULAR, NUEVO o LIMITADO", () => {
    expect(SEED_SRC).toMatch(/"POPULAR"\s+as\s+const/);
    expect(SEED_SRC).toMatch(/"NUEVO"\s+as\s+const/);
    expect(SEED_SRC).toMatch(/"LIMITADO"\s+as\s+const/);
  });

  it("marca requiereDireccion en productos físicos (camisetas y tech)", () => {
    // Al menos 8 instancias de requiereDireccion: true (5 camisetas + 6 tech físicos)
    const matches = SEED_SRC.match(/requiereDireccion:\s*true/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(8);
  });
});
