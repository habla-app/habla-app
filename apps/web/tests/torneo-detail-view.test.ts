// Tests del helper puro `buildTorneoDetailViewModel` (Hotfix #5 Bug #13).
//
// Reglas clave cubiertas:
//   - `pozoMostrado` deriva de pozoBruto * 0.88 cuando ABIERTO (pozoNeto
//     aún en 0) y del pozoNeto real cuando CERRADO+.
//   - `mostrarPredicciones` false solo en ABIERTO.
//   - CTA cambia por estado (combo / link / disabled / info).
//   - CTA urgente (<15 min al cierre) usa variant='urgent'.
//   - CTA disabled cuando ticketsUsuario === 10.
//   - El helper jamás menciona "neto" ni "rake" en los labels expuestos
//     (regla de UI del Bug #13 — un solo "Pozo").

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildTorneoDetailViewModel,
  MAX_TICKETS_POR_TORNEO_VIEW,
} from "@/lib/utils/torneo-detail-view";

const ROOT = resolve(__dirname, "..");
function readSrc(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf-8");
}

const NOW = new Date("2026-04-19T19:00:00-05:00");
const KICKOFF_LEJOS = new Date("2026-04-19T23:00:00-05:00"); // 4h away
const KICKOFF_URGENTE = new Date("2026-04-19T19:10:00-05:00"); // 10 min
const CIERRE_LEJOS = new Date(KICKOFF_LEJOS.getTime() - 5 * 60 * 1000);
const CIERRE_URGENTE = new Date(KICKOFF_URGENTE.getTime() - 5 * 60 * 1000);

describe("buildTorneoDetailViewModel — pozo mostrado", () => {
  it("ABIERTO con pozoNeto=0 usa pozoBruto × 0.88 floor", () => {
    const vm = buildTorneoDetailViewModel({
      estado: "ABIERTO",
      pozoBruto: 1000,
      pozoNeto: 0,
      totalInscritos: 100,
      entradaLukas: 10,
      cierreAt: CIERRE_LEJOS,
      ticketsUsuario: 0,
      tienePlaceholder: false,
      now: NOW,
    });
    expect(vm.pozoMostrado).toBe(880);
    // Hotfix #6: N=100 → M=10 (round(100*0.10)). 1° = 45% = 396 + residual.
    // La suma de todos los shares == pozoMostrado.
    expect(vm.premios).toHaveLength(10);
    expect(vm.pagados).toBe(10);
    const sumaPremios = vm.premios.reduce((a, p) => a + p.lukas, 0);
    expect(sumaPremios).toBe(880);
    // 1° >= 45% y residual va al 1°
    expect(vm.premios[0]!.lukas).toBeGreaterThanOrEqual(Math.floor(880 * 0.45));
    // Cada posición tiene su .posicion correcto 1-indexed
    expect(vm.premios[0]!.posicion).toBe(1);
    expect(vm.premios[9]!.posicion).toBe(10);
  });

  it("CERRADO con pozoNeto real lo usa directamente", () => {
    const vm = buildTorneoDetailViewModel({
      estado: "CERRADO",
      pozoBruto: 1000,
      pozoNeto: 880,
      totalInscritos: 100,
      entradaLukas: 10,
      cierreAt: CIERRE_LEJOS,
      ticketsUsuario: 0,
      tienePlaceholder: false,
      now: NOW,
    });
    expect(vm.pozoMostrado).toBe(880);
  });

  it("pozoBruto=33 → pozoMostrado=29 (floor(33*0.88))", () => {
    const vm = buildTorneoDetailViewModel({
      estado: "ABIERTO",
      pozoBruto: 33,
      pozoNeto: 0,
      totalInscritos: 6,
      entradaLukas: 5,
      cierreAt: CIERRE_LEJOS,
      ticketsUsuario: 0,
      tienePlaceholder: false,
      now: NOW,
    });
    expect(vm.pozoMostrado).toBe(29);
  });
});

