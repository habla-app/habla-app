// Tests del Hotfix #8 Ítem 4 — reloj local del minuto con elapsedAgeMs.
//
// La evolución del fix:
//   1. Primera versión: snapshotUpdatedAt timestamp absoluto (clock skew).
//   2. Segunda: fechaInicio + heurística de HT fijo (desfase reportado PO).
//   3. Tercera (esta): elapsedAgeMs calculado server-side (inmune a skew
//      y refleja edad real del snapshot en el cache).
//
// Cobertura:
//   1. `computeMinutoLabel` puro: matriz por fase (1H/2H/ET avanzan desde
//      elapsed, HT/FT/PEN/... fijos, elapsed>=cap respeta server, sin
//      statusShort → "—" honesto sin heurística).
//   2. AST sobre `useMinutoEnVivo.ts`: contrato del hook (use client,
//      interval 1s, cleanup, useRef para elapsedAnchorAt, reset al
//      cambiar elapsed/statusShort/elapsedAgeMs, NO usa fechaInicio).
//   3. AST sobre wiring: RankingUpdatePayload + endpoints REST + SSR +
//      LiveHero + useRankingEnVivo propagan elapsedAgeMs.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeMinutoLabel } from "../hooks/useMinutoEnVivo";

const ROOT = resolve(__dirname, "..");

function readSrc(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function readSrcNoComments(rel: string): string {
  const raw = readSrc(rel);
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// ---------------------------------------------------------------------------
// computeMinutoLabel — función pura
// ---------------------------------------------------------------------------

describe("computeMinutoLabel — BUG REPRO del PO", () => {
  it("elapsed=54 con age=5000ms (snap fresco) + 60s local → 55", () => {
    // Caso canónico: el snap es fresco (5s de edad cuando llegó al cliente),
    // y pasaron 60s locales desde el mount. Minuto real: 55.
    const snapshotCapturedAt = Date.now() - 5_000 - 60_000; // hace 65s total
    const elapsedAnchorAt = snapshotCapturedAt; // cliente usó elapsedAgeMs
    expect(
      computeMinutoLabel({
        statusShort: "2H",
        elapsed: 54,
        elapsedAnchorAt,
        now: Date.now(),
      }),
    ).toBe("55'");
  });

  it("elapsed=54 con age=5min (snap stale cache) → 59 (no 54)", () => {
    // Escenario exacto del PO: abre la pestaña, el cache tiene snap de
    // hace 5 min con elapsed=54. El server manda elapsedAgeMs=300000.
    // El cliente anchora correctamente → muestra 59 (que es el minuto
    // real del partido, no 54 que es el valor del cache).
    const snapshotCapturedAt = Date.now() - 5 * 60_000; // hace 5 min
    const elapsedAnchorAt = snapshotCapturedAt;
    expect(
      computeMinutoLabel({
        statusShort: "2H",
        elapsed: 54,
        elapsedAnchorAt,
        now: Date.now(),
      }),
    ).toBe("59'");
  });

  it("sin elapsedAgeMs (anchor=now) produce resultado sin proyección", () => {
    // Si el cliente NO usa elapsedAgeMs (el bug antes del Ítem 4),
    // elapsedAnchorAt=now → delta=0 → muestra elapsed crudo.
    // Documenta el comportamiento ANTES del fix.
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "2H",
        elapsed: 54,
        elapsedAnchorAt: now,
        now,
      }),
    ).toBe("54'");
  });
});

describe("computeMinutoLabel — 1H avanza desde elapsed del server", () => {
  it("1H elapsed=10 + 60s → 11", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "1H",
        elapsed: 10,
        elapsedAnchorAt: now - 60_000,
        now,
      }),
    ).toBe("11'");
  });

  it("1H elapsed=10 + 30s (delta<60s) → 10", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "1H",
        elapsed: 10,
        elapsedAnchorAt: now - 30_000,
        now,
      }),
    ).toBe("10'");
  });

  it("1H elapsed=44 + 5 min → clamp en 45", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "1H",
        elapsed: 44,
        elapsedAnchorAt: now - 5 * 60_000,
        now,
      }),
    ).toBe("45'");
  });

  it("1H elapsed=48 (descuento largo del PT) → respeta server sin proyectar", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "1H",
        elapsed: 48,
        elapsedAnchorAt: now - 60_000,
        now,
      }),
    ).toBe("48'");
  });
});

