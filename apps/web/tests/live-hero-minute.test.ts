// Tests antidrift del flujo del minuto en vivo. Reimplementación simplificada
// (Abr 2026, referencia Google Live Match). Invariantes clave:
//   - LiveHero recibe los inputs crudos (`statusShort`, `elapsed`, `extra`,
//     `elapsedAgeMs`) y delega en `useMinutoEnVivo` para el label final.
//   - useMinutoEnVivo corre reloj local solo en 1H/2H/ET; congela el label
//     en HT/BT/NS/FT/etc.
//   - El cache del poller guarda y sirve `extra` (descuento 45+3', 90+5').
//   - NUNCA se muestra "?" como fallback — `getMinutoLabel` devuelve "—" si
//     falta `statusShort`.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const LIVE_HERO_SRC = readFileSync(
  resolve(ROOT, "components", "live", "LiveHero.tsx"),
  "utf-8",
);
const LIVE_MATCH_VIEW_SRC = readFileSync(
  resolve(ROOT, "components", "live", "LiveMatchView.tsx"),
  "utf-8",
);

describe("LiveHero — props del minuto", () => {
  it("recibe `elapsedAgeMs: number | null` como ancla del reloj", () => {
    expect(LIVE_HERO_SRC).toMatch(/elapsedAgeMs\s*:\s*number\s*\|\s*null/);
  });

  it("recibe `statusShort: string | null` (fase del partido)", () => {
    expect(LIVE_HERO_SRC).toMatch(/statusShort\s*:\s*string\s*\|\s*null/);
  });

  it("recibe `elapsed: number | null` (minuto crudo del server)", () => {
    expect(LIVE_HERO_SRC).toMatch(/elapsed\s*:\s*number\s*\|\s*null/);
  });

  it("recibe `extra: number | null` (injury time 1H/2H)", () => {
    expect(LIVE_HERO_SRC).toMatch(/extra\s*:\s*number\s*\|\s*null/);
  });

  it("importa useMinutoEnVivo", () => {
    expect(LIVE_HERO_SRC).toMatch(
      /import\s*\{[^}]*useMinutoEnVivo[^}]*\}\s*from\s*["']@\/hooks\/useMinutoEnVivo["']/,
    );
  });

  it('no tiene "?" como fallback de UI para el minuto', () => {
    expect(LIVE_HERO_SRC).not.toMatch(/\?\?\s*["']\?["']/);
  });

  it("renderiza el label vía data-testid='live-minute-label' (testable)", () => {
    expect(LIVE_HERO_SRC).toMatch(/data-testid=["']live-minute-label["']/);
  });
});

describe("LiveMatchView — propaga inputs crudos al LiveHero", () => {
  it("propaga `elapsedAgeMs={...}` al LiveHero", () => {
    expect(LIVE_MATCH_VIEW_SRC).toMatch(
      /elapsedAgeMs=\{live\.elapsedAgeMs\s*\?\?\s*active\.elapsedAgeMs\}/,
    );
  });

  it("propaga `statusShort={...}` al LiveHero con fallback WS→SSR", () => {
    expect(LIVE_MATCH_VIEW_SRC).toMatch(
      /statusShort=\{live\.statusShort\s*\?\?\s*active\.statusShort\}/,
    );
  });

  it("propaga `elapsed={...}` al LiveHero", () => {
    expect(LIVE_MATCH_VIEW_SRC).toMatch(/elapsed=\{live\.minutoPartido/);
  });

  it("propaga `extra={...}` al LiveHero", () => {
    expect(LIVE_MATCH_VIEW_SRC).toMatch(/extra=\{live\.minutoExtra/);
  });

  it("LiveMatchTab.extra agregado (Abr 2026)", () => {
    expect(LIVE_MATCH_VIEW_SRC).toMatch(/extra\s*:\s*number\s*\|\s*null/);
  });
});

describe("poller-partidos.job — escribe al cache en cada tick", () => {
  const SRC = readFileSync(
    resolve(ROOT, "lib", "services", "poller-partidos.job.ts"),
    "utf-8",
  );

  it("importa setLiveStatus del cache", () => {
    expect(SRC).toMatch(/import\s*\{[^}]*setLiveStatus[^}]*\}/);
  });

  it("llama setLiveStatus con status.short + elapsed + extra", () => {
    expect(SRC).toMatch(
      /setLiveStatus\s*\(\s*partido\.id\s*,\s*fixture\.fixture\.status\.short\s*,\s*fixture\.fixture\.status\.elapsed\s*,\s*fixture\.fixture\.status\.extra\s*\?\?\s*null/,
    );
  });
});

describe("emitirRankingUpdate — incluye minutoLabel + minutoExtra + statusShort", () => {
  const SRC = readFileSync(
    resolve(ROOT, "lib", "realtime", "emitters.ts"),
    "utf-8",
  );

  it("importa getLiveStatus", () => {
    expect(SRC).toMatch(/getLiveStatus/);
  });

  it("el payload incluye minutoLabel", () => {
    expect(SRC).toMatch(/minutoLabel/);
  });

  it("el payload incluye minutoExtra", () => {
    expect(SRC).toMatch(/minutoExtra/);
  });

  it("el payload incluye statusShort", () => {
    expect(SRC).toMatch(/statusShort/);
  });
});

describe("RankingUpdatePayload — shape del tipo compartido", () => {
  const SRC = readFileSync(
    resolve(ROOT, "lib", "realtime", "events.ts"),
    "utf-8",
  );

  it("RankingUpdatePayload tiene `minutoLabel: string | null`", () => {
    expect(SRC).toMatch(/minutoLabel\s*:\s*string\s*\|\s*null/);
  });

  it("RankingUpdatePayload tiene `minutoExtra: number | null`", () => {
    expect(SRC).toMatch(/minutoExtra\s*:\s*number\s*\|\s*null/);
  });

  it("RankingUpdatePayload tiene `statusShort: string | null`", () => {
    expect(SRC).toMatch(/statusShort\s*:\s*string\s*\|\s*null/);
  });
});

describe("/api/v1/live/matches — expone minutoLabel + fechaInicio", () => {
  const SRC = readFileSync(
    resolve(ROOT, "app", "api", "v1", "live", "matches", "route.ts"),
    "utf-8",
  );

  it("importa getLiveStatus del cache", () => {
    expect(SRC).toMatch(/getLiveStatus/);
  });

  it("incluye minutoLabel en el payload de cada partido", () => {
    expect(SRC).toMatch(/minutoLabel/);
  });

  it("incluye fechaInicio serializada", () => {
    expect(SRC).toMatch(/fechaInicio\s*:\s*p\.fechaInicio\.toISOString\(\)/);
  });
});
