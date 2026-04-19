import { afterEach, describe, it, expect, vi } from "vitest";
import {
  DEFAULT_TZ,
  formatCountdown,
  formatDayChipLabel,
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

describe("formatDayChipLabel", () => {
  it("devuelve Hoy/Mañana/Día-abreviado", () => {
    const now = new Date("2026-04-18T15:00:00Z"); // 10:00 Lima, miércoles
    const todayKey = getDayKey(now, "America/Lima");
    expect(formatDayChipLabel(todayKey, "America/Lima", now)).toBe("Hoy");
    const tomorrowKey = getDayKey(
      new Date(now.getTime() + 86_400_000),
      "America/Lima",
    );
    expect(formatDayChipLabel(tomorrowKey, "America/Lima", now)).toBe("Mañana");
    expect(formatDayChipLabel("2026-04-20", "America/Lima", now)).toMatch(
      /^[A-ZÁÉÍÓÚ][a-záéíóú]{2,3} 20$/,
    );
  });
});
