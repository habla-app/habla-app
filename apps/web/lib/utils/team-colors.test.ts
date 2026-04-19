import { describe, it, expect } from "vitest";
import { getTeamColor, getTeamInitials } from "./team-colors";

describe("getTeamColor", () => {
  it("es determinista: mismo seed → mismo color", () => {
    const a = getTeamColor("team-123");
    const b = getTeamColor("team-123");
    expect(a).toEqual(b);
  });

  it("seeds distintos pueden caer en colores distintos", () => {
    // No garantizamos unicidad con 12 slots, pero al menos algunas deben
    // diferir. Testeamos que no siempre cae en el mismo índice.
    const names = [
      "Sporting Cristal",
      "Liverpool",
      "Manchester City",
      "Real Madrid",
      "Alianza Lima",
      "FC Barcelona",
      "Inter",
      "Bayern",
    ];
    const distinct = new Set(names.map((n) => getTeamColor(n).bg));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("devuelve siempre { bg, fg } con hex válidos", () => {
    const c = getTeamColor("anything");
    expect(c.bg).toMatch(/^#[0-9A-F]{6}$/i);
    expect(c.fg).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe("getTeamInitials", () => {
  it("extrae iniciales de dos palabras", () => {
    expect(getTeamInitials("Sporting Cristal")).toBe("SC");
    expect(getTeamInitials("Manchester City")).toBe("MC");
    expect(getTeamInitials("Real Madrid")).toBe("RM");
  });

  it("usa las dos primeras letras de una palabra suelta", () => {
    expect(getTeamInitials("Liverpool")).toBe("LI");
    expect(getTeamInitials("River")).toBe("RI");
  });

  it('devuelve "?" para cadena vacía o solo espacios', () => {
    expect(getTeamInitials("")).toBe("?");
    expect(getTeamInitials("   ")).toBe("?");
  });

  it("ignora espacios extra entre palabras", () => {
    expect(getTeamInitials("  Alianza   Lima  ")).toBe("AL");
  });
});
