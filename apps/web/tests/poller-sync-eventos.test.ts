// Tests antidrift para la sincronización de eventos del poller (Hotfix #6
// Ítem 2). Los tests son AST-level porque `sincronizarEventos` es
// internal al módulo y toca Prisma directamente. Un integration test
// con BD real vive en el describe.runIf(DATABASE_URL) de más abajo
// (skip en CI sin DB).

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

const POLLER_SRC = fs.readFileSync(
  path.join(ROOT, "lib", "services", "poller-partidos.job.ts"),
  "utf8",
);

const EVENTS_HOOK_SRC = fs.readFileSync(
  path.join(ROOT, "hooks", "useEventosPartido.ts"),
  "utf8",
);

const EVENTS_TYPES_SRC = fs.readFileSync(
  path.join(ROOT, "lib", "realtime", "events.ts"),
  "utf8",
);

describe("poller-partidos.job.ts — sincronización de eventos", () => {
  it("define sincronizarEventos (reemplazo de procesarEventos)", () => {
    expect(POLLER_SRC).toMatch(/async\s+function\s+sincronizarEventos/);
  });

  it("devuelve `{ nuevos, invalidados }` desde sincronizarEventos", () => {
    expect(POLLER_SRC).toMatch(/return\s*\{\s*\n?\s*nuevos,?/);
    expect(POLLER_SRC).toMatch(/invalidados/);
  });

  it("usa deleteMany para los eventos invalidados", () => {
    expect(POLLER_SRC).toMatch(
      /prisma\.eventoPartido\.deleteMany/,
    );
  });

  it("preserva el evento sintético FIN_PARTIDO al sincronizar", () => {
    // Si key empieza con `FIN_PARTIDO|`, no se marca como invalidado.
    expect(POLLER_SRC).toMatch(
      /startsWith\s*\(\s*`\$\{TIPO_EVENTO\.FIN_PARTIDO\}\|`\s*\)/,
    );
  });

  it("emite `partido:evento-invalidado` para cada key eliminada", () => {
    expect(POLLER_SRC).toMatch(/emitirPartidoEventoInvalidado/);
  });

  it("revierte huboTarjetaRoja a false cuando el API ya no reporta roja", () => {
    expect(POLLER_SRC).toMatch(
      /if\s*\(\s*!hayRoja\s*&&\s*partido\.huboTarjetaRoja\s*\)\s*cambios\.huboTarjetaRoja\s*=\s*false/,
    );
  });

  it("incluye eventosInvalidados en PollerTickResult", () => {
    expect(POLLER_SRC).toMatch(/eventosInvalidados:\s*number/);
  });

  it("cuenta invalidación como cambio relevante para recalc (tickets pueden cambiar)", () => {
    expect(POLLER_SRC).toMatch(
      /eventosInvalidados\.length\s*>\s*0/,
    );
  });
});

describe("events.ts — tipo PartidoEventoInvalidadoPayload", () => {
  it("exporta el tipo con torneoId + partidoId + naturalKey", () => {
    expect(EVENTS_TYPES_SRC).toMatch(
      /export\s+interface\s+PartidoEventoInvalidadoPayload/,
    );
    expect(EVENTS_TYPES_SRC).toMatch(/naturalKey:\s*string/);
  });

  it("registra `partido:evento-invalidado` en ServerToClientEvents", () => {
    expect(EVENTS_TYPES_SRC).toMatch(
      /"partido:evento-invalidado":\s*\(payload:\s*PartidoEventoInvalidadoPayload\)\s*=>\s*void/,
    );
  });
});

describe("useEventosPartido — listener para evento-invalidado", () => {
  it('se suscribe a "partido:evento-invalidado"', () => {
    expect(EVENTS_HOOK_SRC).toMatch(
      /socket\.on\s*\(\s*["']partido:evento-invalidado["']/,
    );
  });

  it("filtra la timeline removiendo el evento por naturalKey", () => {
    expect(EVENTS_HOOK_SRC).toMatch(/payload\.naturalKey/);
    expect(EVENTS_HOOK_SRC).toMatch(/prev\.filter/);
  });

  it("hace cleanup del listener al unmount", () => {
    expect(EVENTS_HOOK_SRC).toMatch(
      /socket\.off\s*\(\s*["']partido:evento-invalidado["']/,
    );
  });
});
