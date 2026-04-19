// Tests del helper `live-matches.service`. Cubre:
//   - elegirTorneoPrincipal: prioridad por estado y pozoBruto, ignora CANCELADO.
//   - obtenerLiveMatches: integration con DB — Bug #8 exige que cada
//     partido tenga al menos un torneo NO-CANCELADO; los partidos con
//     todos sus torneos cancelados NO aparecen (revert del Hotfix #3).
//
// Historia breve:
//   - Hotfix #1 Bug #2: filtro de partido.estado (no del torneo) para
//     tolerar jitter del cron cuando el torneo queda en ABIERTO.
//   - Hotfix #3: toleraba partidos con todos los torneos CANCELADO,
//     mostrándolos con "sin torneo activo". Revertido por Bug #8.
//   - Bug #8: obtenerLiveMatches ahora exige torneos.some(estado != CANCELADO).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@habla/db";
import {
  elegirTorneoPrincipal,
  obtenerLiveMatches,
} from "@/lib/services/live-matches.service";

describe("elegirTorneoPrincipal", () => {
  it("retorna null cuando la lista está vacía", () => {
    expect(elegirTorneoPrincipal([])).toBeNull();
  });

  it("retorna null cuando solo hay torneos CANCELADO (defensive, pre-filter del service ya excluye esto)", () => {
    expect(
      elegirTorneoPrincipal([
        fakeTorneo({ estado: "CANCELADO", pozoBruto: 1000 }),
      ]),
    ).toBeNull();
  });

  it("prioriza EN_JUEGO sobre CERRADO/FINALIZADO/ABIERTO", () => {
    const t = elegirTorneoPrincipal([
      fakeTorneo({ id: "abierto", estado: "ABIERTO", pozoBruto: 1000 }),
      fakeTorneo({ id: "cerrado", estado: "CERRADO", pozoBruto: 500 }),
      fakeTorneo({ id: "en_juego", estado: "EN_JUEGO", pozoBruto: 100 }),
      fakeTorneo({ id: "final", estado: "FINALIZADO", pozoBruto: 800 }),
    ]);
    expect(t?.id).toBe("en_juego");
  });

  it("dentro del mismo estado, el de mayor pozoBruto gana", () => {
    const t = elegirTorneoPrincipal([
      fakeTorneo({ id: "small", estado: "EN_JUEGO", pozoBruto: 100 }),
      fakeTorneo({ id: "big", estado: "EN_JUEGO", pozoBruto: 1000 }),
      fakeTorneo({ id: "mid", estado: "EN_JUEGO", pozoBruto: 500 }),
    ]);
    expect(t?.id).toBe("big");
  });

  it("BUG REPRO (Hotfix #1): partido con todos los torneos en ABIERTO igual elige uno", () => {
    // Cron atrasado: el partido ya está EN_VIVO pero los torneos no
    // transicionaron aún ABIERTO → CERRADO/EN_JUEGO. Debe elegir el
    // ABIERTO con mayor pozo (vs el alternativo de fallar y no mostrar).
    const t = elegirTorneoPrincipal([
      fakeTorneo({ id: "a", estado: "ABIERTO", pozoBruto: 50 }),
      fakeTorneo({ id: "b", estado: "ABIERTO", pozoBruto: 200 }),
    ]);
    expect(t).not.toBeNull();
    expect(t?.id).toBe("b");
  });

  it("ignora CANCELADO incluso si es el de mayor pozoBruto", () => {
    const t = elegirTorneoPrincipal([
      fakeTorneo({ id: "cancel", estado: "CANCELADO", pozoBruto: 9999 }),
      fakeTorneo({ id: "open", estado: "ABIERTO", pozoBruto: 50 }),
    ]);
    expect(t?.id).toBe("open");
  });
});

