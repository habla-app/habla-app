// Tests del adapter de chips de predicción (componente visual puro).
// Cubre cada estado posible: pending / correct / wrong.

import { describe, expect, it } from "vitest";
import { resolvePrediccionesChips } from "@/components/tickets/adapter";
import type { TicketConContexto } from "@/components/tickets/adapter";

const now = new Date("2026-04-19T12:00:00Z");

function mkTicket(overrides: Partial<TicketConContexto>): TicketConContexto {
  return {
    id: "t1",
    usuarioId: "u1",
    torneoId: "to1",
    predResultado: "LOCAL",
    predBtts: true,
    predMas25: true,
    predTarjetaRoja: false,
    predMarcadorLocal: 2,
    predMarcadorVisita: 1,
    puntosTotal: 0,
    puntosResultado: 0,
    puntosBtts: 0,
    puntosMas25: 0,
    puntosTarjeta: 0,
    puntosMarcador: 0,
    posicionFinal: null,
    premioLukas: 0,
    creadoEn: now,
    torneo: {
      id: "to1",
      nombre: "X",
      tipo: "EXPRESS",
      entradaLukas: 5,
      partidoId: "p1",
      estado: "EN_JUEGO",
      totalInscritos: 0,
      pozoBruto: 0,
      pozoNeto: 0,
      rake: 0,
      cierreAt: now,
      distribPremios: null,
      creadoEn: now,
      partido: {
        id: "p1",
        externalId: "ext",
        liga: "X",
        equipoLocal: "Local",
        equipoVisita: "Visita",
        fechaInicio: now,
        estado: "EN_VIVO",
        golesLocal: null,
        golesVisita: null,
        btts: null,
        mas25Goles: null,
        huboTarjetaRoja: null,
        round: null,
        venue: null,
        creadoEn: now,
      },
      ...(overrides.torneo ?? {}),
    },
    ...overrides,
  } as TicketConContexto;
}

describe("resolvePrediccionesChips", () => {
  it("todo pending con partido PROGRAMADO sin goles", () => {
    const t = mkTicket({
      torneo: {
        ...mkTicket({}).torneo,
        partido: {
          ...mkTicket({}).torneo.partido,
          estado: "PROGRAMADO",
        },
      },
    });
    const chips = resolvePrediccionesChips(t, "Local", "Visita");
    expect(chips.every((c) => c.estado === "pending")).toBe(true);
  });

  it("FINALIZADO 2-1 con predicciones exactas → todo correct", () => {
    const t = mkTicket({
      predResultado: "LOCAL",
      predBtts: true,
      predMas25: true,
      predTarjetaRoja: false,
      predMarcadorLocal: 2,
      predMarcadorVisita: 1,
      torneo: {
        ...mkTicket({}).torneo,
        partido: {
          ...mkTicket({}).torneo.partido,
          estado: "FINALIZADO",
          golesLocal: 2,
          golesVisita: 1,
          btts: true,
          mas25Goles: true,
          huboTarjetaRoja: false,
        },
      },
    });
    const chips = resolvePrediccionesChips(t, "Local", "Visita");
    expect(chips.every((c) => c.estado === "correct")).toBe(true);
  });

  it("EN_VIVO con 1-1 confirma BTTS pero resultado sigue pending", () => {
    const t = mkTicket({
      torneo: {
        ...mkTicket({}).torneo,
        partido: {
          ...mkTicket({}).torneo.partido,
          estado: "EN_VIVO",
          golesLocal: 1,
          golesVisita: 1,
        },
      },
    });
    const chips = resolvePrediccionesChips(t, "Local", "Visita");
    const resultado = chips[0]!;
    const btts = chips[1]!;
    expect(resultado.estado).toBe("pending");
    expect(btts.estado).toBe("correct");
  });

  it("tarjeta roja en vivo: predTarjetaRoja=true → correct inmediato", () => {
    const t = mkTicket({
      predTarjetaRoja: true,
      torneo: {
        ...mkTicket({}).torneo,
        partido: {
          ...mkTicket({}).torneo.partido,
          estado: "EN_VIVO",
          golesLocal: 1,
          golesVisita: 0,
          huboTarjetaRoja: true,
        },
      },
    });
    const chips = resolvePrediccionesChips(t, "Local", "Visita");
    expect(chips[3]!.estado).toBe("correct");
  });
});
