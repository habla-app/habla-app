// Tests del reloj local del minuto en vivo — reimplementación simplificada
// (Abr 2026, referencia Google Live Match).
//
// Cobertura:
//   1. `computeMinutoLabel` puro: matriz por fase (1H/2H/ET avanzan desde
//      minuto anclado; HT/FT/PEN/... fijos; minuto>=cap respeta server;
//      sin statusShort → "—" honesto).
//   2. `extra` se propaga al mapper y produce "{minuto}+{extra}'" en 1H/2H.
//   3. AST sobre `useMinutoEnVivo.ts`: contrato del hook (use client,
//      interval 1s, cleanup, useRef para anchoredAt, reset al cambiar
//      statusShort/minuto/extra/elapsedAgeMs).
//   4. AST sobre wiring: RankingUpdatePayload + endpoints REST + SSR +
//      LiveHero + useRankingEnVivo propagan extra / elapsedAgeMs.

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

describe("computeMinutoLabel — ancla server + proyección local", () => {
  it("minuto=54 con age=5s (snap fresco) + 60s locales → 55", () => {
    const snapshotCapturedAt = Date.now() - 5_000 - 60_000;
    expect(
      computeMinutoLabel({
        statusShort: "2H",
        minuto: 54,
        extra: null,
        anchoredAt: snapshotCapturedAt,
        now: Date.now(),
      }),
    ).toBe("55'");
  });

  it("minuto=54 con age=5min (snap stale cache) → proyecta +5 minutos", () => {
    const snapshotCapturedAt = Date.now() - 5 * 60_000;
    expect(
      computeMinutoLabel({
        statusShort: "2H",
        minuto: 54,
        extra: null,
        anchoredAt: snapshotCapturedAt,
        now: Date.now(),
      }),
    ).toBe("59'");
  });

  it("sin age (anchor=now) no proyecta — muestra el minuto crudo", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "2H",
        minuto: 54,
        extra: null,
        anchoredAt: now,
        now,
      }),
    ).toBe("54'");
  });
});

describe("computeMinutoLabel — 1H proyecta con cap 45", () => {
  it("1H minuto=10 + 60s → 11", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "1H",
        minuto: 10,
        extra: null,
        anchoredAt: now - 60_000,
        now,
      }),
    ).toBe("11'");
  });

  it("1H minuto=10 + 30s (delta<60s) → 10", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "1H",
        minuto: 10,
        extra: null,
        anchoredAt: now - 30_000,
        now,
      }),
    ).toBe("10'");
  });

  it("1H minuto=44 + 5 min → clamp en 45", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "1H",
        minuto: 44,
        extra: null,
        anchoredAt: now - 5 * 60_000,
        now,
      }),
    ).toBe("45'");
  });

  it("1H minuto=48 (injury time) → respeta server sin proyectar", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "1H",
        minuto: 48,
        extra: null,
        anchoredAt: now - 60_000,
        now,
      }),
    ).toBe("48'");
  });
});

describe("computeMinutoLabel — 2H y ET", () => {
  it("2H minuto=55 + 60s → 56", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "2H",
        minuto: 55,
        extra: null,
        anchoredAt: now - 60_000,
        now,
      }),
    ).toBe("56'");
  });

  it("2H minuto=89 + 5 min → clamp en 90", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "2H",
        minuto: 89,
        extra: null,
        anchoredAt: now - 5 * 60_000,
        now,
      }),
    ).toBe("90'");
  });

  it("2H minuto=94 (injury time) → respeta server", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "2H",
        minuto: 94,
        extra: null,
        anchoredAt: now - 60_000,
        now,
      }),
    ).toBe("94'");
  });

  it("ET minuto=95 + 60s → 'TE 96''", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "ET",
        minuto: 95,
        extra: null,
        anchoredAt: now - 60_000,
        now,
      }),
    ).toBe("TE 96'");
  });
});

