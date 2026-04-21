// Tests AST + smoke del service de premios. Sub-Sprint 6.
//
// Nota Hotfix #9: el catálogo de 25 premios se movió de
// `packages/db/prisma/seed.ts` a `packages/db/src/catalog.ts` (fuente de
// verdad única reusada por el endpoint admin `/api/v1/admin/seed/premios`).
// Estos tests apuntan ahora al archivo compartido — la estructura de
// datos es idéntica.

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
  resolve(ROOT, "..", "..", "packages/db/src/catalog.ts"),
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

describe("catálogo de premios compartido — cumple requisitos MVP", () => {
  it("define al menos 20 premios", () => {
    const matches = SEED_SRC.match(/\{\s*nombre:/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(20);
  });

  it("cubre las 5 categorías", () => {
    // Post-Hotfix #9: el catálogo usa tipo fuerte `CatalogoCategoria` en vez
    // de `as const` inline; las categorías aparecen como strings literales
    // dentro de `categoria: "X",`.
    for (const cat of CATEGORIAS_VALIDAS) {
      expect(SEED_SRC).toMatch(new RegExp(`categoria:\\s*["']${cat}["']`));
    }
  });

  it("tiene al menos un featured", () => {
    expect(SEED_SRC).toMatch(/featured:\s*true/);
  });

  it("usa badges POPULAR, NUEVO o LIMITADO", () => {
    expect(SEED_SRC).toMatch(/badge:\s*["']POPULAR["']/);
    expect(SEED_SRC).toMatch(/badge:\s*["']NUEVO["']/);
    expect(SEED_SRC).toMatch(/badge:\s*["']LIMITADO["']/);
  });

  it("marca requiereDireccion en productos físicos (camisetas y tech)", () => {
    // Al menos 8 instancias de requiereDireccion: true (5 camisetas + 6 tech físicos)
    const matches = SEED_SRC.match(/requiereDireccion:\s*true/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(8);
  });
});
