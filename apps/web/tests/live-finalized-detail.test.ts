// Tests del Hotfix #5 Bug #16: la sección de finalizados y el detalle
// post-partido se enriquecen.
//
//   - `FinalizedMatchCard.ganador` ahora incluye los 5 chips con
//     correct/wrong por predicción (antes solo nombre + premio).
//   - `/live-match?torneoId=<finalizado>` renderea `LiveFinalizedBanner`
//     al final de la vista post-partido ("el próximo torneo te espera").
//   - `buildFinalizedWinnerChips` deriva chips desde la RankingRow.
//
// Los tests de rendering son AST-level (vitest node env, sin jsdom).
// El cálculo de chips sí se testea con casos directos.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildFinalizedWinnerChips } from "@/components/live/finalized-winner-chips";
import type { RankingRow } from "@/lib/services/ranking.service";

const ROOT = resolve(__dirname, "..");
function readSrc(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf-8");
}

// ---------------------------------------------------------------------------
// buildFinalizedWinnerChips — helper puro
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<RankingRow>): Pick<
  RankingRow,
  "predicciones" | "puntosDetalle"
> {
  const predicciones = overrides.predicciones ?? {
    predResultado: "LOCAL" as const,
    predBtts: true,
    predMas25: false,
    predTarjetaRoja: false,
    predMarcadorLocal: 2,
    predMarcadorVisita: 1,
  };
  const puntosDetalle = overrides.puntosDetalle ?? {
    resultado: 0,
    btts: 0,
    mas25: 0,
    tarjeta: 0,
    marcador: 0,
  };
  return { predicciones, puntosDetalle };
}

describe("buildFinalizedWinnerChips", () => {
  it("ganador con todas las predicciones acertadas → 5 chips correct", () => {
    const row = makeRow({
      puntosDetalle: {
        resultado: 3,
        btts: 2,
        mas25: 2,
        tarjeta: 6,
        marcador: 8,
      },
    });
    const chips = buildFinalizedWinnerChips(row, "River", "Boca");
    expect(chips).toHaveLength(5);
    for (const c of chips) {
      expect(c.estado).toBe("correct");
    }
  });

  it("ganador con todo fallado → 5 chips wrong", () => {
    const row = makeRow({});
    const chips = buildFinalizedWinnerChips(row, "River", "Boca");
    expect(chips).toHaveLength(5);
    for (const c of chips) {
      expect(c.estado).toBe("wrong");
    }
  });

  it("chip 1X2 muestra nombre del equipo local cuando predResultado=LOCAL", () => {
    const row = makeRow({
      predicciones: {
        predResultado: "LOCAL",
        predBtts: true,
        predMas25: false,
        predTarjetaRoja: false,
        predMarcadorLocal: 0,
        predMarcadorVisita: 0,
      },
    });
    const chips = buildFinalizedWinnerChips(row, "Liverpool", "Arsenal");
    expect(chips[0]!.label).toBe("Liverpool");
  });

  it("chip 1X2 muestra 'Empate' cuando predResultado=EMPATE", () => {
    const row = makeRow({
      predicciones: {
        predResultado: "EMPATE",
        predBtts: true,
        predMas25: false,
        predTarjetaRoja: false,
        predMarcadorLocal: 1,
        predMarcadorVisita: 1,
      },
    });
    const chips = buildFinalizedWinnerChips(row, "River", "Boca");
    expect(chips[0]!.label).toBe("Empate");
  });

  it("chip 1X2 acorta nombres largos (>8 chars) al primer token", () => {
    const row = makeRow({
      predicciones: {
        predResultado: "VISITA",
        predBtts: false,
        predMas25: false,
        predTarjetaRoja: false,
        predMarcadorLocal: 0,
        predMarcadorVisita: 1,
      },
    });
    const chips = buildFinalizedWinnerChips(row, "Manchester City", "Atletico Madrid");
    expect(chips[0]!.label).toBe("Atletico"); // first token of visita
  });

  it("chip btts / +2.5 / roja reflejan el boolean del usuario", () => {
    const row = makeRow({
      predicciones: {
        predResultado: "LOCAL",
        predBtts: true,
        predMas25: false,
        predTarjetaRoja: true,
        predMarcadorLocal: 1,
        predMarcadorVisita: 0,
      },
    });
    const chips = buildFinalizedWinnerChips(row, "A", "B");
    expect(chips[1]!.label).toBe("Ambos Sí");
    expect(chips[2]!.label).toBe("+2.5 No");
    expect(chips[3]!.label).toBe("Roja Sí");
  });

  it("chip marcador tiene formato 'X-Y'", () => {
    const row = makeRow({
      predicciones: {
        predResultado: "LOCAL",
        predBtts: true,
        predMas25: true,
        predTarjetaRoja: false,
        predMarcadorLocal: 3,
        predMarcadorVisita: 2,
      },
    });
    const chips = buildFinalizedWinnerChips(row, "A", "B");
    expect(chips[4]!.label).toBe("3-2");
  });

  it("mezcla correct/wrong según puntosDetalle por predicción", () => {
    const row = makeRow({
      puntosDetalle: {
        resultado: 3, // correct
        btts: 0, // wrong
        mas25: 2, // correct
        tarjeta: 0, // wrong
        marcador: 8, // correct
      },
    });
    const chips = buildFinalizedWinnerChips(row, "A", "B");
    expect(chips[0]!.estado).toBe("correct");
    expect(chips[1]!.estado).toBe("wrong");
    expect(chips[2]!.estado).toBe("correct");
    expect(chips[3]!.estado).toBe("wrong");
    expect(chips[4]!.estado).toBe("correct");
  });
});

