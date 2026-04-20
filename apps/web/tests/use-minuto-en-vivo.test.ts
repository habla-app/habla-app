// Tests del Hotfix #8 Bug #22 — reloj local del minuto del partido.
// Refactor simplificado (post-feedback del PO): usar `Partido.fechaInicio`
// como ancla permanente en vez de `snapshotUpdatedAt` del cache.
//
// Cobertura:
//   1. `computeMinutoLabel` puro: matriz de casos por status (1H con
//      fechaInicio como ancla; 2H/ET con elapsed server + anchor; fases
//      fijas HT/FT/PEN/NS; heurística cuando statusShort es null).
//   2. AST sobre `useMinutoEnVivo.ts`: contrato del hook (use client,
//      interval 1s, cleanup, ref que trackea cambios de elapsed/status,
//      exporta `computeMinutoLabel`).
//   3. AST sobre wiring: RankingUpdatePayload SIN snapshotUpdatedAt;
//      endpoints REST SIN snapshotUpdatedAt; LiveHero acepta fechaInicio
//      como prop; LiveMatchView + SSR lo propagan.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeMinutoLabel } from "../hooks/useMinutoEnVivo";

const ROOT = resolve(__dirname, "..");

function readSrc(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

/** Lee un archivo stripping block y line comments para que los tests
 *  "NO contiene X" no choquen con menciones históricas en comentarios. */
function readSrcNoComments(rel: string): string {
  const raw = readSrc(rel);
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// ---------------------------------------------------------------------------
// computeMinutoLabel — función pura
// ---------------------------------------------------------------------------

describe("computeMinutoLabel — 1H con elapsed del server (fuente de verdad)", () => {
  const kickoff = new Date("2026-04-19T20:00:00.000Z").getTime();

  it("server dice elapsed=20 recibido hace 60s → '21' (server-anclado, no heurística)", () => {
    // Caso real del bug del PO: heurística daría 60 por clock skew, server
    // dice 20. Fix: el server GANA. Heurística solo se usa si elapsed es null.
    const now = Date.now();
    expect(
      computeMinutoLabel({
        fechaInicio: new Date(now - 59 * 60_000), // heurística diría 60'
        statusShort: "1H",
        elapsed: 20,
        elapsedAnchorAt: now - 60_000,
        now,
      }),
    ).toBe("21'");
  });

  it("server dice elapsed=10 recibido hace 30s → '10' (delta <60s se redondea a 0)", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        fechaInicio: new Date(now - 11 * 60_000), // heurística diría 12'
        statusShort: "1H",
        elapsed: 10,
        elapsedAnchorAt: now - 30_000,
        now,
      }),
    ).toBe("10'");
  });

  it("server dice elapsed=48 (descuento largo del PT) → respeta sin clamp", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        fechaInicio: new Date(now - 45 * 60_000),
        statusShort: "1H",
        elapsed: 48,
        elapsedAnchorAt: now - 5_000,
        now,
      }),
    ).toBe("48'");
  });

  it("server dice elapsed=44 + 3 min local → clamp en 45", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        fechaInicio: new Date(now - 44 * 60_000),
        statusShort: "1H",
        elapsed: 44,
        elapsedAnchorAt: now - 3 * 60_000,
        now,
      }),
    ).toBe("45'");
  });

  it("server dice elapsed=15 aunque heurística diría 50 → server gana (15 + delta)", () => {
    // El bug del PO era el opuesto: heurística pisaba server con max().
    // Ahora: server=15 hace 5s → 15'. Punto.
    const now = Date.now();
    expect(
      computeMinutoLabel({
        fechaInicio: new Date(now - 50 * 60_000),
        statusShort: "1H",
        elapsed: 15,
        elapsedAnchorAt: now - 5_000,
        now,
      }),
    ).toBe("15'");
  });
});