describe("buildTorneoDetailViewModel — CTA por estado", () => {
  it("ABIERTO sin sesión → combo 'Crear combinada'", () => {
    const vm = buildTorneoDetailViewModel({
      estado: "ABIERTO",
      pozoBruto: 1000,
      pozoNeto: 0,
      totalInscritos: 10,
      entradaLukas: 10,
      cierreAt: CIERRE_LEJOS,
      ticketsUsuario: 0,
      tienePlaceholder: false,
      now: NOW,
    });
    expect(vm.cta).toEqual(
      expect.objectContaining({
        kind: "combo",
        variant: "primary",
      }),
    );
    expect((vm.cta as { label: string }).label).toMatch(/crear combinada/i);
  });

  it("ABIERTO urgente (<15 min al cierre) → variant='urgent' + copy 🔥", () => {
    const vm = buildTorneoDetailViewModel({
      estado: "ABIERTO",
      pozoBruto: 1000,
      pozoNeto: 0,
      totalInscritos: 10,
      entradaLukas: 10,
      cierreAt: CIERRE_URGENTE,
      ticketsUsuario: 0,
      tienePlaceholder: false,
      now: NOW,
    });
    expect((vm.cta as { variant: string }).variant).toBe("urgent");
    expect((vm.cta as { label: string }).label).toMatch(/🔥/);
  });

  it("ABIERTO con placeholder default → copy 'Editar mi combinada'", () => {
    const vm = buildTorneoDetailViewModel({
      estado: "ABIERTO",
      pozoBruto: 1000,
      pozoNeto: 0,
      totalInscritos: 10,
      entradaLukas: 10,
      cierreAt: CIERRE_LEJOS,
      ticketsUsuario: 1,
      tienePlaceholder: true,
      now: NOW,
    });
    expect((vm.cta as { label: string }).label).toMatch(/editar mi combinada/i);
  });

  it("ABIERTO con tickets >= MAX → disabled", () => {
    const vm = buildTorneoDetailViewModel({
      estado: "ABIERTO",
      pozoBruto: 1000,
      pozoNeto: 0,
      totalInscritos: 10,
      entradaLukas: 10,
      cierreAt: CIERRE_LEJOS,
      ticketsUsuario: MAX_TICKETS_POR_TORNEO_VIEW,
      tienePlaceholder: false,
      now: NOW,
    });
    expect(vm.cta.kind).toBe("disabled");
    expect((vm.cta as { label: string }).label).toMatch(/máximo/i);
  });

  it("CERRADO → link 'Ver ranking en vivo'", () => {
    const vm = buildTorneoDetailViewModel({
      estado: "CERRADO",
      pozoBruto: 1000,
      pozoNeto: 880,
      totalInscritos: 100,
      entradaLukas: 10,
      cierreAt: CIERRE_LEJOS,
      ticketsUsuario: 0,
      tienePlaceholder: false,
      now: NOW,
    });
    expect(vm.cta.kind).toBe("link");
    expect((vm.cta as { label: string }).label).toMatch(/ranking en vivo/i);
  });

  it("EN_JUEGO → link 'Ver ranking en vivo'", () => {
    const vm = buildTorneoDetailViewModel({
      estado: "EN_JUEGO",
      pozoBruto: 1000,
      pozoNeto: 880,
      totalInscritos: 100,
      entradaLukas: 10,
      cierreAt: CIERRE_LEJOS,
      ticketsUsuario: 0,
      tienePlaceholder: false,
      now: NOW,
    });
    expect(vm.cta.kind).toBe("link");
  });

  it("FINALIZADO → link 'Ver resultado final'", () => {
    const vm = buildTorneoDetailViewModel({
      estado: "FINALIZADO",
      pozoBruto: 1000,
      pozoNeto: 880,
      totalInscritos: 100,
      entradaLukas: 10,
      cierreAt: CIERRE_LEJOS,
      ticketsUsuario: 0,
      tienePlaceholder: false,
      now: NOW,
    });
    expect(vm.cta.kind).toBe("link");
    expect((vm.cta as { label: string }).label).toMatch(/resultado final/i);
  });

  it("CANCELADO → info (reembolso), sin CTA de acción", () => {
    const vm = buildTorneoDetailViewModel({
      estado: "CANCELADO",
      pozoBruto: 0,
      pozoNeto: 0,
      totalInscritos: 0,
      entradaLukas: 10,
      cierreAt: CIERRE_LEJOS,
      ticketsUsuario: 0,
      tienePlaceholder: false,
      now: NOW,
    });
    expect(vm.cta.kind).toBe("info");
    expect((vm.cta as { label: string }).label).toMatch(/cancelado/i);
  });
});

