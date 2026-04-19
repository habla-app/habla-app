// Tests del helper `live-matches.service`. Cubre:
//   - elegirTorneoPrincipal: prioridad por estado y pozoBruto.
//   - obtenerLiveMatches: integration con DB — partidos EN_VIVO con
//     torneos solo en ABIERTO (cron atrasado) siguen apareciendo. Esto
//     era el Bug #2 del hotfix post-Sub-Sprint 5.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@habla/db";
import {
  elegirTorneoPrincipal,
  obtenerLiveMatches,
} from "@/lib/services/live-matches.service";

describe("elegirTorneoPrincipal", () => {
  it("retorna null cuando no hay torneos no-cancelados", () => {
    expect(elegirTorneoPrincipal([])).toBeNull();
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

  it("BUG REPRO: partido con todos los torneos en ABIERTO igual elige uno", () => {
    // Antes del hotfix Bug #2: si todos los torneos estaban ABIERTOS, el
    // filtro `where: { torneos: { some: { estado: { in: [EN_JUEGO,...] } } } }`
    // descartaba el partido entero. Ahora elegirTorneoPrincipal elige el
    // de mayor pozoBruto entre los ABIERTOS.
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

  it("HOTFIX #3 BUG REPRO: todos los torneos CANCELADO → retorna null (partido sin torneo activo)", () => {
    // Caso real en prod: Manchester City vs Arsenal con 3 torneos
    // cancelados por <2 inscritos. elegirTorneoPrincipal retorna null,
    // la página /live-match muestra el partido con un cartel "sin torneo
    // activo" en lugar de esconderlo con un empty state global.
    const t = elegirTorneoPrincipal([
      fakeTorneo({ id: "c1", estado: "CANCELADO", pozoBruto: 10 }),
      fakeTorneo({ id: "c2", estado: "CANCELADO", pozoBruto: 20 }),
      fakeTorneo({ id: "c3", estado: "CANCELADO", pozoBruto: 5 }),
    ]);
    expect(t).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Integration: requiere DATABASE_URL
// ---------------------------------------------------------------------------

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("obtenerLiveMatches — integration", () => {
  let partidoId: string;
  let torneoAbiertoId: string;

  beforeAll(async () => {
    // Sembrar: 1 partido EN_VIVO con su torneo aún en ABIERTO (cron
    // atrasado). Este es el escenario del Bug #2.
    const suffix = Date.now().toString(36);
    const partido = await prisma.partido.create({
      data: {
        externalId: `live-test-${suffix}`,
        liga: "Liga 1 Perú",
        equipoLocal: "Test Live FC",
        equipoVisita: "Otro Live FC",
        fechaInicio: new Date(Date.now() - 10 * 60 * 1000),
        estado: "EN_VIVO",
        golesLocal: 1,
        golesVisita: 0,
      },
    });
    partidoId = partido.id;

    const torneo = await prisma.torneo.create({
      data: {
        nombre: "Live Test Torneo",
        tipo: "EXPRESS",
        entradaLukas: 5,
        partidoId,
        cierreAt: new Date(Date.now() - 5 * 60 * 1000),
        estado: "ABIERTO", // ← intencional: cron no llegó a cerrar
        pozoBruto: 50,
      },
    });
    torneoAbiertoId = torneo.id;
  });

  afterAll(async () => {
    await prisma.torneo.deleteMany({ where: { id: torneoAbiertoId } });
    await prisma.partido.deleteMany({ where: { id: partidoId } });
    await prisma.$disconnect();
  });

  it("BUG REPRO: incluye partido EN_VIVO cuyo torneo aún está ABIERTO", async () => {
    const partidos = await obtenerLiveMatches({ limit: 50 });
    const matched = partidos.find((p) => p.id === partidoId);
    expect(matched).toBeDefined();
    expect(matched!.estado).toBe("EN_VIVO");
    expect(matched!.torneos.length).toBe(1);
    expect(matched!.torneos[0]!.id).toBe(torneoAbiertoId);
    expect(matched!.torneos[0]!.estado).toBe("ABIERTO");
  });

  it("elegirTorneoPrincipal devuelve el torneo ABIERTO (único candidato)", async () => {
    const partidos = await obtenerLiveMatches({ limit: 50 });
    const matched = partidos.find((p) => p.id === partidoId);
    const principal = elegirTorneoPrincipal(matched!.torneos);
    expect(principal?.id).toBe(torneoAbiertoId);
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
