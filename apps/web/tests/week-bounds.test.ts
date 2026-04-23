// Test de `getWeekBounds` — ventana lunes 00:00 → domingo 23:59 en la tz
// dada. Alimenta los widgets semanales del sidebar de /matches.

import { describe, expect, it } from "vitest";
import { getWeekBounds } from "@/lib/utils/datetime";

describe("getWeekBounds", () => {
  it("devuelve lunes 00:00 → domingo 23:59 para una fecha de jueves", () => {
    // Jueves 2026-04-23 15:00 Lima (20:00 UTC)
    const ref = new Date("2026-04-23T20:00:00Z");
    const { desde, hasta } = getWeekBounds(ref, "America/Lima");
    // Lunes 2026-04-20 00:00 Lima = 05:00 UTC
    expect(desde.toISOString()).toBe("2026-04-20T05:00:00.000Z");
    // Domingo 2026-04-26 23:59:59.999 Lima = 2026-04-27 04:59:59.999 UTC
    expect(hasta.toISOString()).toBe("2026-04-27T04:59:59.999Z");
  });

  it("domingo cuenta como parte de la semana que arranca el lunes previo", () => {
    // Domingo 2026-04-26 10:00 Lima (15:00 UTC)
    const ref = new Date("2026-04-26T15:00:00Z");
    const { desde, hasta } = getWeekBounds(ref, "America/Lima");
    expect(desde.toISOString()).toBe("2026-04-20T05:00:00.000Z");
    expect(hasta.toISOString()).toBe("2026-04-27T04:59:59.999Z");
  });

  it("lunes temprano arranca la nueva semana (no agrupa con la anterior)", () => {
    // Lunes 2026-04-27 08:00 Lima (13:00 UTC)
    const ref = new Date("2026-04-27T13:00:00Z");
    const { desde, hasta } = getWeekBounds(ref, "America/Lima");
    expect(desde.toISOString()).toBe("2026-04-27T05:00:00.000Z");
    expect(hasta.toISOString()).toBe("2026-05-04T04:59:59.999Z");
  });

  it("cruza fin de mes sin romper (lunes cae en mes previo)", () => {
    // Jueves 2026-05-07 → lunes 2026-05-04.
    const ref = new Date("2026-05-07T20:00:00Z");
    const { desde } = getWeekBounds(ref, "America/Lima");
    expect(desde.toISOString()).toBe("2026-05-04T05:00:00.000Z");
  });
});
