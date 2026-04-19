// Tests antidrift del Hotfix #4 Bug #9. El LiveHero solía renderizar
// `{minuto ?? "?"}'` que mostraba literalmente "?" cuando el poller
// aún no había entregado un número. Ahora:
//   - Recibe `minutoLabel: string | null` (NO `minuto: number | null`).
//   - Usa `renderMinutoLabel()` para garantizar "—" en lugar de "?".
//   - Nunca tiene "?" hardcodeado como fallback.

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

describe("LiveHero — Bug #9: minute display", () => {
  it("recibe `minutoLabel: string | null` como prop", () => {
    expect(LIVE_HERO_SRC).toMatch(
      /minutoLabel\s*:\s*string\s*\|\s*null/,
    );
  });

  it("ya NO declara `minuto: number | null` como prop", () => {
    // El prop legacy se removió — el LiveHero solo recibe label
    // ya renderizado, no construye el string en UI.
    expect(LIVE_HERO_SRC).not.toMatch(/\n\s*minuto:\s*number\s*\|\s*null/);
  });

  it("importa renderMinutoLabel del helper puro", () => {
    expect(LIVE_HERO_SRC).toMatch(
      /import\s*\{[^}]*renderMinutoLabel[^}]*\}\s*from\s*["']@\/lib\/utils\/minuto-label["']/,
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

describe("LiveMatchView — pasa minutoLabel a LiveHero", () => {
  it("propaga `minutoLabel={...}` al LiveHero", () => {
    expect(LIVE_MATCH_VIEW_SRC).toMatch(/minutoLabel=\{/);
  });

  it("ya NO pasa `minuto={...}` como prop", () => {
    // La prop cambió de `minuto` a `minutoLabel` — bug antidrift.
    expect(LIVE_MATCH_VIEW_SRC).not.toMatch(
      /<LiveHero[\s\S]*?\n\s*minuto=\{/,
    );
  });

  it("LiveMatchTab.minutoLabel está tipado string | null", () => {
    expect(LIVE_MATCH_VIEW_SRC).toMatch(
      /minutoLabel\s*:\s*string\s*\|\s*null/,
    );
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

describe("emitirRankingUpdate — incluye minutoLabel desde el cache", () => {
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
});

describe("/api/v1/live/matches — expone minutoLabel en la respuesta", () => {
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
});
