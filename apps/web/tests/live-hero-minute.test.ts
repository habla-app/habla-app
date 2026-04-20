// Tests antidrift del Hotfix #4 Bug #9 actualizados post Hotfix #8 Bug
// #22 (refactor simplificado). El LiveHero solía renderizar
// `{minuto ?? "?"}'` que mostraba literalmente "?" cuando el poller
// aún no había entregado un número. El Hotfix #4 lo migró a `minutoLabel`.
// El Hotfix #8 reescribió el flujo: ahora el LiveHero recibe los inputs
// crudos (`fechaInicio`, `statusShort`, `elapsed`) y el hook
// `useMinutoEnVivo` es el único que decide qué string mostrar — corre
// un reloj local segundo a segundo anclado a `fechaInicio` (persistido
// en BD) o al `elapsed` del server (para 2H/ET).
//
// Invariante preservado: NUNCA se muestra "?" como fallback — el hook
// delega a `formatMinutoLabel` para estados fijos o a la heurística
// basada en fechaInicio cuando falta statusShort.

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

describe("LiveHero — Bug #9 + Hotfix #8 Ítems 2/3/4", () => {
  it("recibe `elapsedAgeMs: number | null` como ancla del reloj (Ítem 4)", () => {
    expect(LIVE_HERO_SRC).toMatch(/elapsedAgeMs\s*:\s*number\s*\|\s*null/);
  });

  it("recibe `statusShort: string | null` (fase del partido)", () => {
    expect(LIVE_HERO_SRC).toMatch(/statusShort\s*:\s*string\s*\|\s*null/);
  });

  it("recibe `elapsed: number | null` (minuto crudo del server)", () => {
    expect(LIVE_HERO_SRC).toMatch(/elapsed\s*:\s*number\s*\|\s*null/);
  });

  it("ya NO declara `minuto: number | null` como prop (legacy pre-Hotfix #4)", () => {
    expect(LIVE_HERO_SRC).not.toMatch(/\n\s*minuto:\s*number\s*\|\s*null/);
  });

  it("importa useMinutoEnVivo (Hotfix #8) — reemplaza a renderMinutoLabel directo", () => {
    expect(LIVE_HERO_SRC).toMatch(
      /import\s*\{[^}]*useMinutoEnVivo[^}]*\}\s*from\s*["']@\/hooks\/useMinutoEnVivo["']/,
    );
  });

  it('ya NO tiene la expresión `{minuto ?? "?"}`', () => {
    // El bug original: ScoreBox renderizaba `{minuto ?? "?"}&apos;` y
    // el "?" aparecía literalmente.
    expect(LIVE_HERO_SRC).not.toMatch(/\{\s*minuto\s*\?\?\s*["']\?["']\s*\}/);
  });

  it("no tiene ningún '?' como fallback de UI para el minuto", () => {
    // Busca el patrón `?? "?"` que indicaría un fallback literal.
    // Permitimos apóstrofes 'en' (símbolo de minuto) — solo
    // reventamos por el carácter `?` dentro de un fallback string.
    expect(LIVE_HERO_SRC).not.toMatch(/\?\?\s*["']\?["']/);
  });

  it("renderiza el label vía data-testid='live-minute-label' (testable)", () => {
    expect(LIVE_HERO_SRC).toMatch(/data-testid=["']live-minute-label["']/);
  });
});

describe("LiveMatchView — propaga inputs crudos al LiveHero (Ítem 4)", () => {
  it("propaga `elapsedAgeMs={...}` al LiveHero (ancla del reloj server-side)", () => {
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

  it("ya NO propaga `fechaInicio` al LiveHero (removida en Ítem 4)", () => {
    expect(LIVE_MATCH_VIEW_SRC).not.toMatch(/fechaInicio=\{active\.fechaInicio\}/);
  });

  it("LiveMatchTab.minutoLabel sigue tipado string | null (fallback SSR del Hotfix #4)", () => {
    expect(LIVE_MATCH_VIEW_SRC).toMatch(
      /minutoLabel\s*:\s*string\s*\|\s*null/,
    );
  });

  it("LiveMatchTab.elapsedAgeMs agregado (Ítem 4)", () => {
    expect(LIVE_MATCH_VIEW_SRC).toMatch(/elapsedAgeMs\s*:\s*number\s*\|\s*null/);
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

  it("llama setLiveStatus con fixture.status.short + elapsed", () => {
    expect(SRC).toMatch(
      /setLiveStatus\s*\(\s*partido\.id\s*,\s*fixture\.fixture\.status\.short\s*,\s*fixture\.fixture\.status\.elapsed/,
    );
  });
});

describe("emitirRankingUpdate — incluye minutoLabel + statusShort", () => {
  const SRC = readFileSync(
    resolve(ROOT, "lib", "realtime", "emitters.ts"),
    "utf-8",
  );

  it("importa getLiveStatus", () => {
    expect(SRC).toMatch(/getLiveStatus/);
  });

  it("el payload incluye minutoLabel (no solo minutoPartido)", () => {
    expect(SRC).toMatch(/minutoLabel/);
  });

  it("el payload incluye statusShort (Hotfix #8)", () => {
    expect(SRC).toMatch(/statusShort/);
  });
});

describe("RankingUpdatePayload — shape del tipo compartido", () => {
  const SRC = readFileSync(
    resolve(ROOT, "lib", "realtime", "events.ts"),
    "utf-8",
  );

  it("RankingUpdatePayload tiene `minutoLabel: string | null`", () => {
    expect(SRC).toMatch(
      /minutoLabel\s*:\s*string\s*\|\s*null/,
    );
  });

  it("RankingUpdatePayload tiene `statusShort: string | null` (Hotfix #8)", () => {
    expect(SRC).toMatch(
      /statusShort\s*:\s*string\s*\|\s*null/,
    );
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

  it("incluye fechaInicio serializada (Hotfix #8)", () => {
    expect(SRC).toMatch(/fechaInicio\s*:\s*p\.fechaInicio\.toISOString\(\)/);
  });
});