// ---------------------------------------------------------------------------
// Integration: requiere DATABASE_URL
// ---------------------------------------------------------------------------

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("obtenerLiveMatches — integration", () => {
  let partidoVivoConAbiertoId: string;
  let torneoAbiertoId: string;
  let partidoVivoSoloCanceladosId: string;
  let torneoCanceladoId: string;

  beforeAll(async () => {
    const suffix = Date.now().toString(36);

    // Caso A (Hotfix #1 Bug #2): partido EN_VIVO con torneo aún ABIERTO.
    const partidoA = await prisma.partido.create({
      data: {
        externalId: `bug8-live-a-${suffix}`,
        liga: "Liga 1 Perú",
        equipoLocal: "Test Live FC A",
        equipoVisita: "Otro Live FC A",
        fechaInicio: new Date(Date.now() - 10 * 60 * 1000),
        estado: "EN_VIVO",
        golesLocal: 1,
        golesVisita: 0,
      },
    });
    partidoVivoConAbiertoId = partidoA.id;
    const torneoA = await prisma.torneo.create({
      data: {
        nombre: "Live Test Torneo Abierto",
        tipo: "EXPRESS",
        entradaLukas: 5,
        partidoId: partidoA.id,
        cierreAt: new Date(Date.now() - 5 * 60 * 1000),
        estado: "ABIERTO",
        pozoBruto: 50,
      },
    });
    torneoAbiertoId = torneoA.id;

    // Caso B (Bug #8 REPRO): partido EN_VIVO pero TODOS los torneos
    // cancelados. Antes del Bug #8 aparecía con cartel "sin torneo
    // activo"; ahora NO debe aparecer en obtenerLiveMatches.
    const partidoB = await prisma.partido.create({
      data: {
        externalId: `bug8-live-b-${suffix}`,
        liga: "Liga 1 Perú",
        equipoLocal: "Cancelled FC",
        equipoVisita: "Zero Inscritos FC",
        fechaInicio: new Date(Date.now() - 10 * 60 * 1000),
        estado: "EN_VIVO",
        golesLocal: 0,
        golesVisita: 0,
      },
    });
    partidoVivoSoloCanceladosId = partidoB.id;
    const torneoB = await prisma.torneo.create({
      data: {
        nombre: "Live Test Torneo Cancelado",
        tipo: "EXPRESS",
        entradaLukas: 5,
        partidoId: partidoB.id,
        cierreAt: new Date(Date.now() - 60 * 60 * 1000),
        estado: "CANCELADO",
        pozoBruto: 0,
      },
    });
    torneoCanceladoId = torneoB.id;
  });

  afterAll(async () => {
    await prisma.torneo.deleteMany({
      where: { id: { in: [torneoAbiertoId, torneoCanceladoId] } },
    });
    await prisma.partido.deleteMany({
      where: {
        id: { in: [partidoVivoConAbiertoId, partidoVivoSoloCanceladosId] },
      },
    });
    await prisma.$disconnect();
  });

  it("incluye partido EN_VIVO cuyo torneo aún está ABIERTO (Hotfix #1)", async () => {
    const partidos = await obtenerLiveMatches({ limit: 50 });
    const matched = partidos.find((p) => p.id === partidoVivoConAbiertoId);
    expect(matched).toBeDefined();
    expect(matched!.estado).toBe("EN_VIVO");
    expect(matched!.torneos.length).toBe(1);
    expect(matched!.torneos[0]!.id).toBe(torneoAbiertoId);
    expect(matched!.torneos[0]!.estado).toBe("ABIERTO");
  });

  it("BUG #8 REPRO: partido EN_VIVO con TODOS los torneos CANCELADO NO aparece", async () => {
    const partidos = await obtenerLiveMatches({ limit: 50 });
    const matched = partidos.find((p) => p.id === partidoVivoSoloCanceladosId);
    // Revertido Hotfix #3: el partido ya NO es navegable desde /live-match.
    expect(matched).toBeUndefined();
  });

  it("el `include.torneos` excluye CANCELADO — el caller solo ve torneos jugables", async () => {
    const partidos = await obtenerLiveMatches({ limit: 50 });
    for (const p of partidos) {
      for (const t of p.torneos) {
        expect(t.estado).not.toBe("CANCELADO");
      }
    }
  });
});

describe.skipIf(hasDb)("obtenerLiveMatches — integration (skipped, sin DB)", () => {
  it("se saltea cuando DATABASE_URL no está configurada", () => {
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeTorneo(overrides: {
  id?: string;
  estado: "ABIERTO" | "CERRADO" | "EN_JUEGO" | "FINALIZADO" | "CANCELADO";
  pozoBruto: number;
}): Parameters<typeof elegirTorneoPrincipal>[0][0] {
  return {
    id: overrides.id ?? "tor_x",
    nombre: "Test",
    tipo: "EXPRESS",
    entradaLukas: 5,
    partidoId: "p_x",
    estado: overrides.estado,
    totalInscritos: 0,
    pozoBruto: overrides.pozoBruto,
    pozoNeto: 0,
    rake: 0,
    cierreAt: new Date(),
    distribPremios: null,
    creadoEn: new Date(),
  };
}
