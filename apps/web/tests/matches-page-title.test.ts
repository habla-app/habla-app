// Tests del Hotfix #5 Bug #15: el <h1> de /matches ya no dice "Partidos
// de hoy" hardcoded — ahora deriva de los filtros activos (liga + día)
// con el helper puro `buildMatchesPageTitle`.
//
// Matriz de casos:
//   (null, null)            → "Todos los torneos"
//   (liga, null)            → "Torneos de <liga>"
//   (null, hoy)             → "Torneos de hoy"
//   (null, mañana)          → "Torneos de mañana"
//   (null, otro día)        → "Torneos del <Mié 22 abr>"
//   (liga, hoy)             → "Torneos de <liga> · Hoy"
//   (liga, otro día)        → "Torneos de <liga> · <Mié 22 abr>"

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildMatchesPageTitle } from "@/lib/utils/matches-page-title";

// Fecha fija para tests deterministas: "2026-04-19 19:00" en UTC-5
// equivale a "2026-04-19 14:00" UTC. Ventana tz: America/Lima.
const NOW_LIMA_APR_19 = new Date("2026-04-19T19:00:00-05:00");

describe("buildMatchesPageTitle — sin filtros", () => {
  it("sin input devuelve 'Todos los torneos'", () => {
    expect(buildMatchesPageTitle({ now: NOW_LIMA_APR_19 }).title).toBe(
      "Todos los torneos",
    );
  });

  it("con liga=null y dia=null devuelve 'Todos los torneos'", () => {
    expect(
      buildMatchesPageTitle({ liga: null, dia: null, now: NOW_LIMA_APR_19 }).title,
    ).toBe("Todos los torneos");
  });

  it("con slug de liga desconocido cae al fallback (null) y muestra default", () => {
    expect(
      buildMatchesPageTitle({ liga: "inexistente", now: NOW_LIMA_APR_19 }).title,
    ).toBe("Todos los torneos");
  });
});

describe("buildMatchesPageTitle — solo liga", () => {
  it("'liga-1-peru' → 'Torneos de Liga 1 Perú'", () => {
    expect(
      buildMatchesPageTitle({ liga: "liga-1-peru", now: NOW_LIMA_APR_19 }).title,
    ).toBe("Torneos de Liga 1 Perú");
  });

  it("'champions' → 'Torneos de Champions League'", () => {
    expect(
      buildMatchesPageTitle({ liga: "champions", now: NOW_LIMA_APR_19 }).title,
    ).toBe("Torneos de Champions League");
  });

  it("'mundial' → 'Torneos de Mundial 2026'", () => {
    expect(
      buildMatchesPageTitle({ liga: "mundial", now: NOW_LIMA_APR_19 }).title,
    ).toBe("Torneos de Mundial 2026");
  });
});

describe("buildMatchesPageTitle — solo día", () => {
  it("dia=hoy → 'Torneos de hoy'", () => {
    expect(
      buildMatchesPageTitle({ dia: "2026-04-19", now: NOW_LIMA_APR_19 }).title,
    ).toBe("Torneos de hoy");
  });

  it("dia=mañana → 'Torneos de mañana'", () => {
    expect(
      buildMatchesPageTitle({ dia: "2026-04-20", now: NOW_LIMA_APR_19 }).title,
    ).toBe("Torneos de mañana");
  });

  it("dia en el mismo mes → 'Torneos del <Mié 22>'", () => {
    // 22 Abr es el miércoles dentro del mismo mes (Abril).
    const t = buildMatchesPageTitle({
      dia: "2026-04-22",
      now: NOW_LIMA_APR_19,
    }).title;
    expect(t).toMatch(/^Torneos del\s+Mié\s+22$/);
  });

  it("dia en otro mes → 'Torneos del <Vie 1 may>'", () => {
    // 1 May cae en mes distinto (Abril → Mayo), formatDayChip agrega el mes.
    const t = buildMatchesPageTitle({
      dia: "2026-05-01",
      now: NOW_LIMA_APR_19,
    }).title;
    expect(t).toMatch(/^Torneos del\s+Vie\s+1\s+may$/);
  });

  it("dayKey inválido (no parsea) → fallback 'Todos los torneos'", () => {
    expect(
      buildMatchesPageTitle({ dia: "nope", now: NOW_LIMA_APR_19 }).title,
    ).toBe("Todos los torneos");
  });
});

describe("buildMatchesPageTitle — liga + día", () => {
  it("'liga-1-peru' + hoy → 'Torneos de Liga 1 Perú · Hoy'", () => {
    expect(
      buildMatchesPageTitle({
        liga: "liga-1-peru",
        dia: "2026-04-19",
        now: NOW_LIMA_APR_19,
      }).title,
    ).toBe("Torneos de Liga 1 Perú · Hoy");
  });

  it("'champions' + mañana → 'Torneos de Champions League · Mañana'", () => {
    expect(
      buildMatchesPageTitle({
        liga: "champions",
        dia: "2026-04-20",
        now: NOW_LIMA_APR_19,
      }).title,
    ).toBe("Torneos de Champions League · Mañana");
  });

  it("'premier' + otro día (mismo mes) → 'Torneos de Premier League · Mié 22'", () => {
    expect(
      buildMatchesPageTitle({
        liga: "premier",
        dia: "2026-04-22",
        now: NOW_LIMA_APR_19,
      }).title,
    ).toBe("Torneos de Premier League · Mié 22");
  });
});

describe("MatchesPageContent — wiring del título dinámico (Bug #15)", () => {
  const ROOT = resolve(__dirname, "..");
  const SRC = readFileSync(
    resolve(ROOT, "components/matches/MatchesPageContent.tsx"),
    "utf-8",
  );

  it("importa buildMatchesPageTitle", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*buildMatchesPageTitle\s*\}\s*from\s*["']@\/lib\/utils\/matches-page-title["']/,
    );
  });

  it("llama al helper con (ligaSlug, dia)", () => {
    expect(SRC).toMatch(/buildMatchesPageTitle\s*\(/);
    // Asegura que se derive del request y no de un string fijo.
    expect(SRC).toMatch(/liga:\s*ligaSlug\s*\?\?\s*null/);
    expect(SRC).toMatch(/dia:\s*dia\s*\?\?\s*null/);
  });

  it("renderiza {pageTitle} en el h1, no el literal 'Partidos de hoy'", () => {
    expect(SRC).toMatch(/<h1[^>]*data-testid=["']matches-page-title["'][^>]*>\s*\{pageTitle\}/);
    // Regresión del Bug #15: el literal no debe estar en el h1. Puede
    // aparecer en copy de fallback (no es el caso aquí) pero no como
    // h1 fijo.
    expect(SRC).not.toMatch(/<h1[^>]*>\s*Partidos de hoy\s*<\/h1>/);
  });
});