describe("computeMinutoLabel — extra (injury time label)", () => {
  it("1H minuto=45 con extra=3 → '45+3'' (server reporta cap + descuento)", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "1H",
        minuto: 45,
        extra: 3,
        anchoredAt: now,
        now,
      }),
    ).toBe("45+3'");
  });

  it("2H minuto=90 con extra=5 → '90+5''", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "2H",
        minuto: 90,
        extra: 5,
        anchoredAt: now,
        now,
      }),
    ).toBe("90+5'");
  });

  it("proyección local sin extra no inventa minutos añadidos", () => {
    const now = Date.now();
    expect(
      computeMinutoLabel({
        statusShort: "2H",
        minuto: 70,
        extra: null,
        anchoredAt: now - 2 * 60_000,
        now,
      }),
    ).toBe("72'");
  });
});

describe("computeMinutoLabel — estados fijos (sin proyección)", () => {
  it("HT → 'Medio tiempo'", () => {
    expect(
      computeMinutoLabel({
        statusShort: "HT",
        minuto: 45,
        extra: null,
        anchoredAt: 0,
        now: Date.now(),
      }),
    ).toBe("Medio tiempo");
  });

  it("FT → 'Final'", () => {
    expect(
      computeMinutoLabel({
        statusShort: "FT",
        minuto: 90,
        extra: null,
        anchoredAt: 0,
        now: Date.now(),
      }),
    ).toBe("Final");
  });

  it("AET → 'Final'", () => {
    expect(
      computeMinutoLabel({
        statusShort: "AET",
        minuto: 120,
        extra: null,
        anchoredAt: 0,
        now: Date.now(),
      }),
    ).toBe("Final");
  });

  it("PEN → 'Final'", () => {
    expect(
      computeMinutoLabel({
        statusShort: "PEN",
        minuto: 120,
        extra: null,
        anchoredAt: 0,
        now: Date.now(),
      }),
    ).toBe("Final");
  });

  it("NS → 'Por iniciar'", () => {
    expect(
      computeMinutoLabel({
        statusShort: "NS",
        minuto: null,
        extra: null,
        anchoredAt: 0,
        now: Date.now(),
      }),
    ).toBe("Por iniciar");
  });

  it("BT → 'Descanso TE'", () => {
    expect(
      computeMinutoLabel({
        statusShort: "BT",
        minuto: null,
        extra: null,
        anchoredAt: 0,
        now: Date.now(),
      }),
    ).toBe("Descanso TE");
  });

  it("P → 'Penales'", () => {
    expect(
      computeMinutoLabel({
        statusShort: "P",
        minuto: null,
        extra: null,
        anchoredAt: 0,
        now: Date.now(),
      }),
    ).toBe("Penales");
  });

  it("SUSP (status desconocido para avance) → se pasa tal cual", () => {
    expect(
      computeMinutoLabel({
        statusShort: "SUSP",
        minuto: 30,
        extra: null,
        anchoredAt: 0,
        now: Date.now(),
      }),
    ).toBe("SUSP");
  });
});

describe("computeMinutoLabel — sin datos del server", () => {
  it("statusShort null → '—'", () => {
    expect(
      computeMinutoLabel({
        statusShort: null,
        minuto: null,
        extra: null,
        anchoredAt: 0,
        now: Date.now(),
      }),
    ).toBe("—");
  });

  it("statusShort null con minuto — igual '—' (sin fase no adivinamos)", () => {
    expect(
      computeMinutoLabel({
        statusShort: null,
        minuto: 30,
        extra: null,
        anchoredAt: 0,
        now: Date.now(),
      }),
    ).toBe("—");
  });

  it("1H con minuto null → statusShort crudo ('1H')", () => {
    expect(
      computeMinutoLabel({
        statusShort: "1H",
        minuto: null,
        extra: null,
        anchoredAt: 0,
        now: Date.now(),
      }),
    ).toBe("1H");
  });

  it("ET con minuto null → 'TE' (sin número)", () => {
    expect(
      computeMinutoLabel({
        statusShort: "ET",
        minuto: null,
        extra: null,
        anchoredAt: 0,
        now: Date.now(),
      }),
    ).toBe("TE");
  });
});

// ---------------------------------------------------------------------------
// useMinutoEnVivo — AST del hook
// ---------------------------------------------------------------------------