describe("computeMinutoLabel — 2H y ET", () => {
  it("2H elapsed=55 + 60s → 56", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "2H",
        elapsed: 55,
        elapsedAnchorAt: now - 60_000,
        now,
      }),
    ).toBe("56'");
  });

  it("2H elapsed=89 + 5 min → clamp en 90", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "2H",
        elapsed: 89,
        elapsedAnchorAt: now - 5 * 60_000,
        now,
      }),
    ).toBe("90'");
  });

  it("2H elapsed=94 (descuento largo) → respeta server", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "2H",
        elapsed: 94,
        elapsedAnchorAt: now - 60_000,
        now,
      }),
    ).toBe("94'");
  });

  it("ET elapsed=95 + 60s → 'Prór. 96'", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "ET",
        elapsed: 95,
        elapsedAnchorAt: now - 60_000,
        now,
      }),
    ).toBe("Prór. 96'");
  });
});

describe("computeMinutoLabel — estados fijos (sin proyección)", () => {
  it("HT → 'ENT'", () => {
    expect(
      computeMinutoLabel({
        statusShort: "HT",
        elapsed: 45,
        elapsedAnchorAt: 0,
        now: Date.now(),
      }),
    ).toBe("ENT");
  });

  it("FT → 'FIN'", () => {
    expect(
      computeMinutoLabel({
        statusShort: "FT",
        elapsed: 90,
        elapsedAnchorAt: 0,
        now: Date.now(),
      }),
    ).toBe("FIN");
  });

  it("AET → 'FIN (prór.)'", () => {
    expect(
      computeMinutoLabel({
        statusShort: "AET",
        elapsed: 120,
        elapsedAnchorAt: 0,
        now: Date.now(),
      }),
    ).toBe("FIN (prór.)");
  });

  it("PEN → 'FIN (pen.)'", () => {
    expect(
      computeMinutoLabel({
        statusShort: "PEN",
        elapsed: 120,
        elapsedAnchorAt: 0,
        now: Date.now(),
      }),
    ).toBe("FIN (pen.)");
  });

  it("NS → 'Por empezar'", () => {
    expect(
      computeMinutoLabel({
        statusShort: "NS",
        elapsed: null,
        elapsedAnchorAt: 0,
        now: Date.now(),
      }),
    ).toBe("Por empezar");
  });

  it("SUSP → 'Suspendido'", () => {
    expect(
      computeMinutoLabel({
        statusShort: "SUSP",
        elapsed: 30,
        elapsedAnchorAt: 0,
        now: Date.now(),
      }),
    ).toBe("Suspendido");
  });
});

describe("computeMinutoLabel — sin datos del server", () => {
  it("statusShort null → '—' (NO heurística, ser honesto)", () => {
    expect(
      computeMinutoLabel({
        statusShort: null,
        elapsed: null,
        elapsedAnchorAt: 0,
        now: Date.now(),
      }),
    ).toBe("—");
  });

  it("statusShort null con elapsed — igual '—' (sin fase no adivinamos)", () => {
    expect(
      computeMinutoLabel({
        statusShort: null,
        elapsed: 30,
        elapsedAnchorAt: 0,
        now: Date.now(),
      }),
    ).toBe("—");
  });

  it("1H con elapsed null → '1T' (mapper fallback, no heurística)", () => {
    expect(
      computeMinutoLabel({
        statusShort: "1H",
        elapsed: null,
        elapsedAnchorAt: 0,
        now: Date.now(),
      }),
    ).toBe("1T");
  });

  it("2H con elapsed null → '2T' (mapper fallback)", () => {
    expect(
      computeMinutoLabel({
        statusShort: "2H",
        elapsed: null,
        elapsedAnchorAt: 0,
        now: Date.now(),
      }),
    ).toBe("2T");
  });

  it("ET con elapsed null → 'Prórroga'", () => {
    expect(
      computeMinutoLabel({
        statusShort: "ET",
        elapsed: null,
        elapsedAnchorAt: 0,
        now: Date.now(),
      }),
    ).toBe("Prórroga");
  });
});