describe("computeMinutoLabel — 1H sin elapsed (heurística por fechaInicio)", () => {
  const kickoff = new Date("2026-04-19T20:00:00.000Z").getTime();

  it("10 min desde kickoff, elapsed=null → '11' (heurística)", () => {
    const now = kickoff + 10 * 60_000;
    expect(
      computeMinutoLabel({
        fechaInicio: new Date(kickoff),
        statusShort: "1H",
        elapsed: null,
        elapsedAnchorAt: kickoff,
        now,
      }),
    ).toBe("11'");
  });

  it("30s desde kickoff, elapsed=null → '1'", () => {
    const now = kickoff + 30_000;
    expect(
      computeMinutoLabel({
        fechaInicio: new Date(kickoff),
        statusShort: "1H",
        elapsed: null,
        elapsedAnchorAt: kickoff,
        now,
      }),
    ).toBe("1'");
  });

  it("10 min antes del kickoff, elapsed=null → '1' (clamp en 1)", () => {
    const now = kickoff - 10 * 60_000;
    expect(
      computeMinutoLabel({
        fechaInicio: new Date(kickoff),
        statusShort: "1H",
        elapsed: null,
        elapsedAnchorAt: kickoff,
        now,
      }),
    ).toBe("1'");
  });

  it("60 min desde kickoff, elapsed=null → '45' (clamp)", () => {
    const now = kickoff + 60 * 60_000;
    expect(
      computeMinutoLabel({
        fechaInicio: new Date(kickoff),
        statusShort: "1H",
        elapsed: null,
        elapsedAnchorAt: kickoff,
        now,
      }),
    ).toBe("45'");
  });

  it("fechaInicio como string ISO funciona igual que Date", () => {
    const iso = new Date(kickoff).toISOString();
    const now = kickoff + 15 * 60_000;
    expect(
      computeMinutoLabel({
        fechaInicio: iso,
        statusShort: "1H",
        elapsed: null,
        elapsedAnchorAt: kickoff,
        now,
      }),
    ).toBe("16'");
  });
});

describe("computeMinutoLabel — 2H ancla al elapsed del server", () => {
  const kickoff = new Date("2026-04-19T20:00:00.000Z").getTime();

  it("BUG REPRO PO: partido real minuto 54 + heurística desalineada → muestra 54, no 59", () => {
    // Cienciano vs UCV Moquegua: el PO reportó que el hero mostraba 59'
    // cuando el partido real iba 54'. Antes del fix, la heurística de
    // fechaInicio pisaba al server con `max()`. Ahora el server gana.
    const now = Date.now();
    expect(
      computeMinutoLabel({
        fechaInicio: new Date(now - 73 * 60_000), // heurística 2T diría "59'"
        statusShort: "2H",
        elapsed: 54,
        elapsedAnchorAt: now - 5_000, // recién recibido del server
        now,
      }),
    ).toBe("54'");
  });

  it("2H con elapsed=55 anclado hace 60s → '56'", () => {
    const recibidoHace60s = Date.now() - 60_000;
    expect(
      computeMinutoLabel({
        fechaInicio: new Date(kickoff),
        statusShort: "2H",
        elapsed: 55,
        elapsedAnchorAt: recibidoHace60s,
        now: Date.now(),
      }),
    ).toBe("56'");
  });

  it("2H con elapsed=89 + 5 min → clamp en 90", () => {
    const recibidoHace5Min = Date.now() - 5 * 60_000;
    expect(
      computeMinutoLabel({
        fechaInicio: new Date(kickoff),
        statusShort: "2H",
        elapsed: 89,
        elapsedAnchorAt: recibidoHace5Min,
        now: Date.now(),
      }),
    ).toBe("90'");
  });

  it("2H con elapsed=94 (descuento largo reportado por server) → respeta server", () => {
    expect(
      computeMinutoLabel({
        fechaInicio: new Date(kickoff),
        statusShort: "2H",
        elapsed: 94,
        elapsedAnchorAt: Date.now() - 5_000,
        now: Date.now(),
      }),
    ).toBe("94'");
  });

  it("2H sin elapsed del server → fallback '2T'", () => {
    expect(
      computeMinutoLabel({
        fechaInicio: new Date(kickoff),
        statusShort: "2H",
        elapsed: null,
        elapsedAnchorAt: 0,
        now: Date.now(),
      }),
    ).toBe("2T");
  });
});