// ---------------------------------------------------------------------------
// AST: LiveFinalizedSection muestra las chips del ganador (Bug #16)
// ---------------------------------------------------------------------------

describe("LiveFinalizedSection.tsx — cards con chips del ganador", () => {
  const SRC = readSrc("components/live/LiveFinalizedSection.tsx");

  it("exporta FinalizedMatchCard con propiedad `ganador` (reemplaza ganadorNombre/Premio)", () => {
    expect(SRC).toMatch(/ganador:\s*GanadorPreview\s*\|\s*null/);
    // El shape viejo (`ganadorNombre: string | null`) ya no debe existir.
    expect(SRC).not.toMatch(/ganadorNombre:\s*string/);
    expect(SRC).not.toMatch(/ganadorPremio:\s*number/);
  });

  it("GanadorPreview expone chips: Array<{label, estado}>", () => {
    expect(SRC).toMatch(
      /chips:\s*Array<\{\s*label:\s*string;\s*estado:\s*EstadoChipFinalizado\s*\}>/,
    );
  });

  it("WinnerPreview renderiza ganador.chips con tokens pred-correct-bg/pred-wrong-bg", () => {
    // Los tokens del design system, no hex hardcoded.
    expect(SRC).toMatch(/bg-pred-correct-bg\s+text-pred-correct/);
    expect(SRC).toMatch(/bg-pred-wrong-bg\s+text-pred-wrong/);
    expect(SRC).not.toMatch(/#00D68F|#FF3D3D/);
  });

  it("tiene data-testid='finalized-card-winner' cuando hay ganador", () => {
    expect(SRC).toMatch(/data-testid=["']finalized-card-winner["']/);
  });

  it("cada chip del ganador tiene data-testid='finalized-winner-chip-<estado>'", () => {
    expect(SRC).toMatch(/finalized-winner-chip-/);
  });

  it("cae a fallback 'Sin ganadores registrados' si ganador es null", () => {
    expect(SRC).toMatch(/Sin ganadores registrados/);
  });
});

// ---------------------------------------------------------------------------
// AST: LiveFinalizedBanner — post-partido
// ---------------------------------------------------------------------------

describe("LiveFinalizedBanner.tsx — CTA motivacional post-partido", () => {
  const SRC = readSrc("components/live/LiveFinalizedBanner.tsx");

  it("acepta proximoTorneoId: string | null", () => {
    expect(SRC).toMatch(/proximoTorneoId:\s*string\s*\|\s*null/);
  });

  it("linkea a /torneo/<id> cuando proximoTorneoId está presente", () => {
    expect(SRC).toMatch(/\/torneo\/\$\{proximoTorneoId\}/);
  });

  it("cae a /matches cuando proximoTorneoId es null", () => {
    expect(SRC).toMatch(/["']\/matches["']/);
  });

  it("copy 'El próximo torneo te espera' (Bug #16)", () => {
    expect(SRC).toMatch(/El próximo torneo te espera/);
  });

  it("tiene data-testid='live-finalized-banner' + 'live-finalized-banner-cta'", () => {
    expect(SRC).toMatch(/data-testid=["']live-finalized-banner["']/);
    expect(SRC).toMatch(/data-testid=["']live-finalized-banner-cta["']/);
  });

  it("usa tokens del design system (bg-hero-blue, bg-brand-gold)", () => {
    expect(SRC).toMatch(/bg-hero-blue/);
    expect(SRC).toMatch(/bg-brand-gold/);
  });
});

// ---------------------------------------------------------------------------
// AST: LiveMatchView renderea el banner solo si active.estado === FINALIZADO
// ---------------------------------------------------------------------------

describe("LiveMatchView.tsx — banner motivacional condicional (Bug #16)", () => {
  const SRC = readSrc("components/live/LiveMatchView.tsx");

  it("importa LiveFinalizedBanner", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*LiveFinalizedBanner\s*\}\s*from\s*["']\.\/LiveFinalizedBanner["']/,
    );
  });

  it("renderea <LiveFinalizedBanner> solo cuando active.estado === 'FINALIZADO'", () => {
    expect(SRC).toMatch(
      /active\.estado\s*===\s*["']FINALIZADO["'][\s\S]*?<LiveFinalizedBanner/,
    );
  });

  it("acepta proximoTorneoId como prop (del server)", () => {
    expect(SRC).toMatch(/proximoTorneoId\?\:\s*string\s*\|\s*null/);
  });
});

// ---------------------------------------------------------------------------
// AST: /live-match page enriquece FinalizedMatchCard con chips del ganador
// ---------------------------------------------------------------------------

describe("/live-match page — pipe del ganador enriquecido (Bug #16)", () => {
  const SRC = readSrc("app/(main)/live-match/page.tsx");

  it("importa buildFinalizedWinnerChips", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*buildFinalizedWinnerChips\s*\}\s*from\s*["']@\/components\/live\/finalized-winner-chips["']/,
    );
  });

  it("llama listarRanking(main.id, { limit: 1 }) para obtener el top 1", () => {
    expect(SRC).toMatch(/listarRanking\s*\(\s*main\.id\s*,\s*\{\s*limit:\s*1\s*\}/);
  });

  it("construye `ganador` con {nombre, puntos, premioLukas, chips}", () => {
    expect(SRC).toMatch(
      /ganador\s*=\s*\{[\s\S]*?nombre:\s*top\.nombre[\s\S]*?premioLukas:\s*top\.premioEstimado[\s\S]*?chips:\s*buildFinalizedWinnerChips/,
    );
  });

  it("resuelve proximoTorneoId via listarTorneos({estado:'ABIERTO', limit:1})", () => {
    expect(SRC).toMatch(/listarTorneos\s*\(\s*\{\s*estado:\s*["']ABIERTO["'][\s\S]*?limit:\s*1/);
  });

  it("pasa proximoTorneoId al LiveMatchView", () => {
    expect(SRC).toMatch(/proximoTorneoId=\{/);
  });

  it("el Empty-with-finalizados también recibe proximoTorneoId", () => {
    // EmptyLiveWithFinalized es un wrapper que instancia LiveMatchView
    // — debe pasarle proximoTorneoId para que el banner funcione si el
    // usuario viene a /live-match?torneoId=<finalized> sin live.
    expect(SRC).toMatch(/EmptyLiveWithFinalized[\s\S]*?proximoTorneoId/);
  });
});