// ---------------------------------------------------------------------------
// useMinutoEnVivo — AST del hook
// ---------------------------------------------------------------------------

describe("useMinutoEnVivo — contrato del hook (Ítem 4)", () => {
  const SRC = readSrc("hooks/useMinutoEnVivo.ts");
  const SRC_NO_COMMENTS = readSrcNoComments("hooks/useMinutoEnVivo.ts");

  it('es client component ("use client")', () => {
    expect(SRC).toMatch(/^["']use client["'];/m);
  });

  it("exporta `useMinutoEnVivo` como función", () => {
    expect(SRC).toMatch(/export\s+function\s+useMinutoEnVivo\b/);
  });

  it("exporta `computeMinutoLabel` como función pura testeable", () => {
    expect(SRC).toMatch(/export\s+function\s+computeMinutoLabel\b/);
  });

  it("acepta input `elapsedAgeMs: number | null`", () => {
    expect(SRC).toMatch(/elapsedAgeMs\s*:\s*number\s*\|\s*null/);
  });

  it("NO acepta `fechaInicio` (removida en Ítem 4)", () => {
    expect(SRC_NO_COMMENTS).not.toMatch(/fechaInicio/);
  });

  it("anchora elapsedAnchorAt con Date.now() - elapsedAgeMs", () => {
    // Fórmula clave del fix: el cliente deriva el momento REAL del
    // snapshot restando la edad reportada por el server.
    expect(SRC).toMatch(/Date\.now\(\)\s*-\s*elapsedAgeMs/);
  });

  it("usa useRef para trackear el ancla", () => {
    expect(SRC).toMatch(/elapsedAnchorAt\s*=\s*useRef/);
    expect(SRC).toMatch(/prevAgeRef/);
  });

  it("reset del ancla cuando cambia elapsedAgeMs", () => {
    expect(SRC).toMatch(/elapsedAgeMs\s*!==\s*prevAgeRef\.current/);
  });

  it("usa setInterval de 1000ms (reloj segundo a segundo)", () => {
    expect(SRC).toMatch(/setInterval\([\s\S]*?,\s*1_?000\s*\)/);
  });

  it("limpia el interval en cleanup del useEffect", () => {
    expect(SRC).toMatch(/return\s*\(\)\s*=>\s*clearInterval\(\s*id\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// Wiring — payload + endpoints + LiveHero
// ---------------------------------------------------------------------------

describe("RankingUpdatePayload — incluye elapsedAgeMs (Ítem 4)", () => {
  const SRC = readSrc("lib/realtime/events.ts");

  it("tipo tiene `elapsedAgeMs: number | null`", () => {
    expect(SRC).toMatch(/elapsedAgeMs\s*:\s*number\s*\|\s*null/);
  });
});

describe("emitirRankingUpdate — calcula elapsedAgeMs al emit", () => {
  const SRC = readSrc("lib/realtime/emitters.ts");

  it("captura emitAt = Date.now() y lo usa para la age", () => {
    expect(SRC).toMatch(/emitAt\s*=\s*Date\.now\(\)/);
  });

  it("calcula elapsedAgeMs = emitAt - snapshot.updatedAt", () => {
    expect(SRC).toMatch(
      /elapsedAgeMs\s*=\s*snapshot\s*\?\s*emitAt\s*-\s*snapshot\.updatedAt\s*:\s*null/,
    );
  });

  it("incluye elapsedAgeMs en el payload emitido", () => {
    expect(SRC).toMatch(/\belapsedAgeMs\s*,/);
  });
});

describe("GET /api/v1/torneos/:id/ranking — expone elapsedAgeMs", () => {
  const SRC = readSrc("app/api/v1/torneos/[id]/ranking/route.ts");

  it("calcula elapsedAgeMs desde el snap", () => {
    expect(SRC).toMatch(
      /elapsedAgeMs\s*:\s*liveSnap\s*\?\s*now\s*-\s*liveSnap\.updatedAt\s*:\s*null/,
    );
  });
});

describe("GET /api/v1/live/matches — expone elapsedAgeMs", () => {
  const SRC = readSrc("app/api/v1/live/matches/route.ts");

  it("calcula elapsedAgeMs por partido", () => {
    expect(SRC).toMatch(
      /elapsedAgeMs\s*:\s*liveSnap\s*\?\s*nowMs\s*-\s*liveSnap\.updatedAt\s*:\s*null/,
    );
  });
});

describe("LiveHero — consume elapsedAgeMs (no fechaInicio)", () => {
  const SRC = readSrc("components/live/LiveHero.tsx");
  const SRC_NO_COMMENTS = readSrcNoComments("components/live/LiveHero.tsx");

  it('es client component ("use client")', () => {
    expect(SRC).toMatch(/^["']use client["'];/m);
  });

  it("acepta prop `elapsedAgeMs: number | null`", () => {
    expect(SRC).toMatch(/elapsedAgeMs\s*:\s*number\s*\|\s*null/);
  });

  it("NO acepta `fechaInicio` (removida en Ítem 4)", () => {
    // En código activo — los comentarios pueden mencionar la historia.
    expect(SRC_NO_COMMENTS).not.toMatch(/fechaInicio/);
  });

  it("invoca useMinutoEnVivo con los 3 campos {statusShort, elapsed, elapsedAgeMs}", () => {
    expect(SRC).toMatch(
      /useMinutoEnVivo\(\s*\{[\s\S]*?statusShort[\s\S]*?elapsed[\s\S]*?elapsedAgeMs[\s\S]*?\}\s*\)/,
    );
  });

  it("preserva data-testid='live-minute-label' (no regresión del Bug #9)", () => {
    expect(SRC).toMatch(/data-testid=["']live-minute-label["']/);
  });
});

describe("LiveMatchView — propaga elapsedAgeMs al LiveHero", () => {
  const SRC = readSrc("components/live/LiveMatchView.tsx");

  it("LiveMatchTab declara elapsedAgeMs: number | null", () => {
    expect(SRC).toMatch(/elapsedAgeMs\s*:\s*number\s*\|\s*null/);
  });

  it("pasa elapsedAgeMs={live ?? active} al LiveHero", () => {
    expect(SRC).toMatch(
      /elapsedAgeMs=\{live\.elapsedAgeMs\s*\?\?\s*active\.elapsedAgeMs\}/,
    );
  });

  it("NO pasa fechaInicio al LiveHero (removida del hero)", () => {
    // El LiveMatchTab aún tiene fechaInicio para metadata general (puede
    // ser útil para banners pre-live en el futuro), pero LiveHero ya
    // no la recibe.
    expect(SRC).not.toMatch(/fechaInicio=\{active\.fechaInicio\}/);
  });
});

describe("useRankingEnVivo — expone elapsedAgeMs en el snapshot", () => {
  const SRC = readSrc("hooks/useRankingEnVivo.ts");

  it("RankingSnapshot declara elapsedAgeMs: number | null", () => {
    expect(SRC).toMatch(/elapsedAgeMs\s*:\s*number\s*\|\s*null/);
  });

  it("onUpdate del WS pisa elapsedAgeMs crudo del payload", () => {
    expect(SRC).toMatch(/elapsedAgeMs\s*:\s*payload\.elapsedAgeMs/);
  });

  it("applySnapshot preserva elapsedAgeMs undefined → valor anterior", () => {
    expect(SRC).toMatch(
      /elapsedAgeMs\s*:[\s\S]*?d\.elapsedAgeMs\s*!==\s*undefined[\s\S]*?s\.elapsedAgeMs/,
    );
  });
});

describe("/live-match page.tsx — SSR calcula elapsedAgeMs", () => {
  const SRC = readSrc("app/(main)/live-match/page.tsx");

  it("buildLiveTabs asigna elapsedAgeMs = nowMs - snap.updatedAt", () => {
    expect(SRC).toMatch(
      /elapsedAgeMs\s*:\s*snap\s*\?\s*nowMs\s*-\s*snap\.updatedAt\s*:\s*null/,
    );
  });
});