describe("useMinutoEnVivo — contrato del hook", () => {
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

  it("acepta input `extra: number | null`", () => {
    expect(SRC).toMatch(/extra\s*:\s*number\s*\|\s*null/);
  });

  it("NO usa `fechaInicio` en el código activo (solo snapshots server)", () => {
    expect(SRC_NO_COMMENTS).not.toMatch(/fechaInicio/);
  });

  it("anchora al reloj del server con Date.now() - elapsedAgeMs", () => {
    expect(SRC).toMatch(/Date\.now\(\)\s*-\s*elapsedAgeMs/);
  });

  it("usa useRef para trackear el ancla", () => {
    expect(SRC).toMatch(/anchoredAt\s*=\s*useRef/);
  });

  it("re-ancla cuando cambia elapsedAgeMs", () => {
    expect(SRC).toMatch(/elapsedAgeMs\s*!==\s*prevAgeRef\.current/);
  });

  it("re-ancla cuando cambia statusShort", () => {
    expect(SRC).toMatch(/statusShort\s*!==\s*prevStatusRef\.current/);
  });

  it("re-ancla cuando cambia extra", () => {
    expect(SRC).toMatch(/extra\s*!==\s*prevExtraRef\.current/);
  });

  it("solo avanza reloj en 1H/2H/ET", () => {
    expect(SRC).toMatch(/STATUSES_AVANZANDO\s*=\s*new\s+Set\(\s*\[\s*["']1H["']\s*,\s*["']2H["']\s*,\s*["']ET["']\s*\]/);
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

describe("RankingUpdatePayload — incluye elapsedAgeMs + minutoExtra", () => {
  const SRC = readSrc("lib/realtime/events.ts");

  it("tipo tiene `elapsedAgeMs: number | null`", () => {
    expect(SRC).toMatch(/elapsedAgeMs\s*:\s*number\s*\|\s*null/);
  });

  it("tipo tiene `minutoExtra: number | null`", () => {
    expect(SRC).toMatch(/minutoExtra\s*:\s*number\s*\|\s*null/);
  });
});

describe("emitirRankingUpdate — propaga extra + elapsedAgeMs", () => {
  const SRC = readSrc("lib/realtime/emitters.ts");

  it("captura emitAt = Date.now() y lo usa para la age", () => {
    expect(SRC).toMatch(/emitAt\s*=\s*Date\.now\(\)/);
  });

  it("calcula elapsedAgeMs = emitAt - snapshot.updatedAt", () => {
    expect(SRC).toMatch(
      /elapsedAgeMs\s*=\s*snapshot\s*\?\s*emitAt\s*-\s*snapshot\.updatedAt\s*:\s*null/,
    );
  });

  it("lee minutoExtra del snapshot", () => {
    expect(SRC).toMatch(/minutoExtra\s*=\s*snapshot\?\.extra/);
  });

  it("incluye minutoExtra en el payload emitido", () => {
    expect(SRC).toMatch(/\bminutoExtra\s*,/);
  });
});

describe("GET /api/v1/torneos/:id/ranking — expone minutoExtra + elapsedAgeMs", () => {
  const SRC = readSrc("app/api/v1/torneos/[id]/ranking/route.ts");

  it("calcula elapsedAgeMs desde el snap", () => {
    expect(SRC).toMatch(
      /elapsedAgeMs\s*:\s*liveSnap\s*\?\s*now\s*-\s*liveSnap\.updatedAt\s*:\s*null/,
    );
  });

  it("incluye minutoExtra leído del cache", () => {
    expect(SRC).toMatch(/minutoExtra\s*:\s*liveSnap\?\.extra\s*\?\?\s*null/);
  });
});

describe("GET /api/v1/live/matches — expone minutoExtra + elapsedAgeMs", () => {
  const SRC = readSrc("app/api/v1/live/matches/route.ts");

  it("calcula elapsedAgeMs por partido", () => {
    expect(SRC).toMatch(
      /elapsedAgeMs\s*:\s*liveSnap\s*\?\s*nowMs\s*-\s*liveSnap\.updatedAt\s*:\s*null/,
    );
  });

  it("incluye minutoExtra del cache", () => {
    expect(SRC).toMatch(/minutoExtra\s*:\s*liveSnap\?\.extra\s*\?\?\s*null/);
  });
});

describe("LiveHero — consume extra + elapsedAgeMs", () => {
  const SRC = readSrc("components/live/LiveHero.tsx");
  const SRC_NO_COMMENTS = readSrcNoComments("components/live/LiveHero.tsx");

  it('es client component ("use client")', () => {
    expect(SRC).toMatch(/^["']use client["'];/m);
  });

  it("acepta prop `elapsedAgeMs: number | null`", () => {
    expect(SRC).toMatch(/elapsedAgeMs\s*:\s*number\s*\|\s*null/);
  });

  it("acepta prop `extra: number | null`", () => {
    expect(SRC).toMatch(/extra\s*:\s*number\s*\|\s*null/);
  });

  it("NO usa `fechaInicio` en código activo", () => {
    expect(SRC_NO_COMMENTS).not.toMatch(/fechaInicio/);
  });

  it("invoca useMinutoEnVivo con statusShort + minuto + extra + elapsedAgeMs", () => {
    expect(SRC).toMatch(
      /useMinutoEnVivo\(\s*\{[\s\S]*?statusShort[\s\S]*?minuto[\s\S]*?extra[\s\S]*?elapsedAgeMs[\s\S]*?\}\s*\)/,
    );
  });

  it("preserva data-testid='live-minute-label'", () => {
    expect(SRC).toMatch(/data-testid=["']live-minute-label["']/);
  });
});

describe("LiveMatchView — propaga extra + elapsedAgeMs al LiveHero", () => {
  const SRC = readSrc("components/live/LiveMatchView.tsx");

  it("LiveMatchTab declara elapsedAgeMs: number | null", () => {
    expect(SRC).toMatch(/elapsedAgeMs\s*:\s*number\s*\|\s*null/);
  });

  it("LiveMatchTab declara extra: number | null", () => {
    expect(SRC).toMatch(/extra\s*:\s*number\s*\|\s*null/);
  });

  it("pasa elapsedAgeMs={live ?? active} al LiveHero", () => {
    expect(SRC).toMatch(
      /elapsedAgeMs=\{live\.elapsedAgeMs\s*\?\?\s*active\.elapsedAgeMs\}/,
    );
  });

  it("pasa extra={live ?? active} al LiveHero", () => {
    expect(SRC).toMatch(
      /extra=\{live\.minutoExtra\s*\?\?\s*active\.extra\}/,
    );
  });
});

describe("useRankingEnVivo — expone minutoExtra + elapsedAgeMs en el snapshot", () => {
  const SRC = readSrc("hooks/useRankingEnVivo.ts");

  it("RankingSnapshot declara elapsedAgeMs: number | null", () => {
    expect(SRC).toMatch(/elapsedAgeMs\s*:\s*number\s*\|\s*null/);
  });

  it("RankingSnapshot declara minutoExtra: number | null", () => {
    expect(SRC).toMatch(/minutoExtra\s*:\s*number\s*\|\s*null/);
  });

  it("onUpdate del WS pisa elapsedAgeMs del payload", () => {
    expect(SRC).toMatch(/elapsedAgeMs\s*:\s*payload\.elapsedAgeMs/);
  });

  it("onUpdate del WS pisa minutoExtra del payload", () => {
    expect(SRC).toMatch(/minutoExtra\s*:\s*payload\.minutoExtra/);
  });
});

describe("/live-match page.tsx — SSR calcula extra + elapsedAgeMs", () => {
  const SRC = readSrc("app/(main)/live-match/page.tsx");

  it("buildLiveTabs asigna elapsedAgeMs = nowMs - snap.updatedAt", () => {
    expect(SRC).toMatch(
      /elapsedAgeMs\s*:\s*snap\s*\?\s*nowMs\s*-\s*snap\.updatedAt\s*:\s*null/,
    );
  });

  it("buildLiveTabs asigna extra = snap?.extra ?? null", () => {
    expect(SRC).toMatch(/extra\s*:\s*snap\?\.extra\s*\?\?\s*null/);
  });
});