describe("computeMinutoLabel — ET (prórroga)", () => {
  it("ET con elapsed=95 hace 60s → 'Prór. 96'", () => {
    expect(
      computeMinutoLabel({
        fechaInicio: new Date("2026-04-19T20:00:00.000Z"),
        statusShort: "ET",
        elapsed: 95,
        elapsedAnchorAt: Date.now() - 60_000,
        now: Date.now(),
      }),
    ).toBe("Prór. 96'");
  });

  it("ET sin elapsed → 'Prórroga'", () => {
    expect(
      computeMinutoLabel({
        fechaInicio: new Date("2026-04-19T20:00:00.000Z"),
        statusShort: "ET",
        elapsed: null,
        elapsedAnchorAt: 0,
        now: Date.now(),
      }),
    ).toBe("Prórroga");
  });
});

describe("computeMinutoLabel — estados fijos (sin interval)", () => {
  const kickoff = new Date("2026-04-19T20:00:00.000Z").getTime();
  const base = {
    fechaInicio: new Date(kickoff),
    elapsed: null,
    elapsedAnchorAt: 0,
    now: Date.now(),
  };

  it("HT → 'ENT'", () => {
    expect(computeMinutoLabel({ ...base, statusShort: "HT" })).toBe("ENT");
  });
  it("FT → 'FIN'", () => {
    expect(computeMinutoLabel({ ...base, statusShort: "FT" })).toBe("FIN");
  });
  it("AET → 'FIN (prór.)'", () => {
    expect(computeMinutoLabel({ ...base, statusShort: "AET" })).toBe("FIN (prór.)");
  });
  it("PEN → 'FIN (pen.)'", () => {
    expect(computeMinutoLabel({ ...base, statusShort: "PEN" })).toBe("FIN (pen.)");
  });
  it("NS → 'Por empezar'", () => {
    expect(computeMinutoLabel({ ...base, statusShort: "NS" })).toBe("Por empezar");
  });
  it("SUSP → 'Suspendido'", () => {
    expect(computeMinutoLabel({ ...base, statusShort: "SUSP" })).toBe("Suspendido");
  });
});

describe("computeMinutoLabel — heurística sin statusShort (cache vacío)", () => {
  const kickoff = new Date("2026-04-19T20:00:00.000Z").getTime();
  const base = {
    fechaInicio: new Date(kickoff),
    statusShort: null,
    elapsed: null,
    elapsedAnchorAt: 0,
  };

  it("antes del kickoff → 'Por empezar'", () => {
    expect(computeMinutoLabel({ ...base, now: kickoff - 5 * 60_000 })).toBe(
      "Por empezar",
    );
  });

  it("10 min post-kickoff → '11' (estimado del 1T)", () => {
    expect(computeMinutoLabel({ ...base, now: kickoff + 10 * 60_000 })).toBe(
      "11'",
    );
  });

  it("50 min post-kickoff → 'ENT' (estimado del HT)", () => {
    expect(computeMinutoLabel({ ...base, now: kickoff + 50 * 60_000 })).toBe(
      "ENT",
    );
  });

  it("70 min post-kickoff → '56' (estimado del 2T, asumiendo HT de 15 min)", () => {
    expect(computeMinutoLabel({ ...base, now: kickoff + 70 * 60_000 })).toBe(
      "56'",
    );
  });

  it("120 min post-kickoff → '—' (fuera de rango sin confirmación server)", () => {
    expect(computeMinutoLabel({ ...base, now: kickoff + 120 * 60_000 })).toBe(
      "—",
    );
  });
});

// ---------------------------------------------------------------------------
// useMinutoEnVivo — AST del hook
// ---------------------------------------------------------------------------

