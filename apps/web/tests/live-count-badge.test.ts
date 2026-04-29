// Tests del Hotfix #5 Bug #12: el badge "🔴 En vivo" del NavBar antes
// mostraba "2" hardcoded aunque no hubiera partidos en vivo. Ahora:
//
//   - NavBar pasa `initialLiveCount` SSR-derivado a NavLinks.
//   - LiveCountBadge lee de useLiveMatchesCount(initialCount) y devuelve
//     null cuando count === 0 — sin dot, sin "0", nada.
//   - useLiveMatchesCount polea `/api/v1/live/count` cada 30s (refresh).
//
// Lote 3 (Abr 2026): el BottomNav dejó de mostrar el badge (los items
// son Inicio/Partidos/Pronósticos/Comunidad/Perfil). El badge sigue vivo
// sólo en el NavBar desktop.
//
// Los tests son AST-level — vitest corre en environment `node` y no
// podemos renderizar. Escaneamos el source para asegurar que el contrato
// no se revierta en futuros cambios.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

function readSrc(relative: string): string {
  return readFileSync(resolve(ROOT, relative), "utf-8");
}

describe("LiveCountBadge.tsx — rendering condicional (Bug #12)", () => {
  const SRC = readSrc("components/layout/LiveCountBadge.tsx");

  it('declara "use client"', () => {
    expect(SRC).toMatch(/^\s*["']use client["']/);
  });

  it("usa useLiveMatchesCount(initialCount) para el count vivo", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*useLiveMatchesCount\s*\}\s*from\s*["']@\/hooks\/useLiveMatchesCount["']/,
    );
    expect(SRC).toMatch(/useLiveMatchesCount\s*\(\s*initialCount\s*\)/);
  });

  it("devuelve null cuando count <= 0 (regla dura del Bug #12)", () => {
    // Buscamos la guardia explícita, no solo `count > 0` en el render.
    expect(SRC).toMatch(/if\s*\(\s*count\s*<=\s*0\s*\)\s*return\s+null/);
  });

  it("renderiza '9+' para counts mayores a 9 (no números enormes)", () => {
    expect(SRC).toMatch(/count\s*>\s*9\s*\?\s*["']9\+["']/);
  });

  it("variant='desktop' lleva data-testid='live-count-badge'", () => {
    expect(SRC).toMatch(/data-testid=["']live-count-badge["']/);
  });

  it("usa tokens del design system (bg-urgent-critical, text-white)", () => {
    // Prohibido hardcodear hex en JSX (§14 del CLAUDE.md).
    expect(SRC).toMatch(/bg-urgent-critical/);
    expect(SRC).toMatch(/text-white/);
    expect(SRC).not.toMatch(/#FF2E2E|#ff2e2e/);
  });

  it("lleva aria-label descriptivo para accesibilidad", () => {
    expect(SRC).toMatch(/aria-label=\{`\$\{count\}\s+partidos\s+en\s+vivo`\}/);
  });
});

describe("useLiveMatchesCount.ts — hook con polling", () => {
  const SRC = readSrc("hooks/useLiveMatchesCount.ts");

  it('declara "use client"', () => {
    expect(SRC).toMatch(/^\s*["']use client["']/);
  });

  it("usa authedFetch para llamar /api/v1/live/count (§14 convención)", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*authedFetch\s*\}\s*from\s*["']@\/lib\/api-client["']/,
    );
    expect(SRC).toMatch(/authedFetch\s*\(\s*["']\/api\/v1\/live\/count["']\s*\)/);
  });

  it("polea cada 30s (POLL_INTERVAL_MS = 30_000)", () => {
    expect(SRC).toMatch(/POLL_INTERVAL_MS\s*=\s*30_000/);
    expect(SRC).toMatch(/setInterval\s*\(\s*fetchCount\s*,\s*POLL_INTERVAL_MS\s*\)/);
  });

  it("limpia el interval en el cleanup del effect", () => {
    expect(SRC).toMatch(/clearInterval\s*\(\s*interval\s*\)/);
  });

  it("recibe initialCount como prop y lo usa como valor inicial del state", () => {
    expect(SRC).toMatch(/useState\s*\(\s*initialCount\s*\)/);
  });
});

describe("/api/v1/live/count route — endpoint barato (Bug #12)", () => {
  const SRC = readSrc("app/api/v1/live/count/route.ts");

  it("importa contarLiveMatches del service", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*contarLiveMatches\s*\}\s*from\s*["']@\/lib\/services\/live-matches\.service["']/,
    );
  });

  it("devuelve { data: { count } } para ser consumido por el hook", () => {
    expect(SRC).toMatch(/Response\.json\s*\(\s*\{\s*data:\s*\{\s*count\s*\}/);
  });

  it("NO hace JOIN al ranking ni al pozo (endpoint barato)", () => {
    // Solo debe llamar a contarLiveMatches. Si aparece listarRanking,
    // obtenerLiveMatches, etc., es un smell.
    expect(SRC).not.toMatch(/listarRanking|obtenerLiveMatches|elegirTorneoPrincipal/);
  });
});

describe("live-matches.service.ts — contarLiveMatches (Bug #12)", () => {
  const SRC = readSrc("lib/services/live-matches.service.ts");

  it("exporta la función contarLiveMatches", () => {
    expect(SRC).toMatch(/export\s+async\s+function\s+contarLiveMatches/);
  });

  it("usa prisma.partido.count con el mismo filtro que obtenerLiveMatches", () => {
    // Preserva la regla del Bug #8: partidos sin torneos jugables NO se
    // cuentan. Si alguien relaja esto, el badge empieza a mostrar
    // partidos que el usuario no puede jugar.
    const section = SRC.slice(
      SRC.indexOf("contarLiveMatches"),
      SRC.indexOf("// ------", SRC.indexOf("contarLiveMatches")),
    );
    expect(section).toMatch(/prisma\.partido\.count/);
    expect(section).toMatch(/estado:\s*["']EN_VIVO["']/);
    expect(section).toMatch(
      /torneos:\s*\{\s*some:\s*\{\s*estado:\s*\{\s*not:\s*["']CANCELADO["']/,
    );
  });
});

describe("NavBar + NavLinks — wiring de initialLiveCount", () => {
  it("Layout (main) llama contarLiveMatches() y pasa initialLiveCount al NavBar", () => {
    const SRC = readSrc("app/(main)/layout.tsx");
    expect(SRC).toMatch(
      /import\s*\{\s*contarLiveMatches\s*\}\s*from\s*["']@\/lib\/services\/live-matches\.service["']/,
    );
    expect(SRC).toMatch(/<NavBar\s+initialLiveCount=\{liveCount\}/);
  });

  it("NavBar NO hardcodea LIVE_COUNT_PLACEHOLDER — Bug #12 REPRO", () => {
    // El string puede aparecer en el comentario del Bug #12 explicando
    // el fix. Strippeamos comentarios antes de buscar la declaración
    // real (`const LIVE_COUNT_PLACEHOLDER = ...`).
    const raw = readSrc("components/layout/NavBar.tsx");
    const sinComments = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(sinComments).not.toMatch(/LIVE_COUNT_PLACEHOLDER/);
  });

  it("NavLinks propaga initialLiveCount al LiveCountBadge (no un número literal)", () => {
    const SRC = readSrc("components/layout/NavLinks.tsx");
    expect(SRC).toMatch(
      /import\s*\{\s*LiveCountBadge\s*\}\s*from\s*["']@\/components\/layout\/LiveCountBadge["']/,
    );
    expect(SRC).toMatch(
      /<LiveCountBadge\s+initialCount=\{initialLiveCount\}/,
    );
    // El viejo render condicional `liveCount > 0 && <span>{liveCount}</span>`
    // vivía dentro de NavLinks. Se movió a LiveCountBadge — esta línea
    // ya no debe existir porque duplicaba el número sin guard.
    expect(SRC).not.toMatch(/\{\s*liveCount\s*>\s*0\s*&&[\s\S]*?\{\s*liveCount\s*\}/);
  });
});
