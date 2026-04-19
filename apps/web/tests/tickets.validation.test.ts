// Tests unitarios de validaciones de tickets. Cubren los helpers puros
// del servicio — los paths que tocan Prisma se prueban con el integration
// test `tests/tickets.integration.test.ts` (requiere DB).

import { describe, expect, it } from "vitest";
import {
  esPlaceholder,
  prediccionesIguales,
  MAX_TICKETS_POR_TORNEO,
} from "@/lib/services/tickets.service";
import { CrearTicketBodySchema } from "@/lib/services/tickets.schema";

const DEFAULT_PLACEHOLDER = {
  predResultado: "LOCAL" as const,
  predBtts: false,
  predMas25: false,
  predTarjetaRoja: false,
  predMarcadorLocal: 0,
  predMarcadorVisita: 0,
};

describe("esPlaceholder", () => {
  it("detecta un placeholder recién creado del Sub-Sprint 3", () => {
    expect(esPlaceholder(DEFAULT_PLACEHOLDER)).toBe(true);
  });

  it("ticket con predicciones reales NO es placeholder", () => {
    expect(
      esPlaceholder({
        predResultado: "EMPATE",
        predBtts: true,
        predMas25: false,
        predTarjetaRoja: true,
        predMarcadorLocal: 1,
        predMarcadorVisita: 1,
      }),
    ).toBe(false);
  });

  it("placeholder con marcador 0-0 pero btts true NO es placeholder", () => {
    expect(
      esPlaceholder({
        ...DEFAULT_PLACEHOLDER,
        predBtts: true,
      }),
    ).toBe(false);
  });
});

describe("prediccionesIguales", () => {
  it("detecta duplicados exactos", () => {
    const a = {
      predResultado: "VISITA" as const,
      predBtts: true,
      predMas25: false,
      predTarjetaRoja: true,
      predMarcadorLocal: 0,
      predMarcadorVisita: 2,
    };
    const b = {
      torneoId: "t1",
      ...a,
    };
    expect(prediccionesIguales(a, b)).toBe(true);
  });

  it("detecta diferencia en UNA de las predicciones", () => {
    const a = {
      predResultado: "LOCAL" as const,
      predBtts: true,
      predMas25: true,
      predTarjetaRoja: false,
      predMarcadorLocal: 2,
      predMarcadorVisita: 1,
    };
    const b = {
      torneoId: "t1",
      ...a,
      predBtts: false,
    };
    expect(prediccionesIguales(a, b)).toBe(false);
  });
});

describe("MAX_TICKETS_POR_TORNEO", () => {
  it("es 10 (regla de negocio §6)", () => {
    expect(MAX_TICKETS_POR_TORNEO).toBe(10);
  });
});

describe("CrearTicketBodySchema", () => {
  const valido = {
    torneoId: "cuid123",
    predResultado: "LOCAL",
    predBtts: true,
    predMas25: false,
    predTarjetaRoja: false,
    predMarcadorLocal: 2,
    predMarcadorVisita: 1,
  };

  it("acepta un body válido", () => {
    const res = CrearTicketBodySchema.safeParse(valido);
    expect(res.success).toBe(true);
  });

  it("rechaza predResultado inválido", () => {
    const res = CrearTicketBodySchema.safeParse({
      ...valido,
      predResultado: "OTRO",
    });
    expect(res.success).toBe(false);
  });

  it("rechaza marcador negativo", () => {
    const res = CrearTicketBodySchema.safeParse({
      ...valido,
      predMarcadorLocal: -1,
    });
    expect(res.success).toBe(false);
  });

  it("rechaza marcador > 9", () => {
    const res = CrearTicketBodySchema.safeParse({
      ...valido,
      predMarcadorVisita: 10,
    });
    expect(res.success).toBe(false);
  });

  it("rechaza tipos no-bool en BTTS", () => {
    const res = CrearTicketBodySchema.safeParse({
      ...valido,
      predBtts: "si",
    });
    expect(res.success).toBe(false);
  });

  it("rechaza torneoId vacío", () => {
    const res = CrearTicketBodySchema.safeParse({
      ...valido,
      torneoId: "",
    });
    expect(res.success).toBe(false);
  });
});