describe("buildTorneoDetailViewModel — estado resuelto", () => {
  it("ABIERTO con cierreAt pasado cae a CERRADO (jitter del cron)", () => {
    const vm = buildTorneoDetailViewModel({
      estado: "ABIERTO",
      pozoBruto: 1000,
      pozoNeto: 0,
      totalInscritos: 10,
      entradaLukas: 10,
      cierreAt: new Date(NOW.getTime() - 60 * 1000), // 1 min atrás
      ticketsUsuario: 0,
      tienePlaceholder: false,
      now: NOW,
    });
    expect(vm.estadoResuelto).toBe("CERRADO");
    expect(vm.cta.kind).toBe("link");
  });
});

describe("buildTorneoDetailViewModel — mostrarPredicciones", () => {
  it("ABIERTO → false (privacidad competitiva)", () => {
    const vm = buildTorneoDetailViewModel({
      estado: "ABIERTO",
      pozoBruto: 1000,
      pozoNeto: 0,
      totalInscritos: 10,
      entradaLukas: 10,
      cierreAt: CIERRE_LEJOS,
      ticketsUsuario: 0,
      tienePlaceholder: false,
      now: NOW,
    });
    expect(vm.mostrarPredicciones).toBe(false);
  });

  it("CERRADO / EN_JUEGO / FINALIZADO → true", () => {
    for (const estado of ["CERRADO", "EN_JUEGO", "FINALIZADO"] as const) {
      const vm = buildTorneoDetailViewModel({
        estado,
        pozoBruto: 1000,
        pozoNeto: 880,
        totalInscritos: 10,
        entradaLukas: 10,
        cierreAt: CIERRE_LEJOS,
        ticketsUsuario: 0,
        tienePlaceholder: false,
        now: NOW,
      });
      expect(vm.mostrarPredicciones).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// AST — /torneo/[id]/page.tsx + componentes
// ---------------------------------------------------------------------------

describe("/torneo/[id]/page.tsx — wiring del rediseño Bug #13", () => {
  const SRC = readSrc("app/(main)/torneo/[id]/page.tsx");

  it("importa buildTorneoDetailViewModel", () => {
    expect(SRC).toMatch(
      /import\s*\{[\s\S]*buildTorneoDetailViewModel[\s\S]*\}\s*from\s*["']@\/lib\/utils\/torneo-detail-view["']/,
    );
  });

  it("importa BackButton + InscritosList + TorneoStickyCTA", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*BackButton\s*\}\s*from\s*["']@\/components\/torneos\/BackButton["']/,
    );
    expect(SRC).toMatch(
      /import\s*\{\s*InscritosList\s*\}\s*from\s*["']@\/components\/torneos\/InscritosList["']/,
    );
    expect(SRC).toMatch(
      /import\s*\{\s*TorneoStickyCTA\s*\}\s*from\s*["']@\/components\/torneos\/TorneoStickyCTA["']/,
    );
  });

  it("usa listarInscritos del service (no duplica query)", () => {
    expect(SRC).toMatch(
      /import\s*\{[\s\S]*listarInscritos[\s\S]*\}\s*from\s*["']@\/lib\/services\/torneos\.service["']/,
    );
    expect(SRC).toMatch(/listarInscritos\s*\(\s*torneo\.id/);
  });

  it("renderea <BackButton fallbackHref='/matches'>", () => {
    expect(SRC).toMatch(/<BackButton\s+fallbackHref=["']\/matches["']/);
  });

  it("data-testid='torneo-pozo-hero' está presente (hero del pozo)", () => {
    expect(SRC).toMatch(/data-testid=["']torneo-pozo-hero["']/);
  });

  it("NO expone copy 'Pozo neto' / 'Pozo bruto' / 'Rake' al jugador", () => {
    // Regla del Bug #13: el jugador ve UN solo "Pozo". La palabra
    // `pozoNeto` / `pozoBruto` sí puede aparecer en identificadores
    // de código (ej. `torneo.pozoNeto`) o referencias a props —
    // lo que NO puede aparecer son los strings literales que
    // escribíamos en la copia de la UI. Los escaneamos como
    // "string entre comillas" (JSX attr o JS literal).
    const PROHIBIDO = [
      '"Pozo bruto"', "'Pozo bruto'",
      '"Pozo neto"', "'Pozo neto'",
      '"Rake"', "'Rake'",
      '"Rake (12%)"', "'Rake (12%)'",
      '"Pozo neto estimado"', "'Pozo neto estimado'",
    ];
    for (const lit of PROHIBIDO) {
      expect(SRC).not.toContain(lit);
    }
    // Extra: el "label="..."" de los BigStat viejos (Pozo bruto / Rake)
    // ya no debe existir.
    expect(SRC).not.toMatch(/label=["']Pozo\s+(?:neto|bruto)["']/i);
    expect(SRC).not.toMatch(/label=["']Rake/i);
  });
});

describe("TorneoStickyCTA.tsx — delega al ComboLauncher (no duplica fetch)", () => {
  const SRC = readSrc("components/torneos/TorneoStickyCTA.tsx");

  it("importa ComboLauncher (hook useComboOpener via ese wrapper)", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*ComboLauncher\s*\}\s*from\s*["']@\/components\/combo\/ComboLauncher["']/,
    );
  });

  it("NO duplica fetch a /api/v1/torneos (todo pasa por el launcher)", () => {
    expect(SRC).not.toMatch(/fetch\s*\(/);
    expect(SRC).not.toMatch(/authedFetch/);
  });

  it("renderea variantes por cta.kind: combo, link, disabled, info", () => {
    expect(SRC).toMatch(/cta\.kind\s*===\s*["']combo["']/);
    expect(SRC).toMatch(/cta\.kind\s*===\s*["']link["']/);
    expect(SRC).toMatch(/cta\.kind\s*===\s*["']disabled["']/);
    expect(SRC).toMatch(/cta\.kind\s*===\s*["']info["']/);
  });

  it("el variant='link' reemplaza __LIVE_HREF__ con el torneoId", () => {
    expect(SRC).toMatch(
      /cta\.href\.replace\s*\(\s*["']__LIVE_HREF__["']\s*,\s*`\/live-match\?torneoId=\$\{torneoId\}`/,
    );
  });
});

describe("InscritosList.tsx — mostrarPredicciones gate", () => {
  const SRC = readSrc("components/torneos/InscritosList.tsx");

  it("importa calcularNivel del helper", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*calcularNivel\s*\}\s*from\s*["']@\/lib\/utils\/nivel["']/,
    );
  });

  it("renderiza chips SOLO si mostrarPredicciones", () => {
    // Busca el wrap condicional por `mostrarPredicciones &&` antes del
    // bloque de chips.
    expect(SRC).toMatch(
      /\{\s*mostrarPredicciones\s*&&\s*\([\s\S]*?inscrito-predicciones/,
    );
  });

  it("muestra nivel del usuario (emoji + label)", () => {
    expect(SRC).toMatch(/nivel\.emoji/);
    expect(SRC).toMatch(/nivel\.label/);
  });

  it("usa tokens pred-correct-bg / pred-wrong-bg para los chips (no hex)", () => {
    expect(SRC).toMatch(/bg-pred-correct-bg\s+text-pred-correct/);
    expect(SRC).toMatch(/bg-pred-wrong-bg\s+text-pred-wrong/);
  });
});

describe("BackButton.tsx — navegación con fallback", () => {
  const SRC = readSrc("components/torneos/BackButton.tsx");

  it('declara "use client"', () => {
    expect(SRC).toMatch(/^\s*["']use client["']/);
  });

  it("usa router.back() cuando hay historial", () => {
    expect(SRC).toMatch(/window\.history\.length\s*>\s*1/);
    expect(SRC).toMatch(/router\.back\s*\(\s*\)/);
  });

  it("cae al fallback Link (por defecto /matches) si no hay historial", () => {
    expect(SRC).toMatch(/fallbackHref\s*=\s*["']\/matches["']/);
  });
});

// ---------------------------------------------------------------------------
// AST: service listarInscritos oculta predicciones si torneo ABIERTO
// ---------------------------------------------------------------------------

describe("torneos.service — listarInscritos privacidad competitiva", () => {
  const SRC = readSrc("lib/services/torneos.service.ts");

  it("exporta listarInscritos", () => {
    expect(SRC).toMatch(/export\s+async\s+function\s+listarInscritos/);
  });

  it("calcula `mostrarPredicciones` como `torneo.estado !== 'ABIERTO'`", () => {
    expect(SRC).toMatch(
      /mostrarPredicciones\s*=\s*torneo\.estado\s*!==\s*["']ABIERTO["']/,
    );
  });

  it("cuando mostrarPredicciones=false, el campo predicciones queda null", () => {
    // El helper setea `predicciones: mostrarPredicciones ? {...} : null`.
    expect(SRC).toMatch(
      /predicciones:\s*mostrarPredicciones\s*\?\s*\{[\s\S]*?\}\s*:\s*null/,
    );
  });

  it("agrupa tickets por usuarioId (multiple tickets por user)", () => {
    expect(SRC).toMatch(/porUsuario\s*=\s*new Map/);
  });
});
