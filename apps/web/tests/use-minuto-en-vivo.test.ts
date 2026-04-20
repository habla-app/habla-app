// Tests del Hotfix #8 Bug #22 — reloj local del minuto del partido.
//
// Cobertura:
//   1. `computeElapsedLocal` puro: matriz de casos por status (avanzable
//      vs fijo), null-inputs, cap por status, respeto al server cuando
//      ya superó el cap.
//   2. AST sobre `useMinutoEnVivo.ts`: contrato del hook (use client,
//      interval 1s, cleanup, reset por snapshot, fallback delegate).
//   3. AST sobre wiring: RankingUpdatePayload incluye statusShort +
//      snapshotUpdatedAt; endpoints REST los devuelven; LiveHero acepta
//      las nuevas props; LiveMatchView las propaga.
//
// Vitest corre en env "node" sin jsdom — el hook en sí no se render-
// tests; la lógica vive en la función pura `computeElapsedLocal`, que
// es donde está el riesgo.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeElapsedLocal } from "../hooks/useMinutoEnVivo";

const ROOT = resolve(__dirname, "..");

function readSrc(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

// ---------------------------------------------------------------------------
// computeElapsedLocal — función pura
// ---------------------------------------------------------------------------

describe("computeElapsedLocal — statuses avanzables (1H/2H/ET)", () => {
  it("1H minuto 10 + 60s reales → minuto 11", () => {
    const snapshotAt = 1_700_000_000_000;
    const now = snapshotAt + 60_000; // +1 min
    expect(
      computeElapsedLocal({
        statusShort: "1H",
        elapsed: 10,
        snapshotUpdatedAt: snapshotAt,
        now,
      }),
    ).toBe(11);
  });

  it("1H minuto 10 + 30s reales → sigue en 10 (minutos enteros)", () => {
    const snapshotAt = 1_700_000_000_000;
    const now = snapshotAt + 30_000; // +30s (<1 min)
    expect(
      computeElapsedLocal({
        statusShort: "1H",
        elapsed: 10,
        snapshotUpdatedAt: snapshotAt,
        now,
      }),
    ).toBe(10);
  });

  it("2H minuto 67 + 180s reales → minuto 70", () => {
    const snapshotAt = 1_700_000_000_000;
    const now = snapshotAt + 3 * 60_000;
    expect(
      computeElapsedLocal({
        statusShort: "2H",
        elapsed: 67,
        snapshotUpdatedAt: snapshotAt,
        now,
      }),
    ).toBe(70);
  });

  it("ET minuto 95 + 60s reales → minuto 96", () => {
    const snapshotAt = 1_700_000_000_000;
    const now = snapshotAt + 60_000;
    expect(
      computeElapsedLocal({
        statusShort: "ET",
        elapsed: 95,
        snapshotUpdatedAt: snapshotAt,
        now,
      }),
    ).toBe(96);
  });
});

describe("computeElapsedLocal — cap por status", () => {
  it("1H cap en 45: minuto 44 + 10 min → 45, no 54", () => {
    const snapshotAt = 1_700_000_000_000;
    const now = snapshotAt + 10 * 60_000;
    expect(
      computeElapsedLocal({
        statusShort: "1H",
        elapsed: 44,
        snapshotUpdatedAt: snapshotAt,
        now,
      }),
    ).toBe(45);
  });

  it("2H cap en 90: minuto 89 + 5 min → 90, no 94", () => {
    const snapshotAt = 1_700_000_000_000;
    const now = snapshotAt + 5 * 60_000;
    expect(
      computeElapsedLocal({
        statusShort: "2H",
        elapsed: 89,
        snapshotUpdatedAt: snapshotAt,
        now,
      }),
    ).toBe(90);
  });

  it("1H server ya superó cap (elapsed=48 por descuento) → respeta server", () => {
    // El server puede reportar 1H con elapsed > 45 durante el descuento
    // del PT. No revertimos ese número.
    const snapshotAt = 1_700_000_000_000;
    const now = snapshotAt + 60_000;
    expect(
      computeElapsedLocal({
        statusShort: "1H",
        elapsed: 48,
        snapshotUpdatedAt: snapshotAt,
        now,
      }),
    ).toBe(48);
  });

  it("ET cap en 120: minuto 119 + 10 min → 120", () => {
    const snapshotAt = 1_700_000_000_000;
    const now = snapshotAt + 10 * 60_000;
    expect(
      computeElapsedLocal({
        statusShort: "ET",
        elapsed: 119,
        snapshotUpdatedAt: snapshotAt,
        now,
      }),
    ).toBe(120);
  });
});

describe("computeElapsedLocal — statuses fijos (HT/FT/PEN/NS/...)", () => {
  it("HT → elapsed crudo (no avanza)", () => {
    const snapshotAt = 1_700_000_000_000;
    const now = snapshotAt + 10 * 60_000;
    expect(
      computeElapsedLocal({
        statusShort: "HT",
        elapsed: 45,
        snapshotUpdatedAt: snapshotAt,
        now,
      }),
    ).toBe(45);
  });

  it("FT → elapsed crudo", () => {
    expect(
      computeElapsedLocal({
        statusShort: "FT",
        elapsed: 90,
        snapshotUpdatedAt: 0,
        now: 9999999,
      }),
    ).toBe(90);
  });

  it("NS → elapsed crudo (null)", () => {
    expect(
      computeElapsedLocal({
        statusShort: "NS",
        elapsed: null,
        snapshotUpdatedAt: 1,
        now: 2,
      }),
    ).toBe(null);
  });

  it("PEN → elapsed crudo", () => {
    expect(
      computeElapsedLocal({
        statusShort: "PEN",
        elapsed: 120,
        snapshotUpdatedAt: 0,
        now: 9999999,
      }),
    ).toBe(120);
  });
});

describe("computeElapsedLocal — casos degenerados", () => {
  it("statusShort null → elapsed crudo", () => {
    expect(
      computeElapsedLocal({
        statusShort: null,
        elapsed: 20,
        snapshotUpdatedAt: 0,
        now: 9999999,
      }),
    ).toBe(20);
  });

  it("elapsed null → null (no hay de dónde partir)", () => {
    expect(
      computeElapsedLocal({
        statusShort: "1H",
        elapsed: null,
        snapshotUpdatedAt: 0,
        now: 9999999,
      }),
    ).toBe(null);
  });

  it("snapshotUpdatedAt null → elapsed crudo (no podemos anclar)", () => {
    expect(
      computeElapsedLocal({
        statusShort: "1H",
        elapsed: 20,
        snapshotUpdatedAt: null,
        now: 9999999,
      }),
    ).toBe(20);
  });

  it("now < snapshotUpdatedAt (clock skew) → no retrocede, clampa a 0 delta", () => {
    const snapshotAt = 1_700_000_000_000;
    const now = snapshotAt - 10_000; // 10s antes (skew)
    expect(
      computeElapsedLocal({
        statusShort: "1H",
        elapsed: 30,
        snapshotUpdatedAt: snapshotAt,
        now,
      }),
    ).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// useMinutoEnVivo — AST del hook
// ---------------------------------------------------------------------------

describe("useMinutoEnVivo — contrato", () => {
  const SRC = readSrc("hooks/useMinutoEnVivo.ts");

  it('es client component ("use client")', () => {
    expect(SRC).toMatch(/^["']use client["'];/m);
  });

  it("exporta `useMinutoEnVivo` como función", () => {
    expect(SRC).toMatch(/export\s+function\s+useMinutoEnVivo\b/);
  });

  it("exporta `computeElapsedLocal` como función pura testeable", () => {
    expect(SRC).toMatch(/export\s+function\s+computeElapsedLocal\b/);
  });

  it("usa setInterval de 1000ms (reloj segundo a segundo)", () => {
    expect(SRC).toMatch(/setInterval\([\s\S]*?,\s*1000\s*\)/);
  });

  it("limpia el interval en cleanup del useEffect", () => {
    expect(SRC).toMatch(/return\s*\(\)\s*=>\s*clearInterval\(\s*id\s*\)/);
  });

  it("delega al mapper formatMinutoLabel para derivar el string", () => {
    expect(SRC).toMatch(/formatMinutoLabel\(/);
  });

  it("usa renderMinutoLabel como fallback para labels null", () => {
    expect(SRC).toMatch(/renderMinutoLabel\(/);
  });

  it("los statuses avanzables son 1H, 2H y ET", () => {
    expect(SRC).toMatch(/STATUSES_AVANZANDO/);
    expect(SRC).toMatch(/["']1H["']/);
    expect(SRC).toMatch(/["']2H["']/);
    expect(SRC).toMatch(/["']ET["']/);
  });

  it("aplica cap por status (45/90/120)", () => {
    expect(SRC).toMatch(/CAP_POR_STATUS/);
    expect(SRC).toMatch(/["']1H["']\s*:\s*45/);
    expect(SRC).toMatch(/["']2H["']\s*:\s*90/);
    expect(SRC).toMatch(/ET\s*:\s*120/);
  });

  it("la dependencia del effect incluye snapshotUpdatedAt (reset por snapshot nuevo)", () => {
    // Sin snapshotUpdatedAt en deps, el reloj no se re-ancla al llegar
    // un snapshot nuevo del poller.
    expect(SRC).toMatch(
      /\[\s*statusShort\s*,\s*elapsed\s*,\s*snapshotUpdatedAt\s*,\s*esAvanzable\s*\]/,
    );
  });
});

// ---------------------------------------------------------------------------
// Wiring — payload + endpoints + LiveHero
// ---------------------------------------------------------------------------

describe("RankingUpdatePayload — nuevos campos (Hotfix #8 Bug #22)", () => {
  const SRC = readSrc("lib/realtime/events.ts");

  it("incluye `statusShort: string | null`", () => {
    expect(SRC).toMatch(/statusShort\s*:\s*string\s*\|\s*null/);
  });

  it("incluye `snapshotUpdatedAt: number | null`", () => {
    expect(SRC).toMatch(/snapshotUpdatedAt\s*:\s*number\s*\|\s*null/);
  });
});

describe("emitirRankingUpdate — propaga statusShort + snapshotUpdatedAt", () => {
  const SRC = readSrc("lib/realtime/emitters.ts");

  it("lee statusShort del snapshot del cache", () => {
    // Derivado como `const statusShort = snapshot?.statusShort ?? null`.
    expect(SRC).toMatch(/statusShort\s*=\s*snapshot\?\.statusShort/);
  });

  it("lee updatedAt del snapshot del cache", () => {
    // Derivado como `const snapshotUpdatedAt = snapshot?.updatedAt ?? null`.
    expect(SRC).toMatch(/snapshotUpdatedAt\s*=\s*snapshot\?\.updatedAt/);
  });

  it("incluye ambos en el payload emitido", () => {
    expect(SRC).toMatch(/statusShort\s*,/);
    expect(SRC).toMatch(/snapshotUpdatedAt\s*,/);
  });
});

describe("GET /api/v1/torneos/:id/ranking — expone statusShort + snapshotUpdatedAt", () => {
  const SRC = readSrc("app/api/v1/torneos/[id]/ranking/route.ts");

  it("agrega statusShort al response", () => {
    expect(SRC).toMatch(/statusShort\s*:/);
  });

  it("agrega snapshotUpdatedAt al response", () => {
    expect(SRC).toMatch(/snapshotUpdatedAt\s*:/);
  });
});

describe("GET /api/v1/live/matches — expone statusShort + snapshotUpdatedAt", () => {
  const SRC = readSrc("app/api/v1/live/matches/route.ts");

  it("incluye ambos en el payload del partido", () => {
    expect(SRC).toMatch(/statusShort\s*:/);
    expect(SRC).toMatch(/snapshotUpdatedAt\s*:/);
  });
});

describe("LiveHero — consume useMinutoEnVivo en vez de renderMinutoLabel directo", () => {
  const SRC = readSrc("components/live/LiveHero.tsx");

  it('es client component ("use client")', () => {
    expect(SRC).toMatch(/^["']use client["'];/m);
  });

  it("importa useMinutoEnVivo", () => {
    expect(SRC).toMatch(
      /import\s*\{[^}]*useMinutoEnVivo[^}]*\}\s*from\s*["']@\/hooks\/useMinutoEnVivo["']/,
    );
  });

  it("acepta props statusShort + elapsed + snapshotUpdatedAt", () => {
    expect(SRC).toMatch(/statusShort\s*:\s*string\s*\|\s*null/);
    expect(SRC).toMatch(/elapsed\s*:\s*number\s*\|\s*null/);
    expect(SRC).toMatch(/snapshotUpdatedAt\s*:\s*number\s*\|\s*null/);
  });

  it("invoca useMinutoEnVivo con los 4 campos", () => {
    expect(SRC).toMatch(
      /useMinutoEnVivo\(\s*\{[\s\S]*?statusShort[\s\S]*?elapsed[\s\S]*?snapshotUpdatedAt[\s\S]*?fallbackLabel[\s\S]*?\}\s*\)/,
    );
  });

  it("ya NO llama renderMinutoLabel directo (el hook lo resuelve)", () => {
    expect(SRC).not.toMatch(/renderMinutoLabel\(/);
  });

  it("preserva data-testid='live-minute-label' (no regresión del Bug #9)", () => {
    expect(SRC).toMatch(/data-testid=["']live-minute-label["']/);
  });
});

describe("LiveMatchView — propaga statusShort/elapsed/snapshotUpdatedAt al LiveHero", () => {
  const SRC = readSrc("components/live/LiveMatchView.tsx");

  it("LiveMatchTab tiene los 3 nuevos campos", () => {
    expect(SRC).toMatch(/statusShort\s*:\s*string\s*\|\s*null/);
    expect(SRC).toMatch(/elapsed\s*:\s*number\s*\|\s*null/);
    expect(SRC).toMatch(/snapshotUpdatedAt\s*:\s*number\s*\|\s*null/);
  });

  it("pasa statusShort={live.statusShort ?? active.statusShort}", () => {
    expect(SRC).toMatch(/statusShort=\{live\.statusShort\s*\?\?\s*active\.statusShort\}/);
  });

  it("pasa elapsed con preferencia del WS + fallback al SSR", () => {
    expect(SRC).toMatch(/elapsed=\{live\.minutoPartido\s*\?\?\s*active\.elapsed\}/);
  });

  it("pasa snapshotUpdatedAt con el mismo patrón WS-preferido", () => {
    expect(SRC).toMatch(
      /snapshotUpdatedAt=\{[\s\S]*?live\.snapshotUpdatedAt\s*\?\?\s*active\.snapshotUpdatedAt[\s\S]*?\}/,
    );
  });
});

describe("useRankingEnVivo — expone statusShort + snapshotUpdatedAt", () => {
  const SRC = readSrc("hooks/useRankingEnVivo.ts");

  it("RankingSnapshot declara ambos campos", () => {
    expect(SRC).toMatch(/statusShort\s*:\s*string\s*\|\s*null/);
    expect(SRC).toMatch(/snapshotUpdatedAt\s*:\s*number\s*\|\s*null/);
  });

  it("onUpdate copia del payload al state", () => {
    expect(SRC).toMatch(/statusShort\s*:\s*payload\.statusShort/);
    expect(SRC).toMatch(/snapshotUpdatedAt\s*:\s*payload\.snapshotUpdatedAt/);
  });

  it("applySnapshot preserva null para no perder el ancla entre polls", () => {
    // Si el REST devuelve statusShort=null (cache stale), NO queremos
    // borrar el valor del WS previo — preservar con ?? s.statusShort.
    expect(SRC).toMatch(/statusShort\s*:\s*d\.statusShort\s*\?\?\s*s\.statusShort/);
    expect(SRC).toMatch(
      /snapshotUpdatedAt\s*:\s*d\.snapshotUpdatedAt\s*\?\?\s*s\.snapshotUpdatedAt/,
    );
  });
});

describe("/live-match page.tsx — SSR rellena los tabs con el snapshot", () => {
  const SRC = readSrc("app/(main)/live-match/page.tsx");

  it("buildLiveTabs asigna statusShort del cache", () => {
    expect(SRC).toMatch(/statusShort\s*:\s*snap\?\.statusShort/);
  });

  it("buildLiveTabs asigna elapsed del cache (snap.minuto)", () => {
    expect(SRC).toMatch(/elapsed\s*:\s*snap\?\.minuto/);
  });

  it("buildLiveTabs asigna snapshotUpdatedAt del cache", () => {
    expect(SRC).toMatch(/snapshotUpdatedAt\s*:\s*snap\?\.updatedAt/);
  });
});
