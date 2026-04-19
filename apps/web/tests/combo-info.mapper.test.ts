// Tests del mapper `GET /api/v1/torneos/:id → ComboTorneoInfo`.
// Cubre el Bug #2 fix: el hook compartido `useComboOpener` delega la
// derivación al mapper puro, entonces estos tests cubren el cálculo de
// primerPremioEstimado, fallback de pozoNeto durante ABIERTO y la
// detección de placeholder (miTicket) que ahorra el doble cobro.

import { describe, expect, it } from "vitest";
import {
  buildComboTorneoInfo,
  type TorneoApiResponse,
} from "@/components/combo/combo-info.mapper";

function makePayload(overrides?: Partial<TorneoApiResponse["data"]>): TorneoApiResponse {
  return {
    data: {
      torneo: {
        id: "tor_123",
        nombre: "Real Madrid vs Barcelona",
        entradaLukas: 10,
        pozoBruto: 1000,
        pozoNeto: 0,
        cierreAt: "2026-04-20T18:00:00.000Z",
        partido: {
          equipoLocal: "Real Madrid",
          equipoVisita: "Barcelona",
        },
      },
      miTicket: null,
      ...overrides,
    },
  };
}

describe("buildComboTorneoInfo", () => {
  it("returns null when payload has no data", () => {
    expect(buildComboTorneoInfo({})).toBeNull();
  });

  it("maps equipos y entrada directamente", () => {
    const info = buildComboTorneoInfo(makePayload());
    expect(info).not.toBeNull();
    expect(info!.torneoId).toBe("tor_123");
    expect(info!.equipoLocal).toBe("Real Madrid");
    expect(info!.equipoVisita).toBe("Barcelona");
    expect(info!.partidoNombre).toBe("Real Madrid vs Barcelona");
    expect(info!.entradaLukas).toBe(10);
    expect(info!.pozoBruto).toBe(1000);
  });

  it("usa pozoBruto × 0.88 como fallback cuando pozoNeto=0 (torneo ABIERTO)", () => {
    // pozoBruto=1000 → pozoNeto fallback=880 → primerPremio=880*0.35=308
    const info = buildComboTorneoInfo(makePayload());
    expect(info!.primerPremioEstimado).toBe(308);
  });

  it("usa pozoNeto real cuando viene >0 (torneo CERRADO/EN_JUEGO)", () => {
    // pozoNeto real=900 → primerPremio=900*0.35=315
    const info = buildComboTorneoInfo(
      makePayload({
        torneo: {
          id: "tor_456",
          nombre: "x",
          entradaLukas: 5,
          pozoBruto: 1000,
          pozoNeto: 900,
          cierreAt: "2026-04-20T18:00:00.000Z",
          partido: { equipoLocal: "A", equipoVisita: "B" },
        },
      }),
    );
    expect(info!.primerPremioEstimado).toBe(315);
  });

  it("tienePlaceholder=false cuando miTicket es null (primera inscripción)", () => {
    const info = buildComboTorneoInfo(makePayload());
    expect(info!.tienePlaceholder).toBe(false);
  });

  it("tienePlaceholder=true cuando miTicket existe (Sub-Sprint 3 placeholder)", () => {
    const info = buildComboTorneoInfo(
      makePayload({
        miTicket: { id: "ticket_abc" },
      }),
    );
    expect(info!.tienePlaceholder).toBe(true);
  });

  it("primerPremioEstimado se redondea hacia abajo (Math.floor)", () => {
    // pozoBruto=33 → pozoNeto fallback=floor(33*0.88)=29 → primerPremio=floor(29*0.35)=10.15 → 10
    const info = buildComboTorneoInfo(
      makePayload({
        torneo: {
          id: "tor_small",
          nombre: "x",
          entradaLukas: 1,
          pozoBruto: 33,
          pozoNeto: 0,
          cierreAt: "2026-04-20T18:00:00.000Z",
          partido: { equipoLocal: "A", equipoVisita: "B" },
        },
      }),
    );
    expect(info!.primerPremioEstimado).toBe(10);
  });
});
