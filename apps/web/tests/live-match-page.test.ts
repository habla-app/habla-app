// Tests antidrift del Hotfix #4 Bug #10 + Bug #11.
//
// Bug #10: el switcher de /live-match solo muestra partidos EN_VIVO.
// Los FINALIZADOS de las últimas 24h se renderean en una sección
// separada (`<LiveFinalizedSection>`) abajo del contenido en vivo.
//
// Bug #11: filter chips por liga en /live-match. Lista dinámica según
// ligas presentes EN_VIVO; estado en `?liga=<slug>`.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  LIGA_SLUGS,
  LIGA_SLUGS_ORDER,
  ligaToSlug,
  slugToLiga,
} from "@/lib/config/liga-slugs";

const ROOT = resolve(__dirname, "..");

function readSrc(relative: string): string {
  return readFileSync(resolve(ROOT, relative), "utf-8");
}

// ---------------------------------------------------------------------------
// Unit: ligaToSlug helper (Bug #11)
// ---------------------------------------------------------------------------

describe("ligaToSlug — reversa del lookup de ligas", () => {
  it("convierte 'Liga 1 Perú' → 'liga-1-peru'", () => {
    expect(ligaToSlug("Liga 1 Perú")).toBe("liga-1-peru");
  });

  it("convierte 'Champions League' → 'champions'", () => {
    expect(ligaToSlug("Champions League")).toBe("champions");
  });

  it("todas las entradas del LIGA_SLUGS son reversibles", () => {
    for (const [slug, nombre] of Object.entries(LIGA_SLUGS)) {
      expect(ligaToSlug(nombre)).toBe(slug);
    }
  });

  it("ligaToSlug inverso de slugToLiga para todas las ligas", () => {
    for (const slug of LIGA_SLUGS_ORDER) {
      const nombre = slugToLiga(slug);
      expect(nombre).not.toBeNull();
      expect(ligaToSlug(nombre!)).toBe(slug);
    }
  });

  it("liga desconocida → null", () => {
    expect(ligaToSlug("Liga Inexistente")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AST: /live-match page carga live + finalizados y pasa liga chips
// ---------------------------------------------------------------------------

describe("/live-match page — Bug #10 + #11 wiring", () => {
  const SRC = readSrc("app/(main)/live-match/page.tsx");

  it("importa obtenerFinalizedMatches del service (Bug #10)", () => {
    expect(SRC).toMatch(/obtenerFinalizedMatches/);
  });

  it("carga live-only del switcher (incluirFinalizados: false)", () => {
    expect(SRC).toMatch(/incluirFinalizados:\s*false/);
  });

  it("carga finalizados con ventana de 24h", () => {
    expect(SRC).toMatch(/sinceHours:\s*24/);
  });

  it("importa ligaToSlug y slugToLiga para mapear ?liga= ↔ partido.liga", () => {
    expect(SRC).toMatch(/ligaToSlug/);
    expect(SRC).toMatch(/slugToLiga/);
  });

  it("filtra liveRaw por el slug de ?liga= cuando está presente (Bug #11)", () => {
    expect(SRC).toMatch(/\.filter\(\(p\)\s*=>\s*p\.liga\s*===\s*ligaName\)/);
  });

  it("pasa `ligasChips` + `finalizedCards` al LiveMatchView", () => {
    expect(SRC).toMatch(/ligasChips=\{/);
    expect(SRC).toMatch(/finalizedCards=\{/);
  });

  it("pasa `filtroActivo` (booleano derivado de ?liga=) al LiveMatchView", () => {
    expect(SRC).toMatch(/filtroActivo=\{/);
  });
});

// ---------------------------------------------------------------------------
// AST: LiveSwitcher — empty state cuando no hay EN_VIVO
// ---------------------------------------------------------------------------

describe("LiveSwitcher + LiveMatchView — empty state del switcher", () => {
  const SRC = readSrc("components/live/LiveMatchView.tsx");

  it("cuando tabs está vacío muestra <LiveSwitcherEmpty>", () => {
    expect(SRC).toMatch(/LiveSwitcherEmpty/);
  });

  it("el empty copy cambia según filtroActivo (Bug #11 invita a quitar filtro)", () => {
    expect(SRC).toMatch(/filtroActivo/);
    expect(SRC).toMatch(/quitar el filtro|sin filtro/i);
  });

  it("tiene data-testid='live-switcher-empty' para assertion", () => {
    expect(SRC).toMatch(/live-switcher-empty/);
  });

  it("renderiza <LiveLeagueFilter> antes del switcher (Bug #11)", () => {
    const liveLeagueIdx = SRC.indexOf("<LiveLeagueFilter");
    const liveSwitcherIdx = SRC.indexOf("<LiveSwitcher");
    expect(liveLeagueIdx).toBeGreaterThan(0);
    expect(liveSwitcherIdx).toBeGreaterThan(0);
    expect(liveLeagueIdx).toBeLessThan(liveSwitcherIdx);
  });

  it("renderiza <LiveFinalizedSection> al final (Bug #10, separado del switcher)", () => {
    expect(SRC).toMatch(/<LiveFinalizedSection\s+matches=\{finalizedCards\}/);
  });
});

// ---------------------------------------------------------------------------
// AST: LiveLeagueFilter usa useLigaFilter + Chip primitivo
// ---------------------------------------------------------------------------

describe("LiveLeagueFilter — chips dinámicos basados en ligas presentes", () => {
  const SRC = readSrc("components/live/LiveLeagueFilter.tsx");

  it("importa useLigaFilter del hook compartido", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*useLigaFilter\s*\}\s*from\s*["']@\/hooks\/useLigaFilter["']/,
    );
  });

  it("usa el primitivo Chip del design system", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*Chip\s*\}\s*from\s*["']@\/components\/ui["']/,
    );
  });

  it("rendera nada cuando ligas.length === 0 (no hay partidos live)", () => {
    expect(SRC).toMatch(/if\s*\(\s*ligas\.length\s*===\s*0\s*\)\s*return\s+null/);
  });

  it("tiene un chip 'Todas' con active=null", () => {
    expect(SRC).toMatch(/Todas/);
    expect(SRC).toMatch(/setLiga\s*\(\s*null\s*\)/);
  });

  it("cada chip tiene data-testid='liga-chip-<slug>'", () => {
    expect(SRC).toMatch(/liga-chip-/);
  });
});

describe("useLigaFilter — hook de filtro por liga (Bug #11)", () => {
  const SRC = readSrc("hooks/useLigaFilter.ts");

  it("declara 'use client'", () => {
    expect(SRC).toMatch(/^\s*["']use client["']/);
  });

  it("lee ?liga= de useSearchParams", () => {
    expect(SRC).toMatch(/params\.get\s*\(\s*["']liga["']\s*\)/);
  });

  it("setLiga con null remueve el query param (vuelve a 'Todas')", () => {
    expect(SRC).toMatch(/next\.delete\s*\(\s*["']liga["']\s*\)/);
  });

  it("usa router.replace con scroll: false (no jump al top al filtrar)", () => {
    expect(SRC).toMatch(/router\.replace.*scroll:\s*false/);
  });
});

// ---------------------------------------------------------------------------
// AST: LiveFinalizedSection (Bug #10)
// ---------------------------------------------------------------------------

describe("LiveFinalizedSection — sección separada de finalizados", () => {
  const SRC = readSrc("components/live/LiveFinalizedSection.tsx");

  it("recibe matches: FinalizedMatchCard[]", () => {
    expect(SRC).toMatch(/matches:\s*FinalizedMatchCard\[\]/);
  });

  it("retorna null si la lista viene vacía (no rendera chrome sin contenido)", () => {
    expect(SRC).toMatch(/if\s*\(\s*matches\.length\s*===\s*0\s*\)\s*return\s+null/);
  });

  it("cada card linkea a /live-match?torneoId=<id>", () => {
    expect(SRC).toMatch(/\/live-match\?torneoId=/);
  });

  it("tiene section-bar con copy 'Partidos finalizados'", () => {
    expect(SRC).toMatch(/Partidos finalizados/);
  });

  it("cada card tiene data-testid='finalized-card-<partidoId>'", () => {
    expect(SRC).toMatch(/finalized-card-/);
  });

  it("usa getTeamColor para los avatares de equipo (consistencia con /matches)", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*getTeamColor\s*\}\s*from\s*["']@\/lib\/utils\/team-colors["']/,
    );
  });
});

// ---------------------------------------------------------------------------
// AST: service expone obtenerFinalizedMatches (Bug #10)
// ---------------------------------------------------------------------------

describe("live-matches.service — obtenerFinalizedMatches (Bug #10)", () => {
  const SRC = readSrc("lib/services/live-matches.service.ts");

  it("exporta obtenerFinalizedMatches", () => {
    expect(SRC).toMatch(/export\s+async\s+function\s+obtenerFinalizedMatches/);
  });

  it("filtra por estado=FINALIZADO + fechaInicio >= since", () => {
    expect(SRC).toMatch(/estado:\s*["']FINALIZADO["']/);
    expect(SRC).toMatch(/fechaInicio:\s*\{\s*gte:/);
  });

  it("mantiene el filtro 'torneos.some(estado != CANCELADO)' (Bug #8)", () => {
    expect(SRC).toMatch(
      /torneos:\s*\{\s*some:\s*\{\s*estado:\s*\{\s*not:\s*["']CANCELADO["']/,
    );
  });

  it("ordena por fechaInicio DESC (últimos primero)", () => {
    expect(SRC).toMatch(/orderBy:\s*\{\s*fechaInicio:\s*["']desc["']\s*\}/);
  });
});