describe("useMinutoEnVivo — contrato del hook", () => {
  const SRC = readSrc("hooks/useMinutoEnVivo.ts");

  it('es client component ("use client")', () => {
    expect(SRC).toMatch(/^["']use client["'];/m);
  });

  it("exporta `useMinutoEnVivo` como función", () => {
    expect(SRC).toMatch(/export\s+function\s+useMinutoEnVivo\b/);
  });

  it("exporta `computeMinutoLabel` como función pura testeable", () => {
    expect(SRC).toMatch(/export\s+function\s+computeMinutoLabel\b/);
  });

  it("usa setInterval de 1000ms (reloj segundo a segundo)", () => {
    expect(SRC).toMatch(/setInterval\([\s\S]*?,\s*1_?000\s*\)/);
  });

  it("limpia el interval en cleanup del useEffect", () => {
    expect(SRC).toMatch(/return\s*\(\)\s*=>\s*clearInterval\(\s*id\s*\)/);
  });

  it("delega al mapper formatMinutoLabel para estados fijos", () => {
    expect(SRC).toMatch(/formatMinutoLabel\(/);
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

  it("usa useRef para trackear el ancla del elapsed (resetea al cambiar elapsed/status)", () => {
    expect(SRC).toMatch(/useRef/);
    expect(SRC).toMatch(/elapsedAnchorAt/);
    expect(SRC).toMatch(/prevElapsedRef/);
    expect(SRC).toMatch(/prevStatusRef/);
  });

  it("acepta fechaInicio como ancla primaria (no snapshotUpdatedAt)", () => {
    expect(SRC).toMatch(/fechaInicio\s*:\s*string\s*\|\s*Date/);
    // snapshotUpdatedAt solo puede aparecer en comentarios históricos,
    // no como símbolo activo.
    expect(readSrcNoComments("hooks/useMinutoEnVivo.ts")).not.toMatch(
      /snapshotUpdatedAt/,
    );
  });
});

// ---------------------------------------------------------------------------
// Wiring — payload + endpoints + LiveHero
// ---------------------------------------------------------------------------

describe("RankingUpdatePayload — statusShort sí, snapshotUpdatedAt NO (simplificación)", () => {
  const SRC = readSrc("lib/realtime/events.ts");

  it("incluye `statusShort: string | null`", () => {
    expect(SRC).toMatch(/statusShort\s*:\s*string\s*\|\s*null/);
  });

  it("NO incluye snapshotUpdatedAt (refactor simplificado)", () => {
    expect(SRC).not.toMatch(/snapshotUpdatedAt/);
  });
});

describe("emitirRankingUpdate — propaga statusShort desde el cache", () => {
  const SRC = readSrc("lib/realtime/emitters.ts");

  it("lee statusShort del snapshot del cache", () => {
    expect(SRC).toMatch(/statusShort\s*=\s*snapshot\?\.statusShort/);
  });

  it("NO lee snapshotUpdatedAt (eliminado)", () => {
    expect(SRC).not.toMatch(/snapshotUpdatedAt/);
  });

  it("incluye statusShort en el payload emitido", () => {
    expect(SRC).toMatch(/statusShort\s*,/);
  });
});

describe("GET /api/v1/torneos/:id/ranking — expone statusShort", () => {
  const SRC = readSrc("app/api/v1/torneos/[id]/ranking/route.ts");

  it("agrega statusShort al response", () => {
    expect(SRC).toMatch(/statusShort\s*:/);
  });

  it("NO agrega snapshotUpdatedAt (eliminado)", () => {
    expect(SRC).not.toMatch(/snapshotUpdatedAt/);
  });
});

describe("GET /api/v1/live/matches — expone statusShort + fechaInicio", () => {
  const SRC = readSrc("app/api/v1/live/matches/route.ts");

  it("incluye statusShort en el payload del partido", () => {
    expect(SRC).toMatch(/statusShort\s*:/);
  });

  it("incluye fechaInicio serializada (ISO) para el reloj local", () => {
    expect(SRC).toMatch(/fechaInicio\s*:\s*p\.fechaInicio\.toISOString\(\)/);
  });

  it("NO incluye snapshotUpdatedAt", () => {
    expect(SRC).not.toMatch(/snapshotUpdatedAt/);
  });
});

describe("LiveHero — consume useMinutoEnVivo con fechaInicio", () => {
  const SRC = readSrc("components/live/LiveHero.tsx");

  it('es client component ("use client")', () => {
    expect(SRC).toMatch(/^["']use client["'];/m);
  });

  it("importa useMinutoEnVivo", () => {
    expect(SRC).toMatch(
      /import\s*\{[^}]*useMinutoEnVivo[^}]*\}\s*from\s*["']@\/hooks\/useMinutoEnVivo["']/,
    );
  });

  it("acepta prop fechaInicio (ancla del reloj)", () => {
    expect(SRC).toMatch(/fechaInicio\s*:\s*string\s*\|\s*Date/);
  });

  it("acepta props statusShort + elapsed", () => {
    expect(SRC).toMatch(/statusShort\s*:\s*string\s*\|\s*null/);
    expect(SRC).toMatch(/elapsed\s*:\s*number\s*\|\s*null/);
  });

  it("NO acepta snapshotUpdatedAt (eliminado — solo permitido en comentarios)", () => {
    expect(readSrcNoComments("components/live/LiveHero.tsx")).not.toMatch(
      /snapshotUpdatedAt/,
    );
  });

  it("invoca useMinutoEnVivo con los 3 campos {fechaInicio, statusShort, elapsed}", () => {
    expect(SRC).toMatch(
      /useMinutoEnVivo\(\s*\{[\s\S]*?fechaInicio[\s\S]*?statusShort[\s\S]*?elapsed[\s\S]*?\}\s*\)/,
    );
  });

  it("preserva data-testid='live-minute-label' (no regresión del Bug #9)", () => {
    expect(SRC).toMatch(/data-testid=["']live-minute-label["']/);
  });
});

describe("LiveMatchView — propaga fechaInicio al LiveHero", () => {
  const SRC = readSrc("components/live/LiveMatchView.tsx");

  it("LiveMatchTab declara fechaInicio: string", () => {
    expect(SRC).toMatch(/fechaInicio\s*:\s*string/);
  });

  it("LiveMatchTab declara statusShort + elapsed", () => {
    expect(SRC).toMatch(/statusShort\s*:\s*string\s*\|\s*null/);
    expect(SRC).toMatch(/elapsed\s*:\s*number\s*\|\s*null/);
  });

  it("LiveMatchTab NO tiene snapshotUpdatedAt", () => {
    expect(SRC).not.toMatch(/snapshotUpdatedAt/);
  });

  it("pasa fechaInicio={active.fechaInicio} al LiveHero", () => {
    expect(SRC).toMatch(/fechaInicio=\{active\.fechaInicio\}/);
  });

  it("pasa statusShort con fallback SSR → WS", () => {
    expect(SRC).toMatch(/statusShort=\{live\.statusShort\s*\?\?\s*active\.statusShort\}/);
  });

  it("pasa elapsed con fallback WS → SSR", () => {
    expect(SRC).toMatch(/elapsed=\{live\.minutoPartido\s*\?\?\s*active\.elapsed\}/);
  });
});

describe("useRankingEnVivo — statusShort sí, snapshotUpdatedAt NO", () => {
  const SRC = readSrc("hooks/useRankingEnVivo.ts");

  it("RankingSnapshot declara statusShort", () => {
    expect(SRC).toMatch(/statusShort\s*:\s*string\s*\|\s*null/);
  });

  it("RankingSnapshot NO declara snapshotUpdatedAt", () => {
    expect(SRC).not.toMatch(/snapshotUpdatedAt/);
  });

  it("onUpdate copia statusShort del payload al state", () => {
    expect(SRC).toMatch(/statusShort\s*:\s*payload\.statusShort/);
  });

  it("applySnapshot preserva statusShort null (no pisa un valor anterior)", () => {
    expect(SRC).toMatch(/statusShort\s*:\s*d\.statusShort\s*\?\?\s*s\.statusShort/);
  });
});

describe("/live-match page.tsx — SSR rellena fechaInicio + statusShort + elapsed", () => {
  const SRC = readSrc("app/(main)/live-match/page.tsx");

  it("buildLiveTabs asigna fechaInicio del Partido (ISO)", () => {
    expect(SRC).toMatch(/fechaInicio\s*:\s*p\.fechaInicio\.toISOString\(\)/);
  });

  it("buildLiveTabs asigna statusShort del cache", () => {
    expect(SRC).toMatch(/statusShort\s*:\s*snap\?\.statusShort/);
  });

  it("buildLiveTabs asigna elapsed del cache (snap.minuto)", () => {
    expect(SRC).toMatch(/elapsed\s*:\s*snap\?\.minuto/);
  });

  it("NO asigna snapshotUpdatedAt (eliminado)", () => {
    expect(SRC).not.toMatch(/snapshotUpdatedAt/);
  });
});
