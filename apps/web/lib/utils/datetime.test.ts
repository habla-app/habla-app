import { afterEach, describe, it, expect, vi } from "vitest";
import {
  DEFAULT_TZ,
  formatCountdown,
  formatDayChip,
  formatKickoff,
  getDayBounds,
  getDayKey,
  urgencyLevel,
} from "./datetime";

describe("getDayKey", () => {
  it("devuelve YYYY-MM-DD en la tz dada", () => {
    // 2026-04-19 01:00 UTC es todavía 2026-04-18 20:00 en Lima (UTC-5).
    const d = new Date("2026-04-19T01:00:00Z");
    expect(getDayKey(d, "America/Lima")).toBe("2026-04-18");
    expect(getDayKey(d, "UTC")).toBe("2026-04-19");
  });
});

describe("getDayBounds", () => {
  it("calcula el rango UTC del día local en Lima", () => {
    const { desde, hasta } = getDayBounds("2026-04-19", "America/Lima");
    // 00:00 local Lima = 05:00 UTC
    expect(desde.toISOString()).toBe("2026-04-19T05:00:00.000Z");
    expect(hasta.toISOString()).toBe("2026-04-20T04:59:59.999Z");
  });

  it("usa la tz por default cuando no se pasa argumento", () => {
    const { desde } = getDayBounds("2026-04-19");
    expect(DEFAULT_TZ).toBe("America/Lima");
    expect(desde.toISOString()).toBe("2026-04-19T05:00:00.000Z");
  });
});

describe("urgencyLevel", () => {
  it("clasifica por minutos hasta el cierre", () => {
    const now = Date.now();
    expect(urgencyLevel(new Date(now + 10 * 60_000))).toBe("crit");
    expect(urgencyLevel(new Date(now + 30 * 60_000))).toBe("high");
    expect(urgencyLevel(new Date(now + 90 * 60_000))).toBe("med");
    expect(urgencyLevel(new Date(now + 5 * 3_600_000))).toBe("low");
  });
});

describe("formatCountdown", () => {
  it('devuelve "Cerrado" si ya pasó', () => {
    expect(formatCountdown(new Date(Date.now() - 60_000))).toBe("Cerrado");
  });

  it("formatea <60 min en minutos", () => {
    const target = new Date(Date.now() + 14 * 60_000 + 30_000);
    expect(formatCountdown(target)).toBe("Cierra en 14 min");
  });

  it("formatea horas y minutos con padding", () => {
    const target = new Date(Date.now() + (2 * 60 + 5) * 60_000 + 30_000);
    expect(formatCountdown(target)).toBe("Cierra en 2h 05m");
  });
});

describe("formatKickoff", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("usa HOY para el día en curso en la tz dada", () => {
    // Instante ahora: 2026-04-18 21:00 Lima (02:00 UTC del 19).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T02:00:00Z"));
    // Kickoff: 2026-04-18 22:30 Lima (03:30 UTC del 19) — mismo día Lima.
    const kickoffLocal = new Date("2026-04-19T03:30:00Z");
    expect(formatKickoff(kickoffLocal, "America/Lima")).toBe("HOY 22:30");
  });

  it("usa MAÑANA para el día siguiente en la tz dada", () => {
    // Ahora: 2026-04-18 10:00 Lima (15:00 UTC).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T15:00:00Z"));
    // Kickoff: 2026-04-19 07:55 Lima = 12:55 UTC — mañana en Lima.
    const kickoff = new Date("2026-04-19T12:55:00Z");
    expect(formatKickoff(kickoff, "America/Lima")).toBe("MAÑANA 07:55");
  });
});

describe("formatDayChip", () => {
  it("devuelve Hoy para el día en curso en la tz dada", () => {
    const now = new Date("2026-04-18T15:00:00Z"); // 10:00 Lima, sábado
    const todayKey = getDayKey(now, "America/Lima");
    expect(formatDayChip(todayKey, "America/Lima", now)).toBe("Hoy");
  });

  it("devuelve Mañana para el día siguiente", () => {
    const now = new Date("2026-04-18T15:00:00Z");
    const tomorrowKey = getDayKey(
      new Date(now.getTime() + 86_400_000),
      "America/Lima",
    );
    expect(formatDayChip(tomorrowKey, "America/Lima", now)).toBe("Mañana");
  });

  it("usa formato corto (sin mes) para días dentro del mes actual", () => {
    // Hoy: sábado 18 de abril. Día a formatear: lunes 20 de abril (mismo mes).
    const now = new Date("2026-04-18T15:00:00Z");
    expect(formatDayChip("2026-04-20", "America/Lima", now)).toBe("Lun 20");
    expect(formatDayChip("2026-04-29", "America/Lima", now)).toBe("Mié 29");
  });

  it("incluye el mes abreviado cuando el día cae en un mes distinto al actual", () => {
    // Hoy: sábado 18 de abril. Día a formatear: viernes 1 de mayo.
    const now = new Date("2026-04-18T15:00:00Z");
    expect(formatDayChip("2026-05-01", "America/Lima", now)).toBe("Vie 1 may");
    // Más lejos: 15 de mayo.
    expect(formatDayChip("2026-05-15", "America/Lima", now)).toBe("Vie 15 may");
  });

  it("cruza de diciembre a enero del año siguiente", () => {
    // Hoy: miércoles 30 de diciembre 2026. Día: viernes 1 de enero 2027.
    const now = new Date("2026-12-30T18:00:00Z"); // 13:00 Lima
    expect(formatDayChip("2027-01-01", "America/Lima", now)).toBe("Vie 1 ene");
    // 2027-01-05 → martes 5 ene.
    expect(formatDayChip("2027-01-05", "America/Lima", now)).toBe("Mar 5 ene");
  });
});
