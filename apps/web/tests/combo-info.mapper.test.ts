// Tests del mapper `GET /api/v1/torneos/:id → ComboTorneoInfo`.
// Cubre el Bug #2 fix: el hook compartido `useComboOpener` delega la
// derivación al mapper puro, entonces estos tests cubren el cálculo de
// primerPremioEstimado, fallback de pozoNeto durante ABIERTO y la
// detección de placeholder (miTicket) que ahorra el doble cobro.

import { describe, expect, it } from "vitest";
import {
  buildComboTorneoInfo,
  computeComboFooterState,
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
    // Hotfix #6: primerPremio usa 45% (lower bound de la curva top-heavy).
    // pozoBruto=1000 → pozoNeto fallback=880 → primerPremio=floor(880*0.45)=396
    const info = buildComboTorneoInfo(makePayload());
    expect(info!.primerPremioEstimado).toBe(396);
  });

  it("usa pozoNeto real cuando viene >0 (torneo CERRADO/EN_JUEGO)", () => {
    // pozoNeto real=900 → primerPremio=floor(900*0.45)=405
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
    expect(info!.primerPremioEstimado).toBe(405);
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
    // pozoBruto=33 → pozoNeto fallback=floor(33*0.88)=29 → primerPremio=floor(29*0.45)=13
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
    expect(info!.primerPremioEstimado).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// computeComboFooterState — hotfix Bug #1 (post-Sub-Sprint 5)
// ---------------------------------------------------------------------------
//
// El bug del balance "-5" se reproducía cuando el `useLukasStore` quedaba
// en su valor inicial (0) porque el layout no hidrataba el store desde la
// sesión NextAuth. La función pura derive el footer del modal y nunca
// permite renderizar un balance proyectado negativo. Cobertura completa
// de los edge cases del checklist a) – i) del PO.

describe("computeComboFooterState", () => {
  it("a) primer ticket: con placeholder NO cobra entrada y queda enabled", () => {
    // Usuario tiene 100 Lukas, ya se inscribió (placeholder). Al editar
    // su combinada el costo es 0 y el balance no se mueve.
    const f = computeComboFooterState({
      balance: 100,
      entradaLukas: 5,
      tienePlaceholder: true,
    });
    expect(f.costoLukas).toBe(0);
    expect(f.balanceDespues).toBe(100);
    expect(f.displayBalanceDespues).toBe(100);
    expect(f.balanceInsuficiente).toBe(false);
    expect(f.ctaMode).toBe("submit");
  });

  it("b) ticket adicional: sin placeholder cobra entrada y descuenta", () => {
    // Usuario con 50 Lukas crea su 2do ticket en un torneo de entrada 10.
    const f = computeComboFooterState({
      balance: 50,
      entradaLukas: 10,
      tienePlaceholder: false,
    });
    expect(f.costoLukas).toBe(10);
    expect(f.balanceDespues).toBe(40);
    expect(f.displayBalanceDespues).toBe(40);
    expect(f.balanceInsuficiente).toBe(false);
    expect(f.ctaMode).toBe("submit");
  });

  it("c) balance insuficiente sin placeholder: bloquea submit, modo comprar", () => {
    // Usuario con 5 Lukas intenta inscribirse a torneo de 10 sin placeholder.
    const f = computeComboFooterState({
      balance: 5,
      entradaLukas: 10,
      tienePlaceholder: false,
    });
    expect(f.balanceInsuficiente).toBe(true);
    expect(f.ctaMode).toBe("comprar");
    // El cálculo crudo da -5 pero la UI nunca debe mostrarlo
    expect(f.balanceDespues).toBe(-5);
    expect(f.displayBalanceDespues).toBe(0);
  });

  it("BUG REPRO: store sin hidratar (balance=0) NO muestra negativo", () => {
    // Reproducción exacta del bug del PO: store inicial = 0, entrada=5.
    // Antes del fix esto mostraba "Balance después: -5".
    const f = computeComboFooterState({
      balance: 0,
      entradaLukas: 5,
      tienePlaceholder: false,
    });
    expect(f.displayBalanceDespues).toBe(0); // nunca negativo en UI
    expect(f.balanceInsuficiente).toBe(true);
    expect(f.ctaMode).toBe("comprar");
  });

  it("balance exactamente igual a entrada: alcanza, queda en 0", () => {
    // Edge case: 5 Lukas, entrada 5, sin placeholder. Alcanza justo.
    const f = computeComboFooterState({
      balance: 5,
      entradaLukas: 5,
      tienePlaceholder: false,
    });
    expect(f.balanceInsuficiente).toBe(false);
    expect(f.balanceDespues).toBe(0);
    expect(f.displayBalanceDespues).toBe(0);
    expect(f.ctaMode).toBe("submit");
  });

  it("placeholder + balance 0: aún permite confirmar (entrada ya pagada)", () => {
    // Edge: usuario gastó todo su saldo después de inscribirse. Aún así
    // puede CONFIRMAR su combinada porque la entrada está cobrada.
    const f = computeComboFooterState({
      balance: 0,
      entradaLukas: 50,
      tienePlaceholder: true,
    });
    expect(f.balanceInsuficiente).toBe(false);
    expect(f.costoLukas).toBe(0);
    expect(f.ctaMode).toBe("submit");
  });

  it("entrada 0 (torneo gratis): nunca insuficiente", () => {
    const f = computeComboFooterState({
      balance: 0,
      entradaLukas: 0,
      tienePlaceholder: false,
    });
    expect(f.balanceInsuficiente).toBe(false);
    expect(f.ctaMode).toBe("submit");
  });
});
