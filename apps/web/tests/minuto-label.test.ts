// Tests del mapper puro `getMinutoLabel` — reimplementación simplificada
// (Abr 2026). Referencia: cómo Google muestra el minuto en su Live Match.
// La UI nunca debe pintar "?" — fallback es "—" cuando no hay statusShort.

import { describe, expect, it } from "vitest";
import { getMinutoLabel } from "@/lib/utils/minuto-label";

describe("getMinutoLabel — pre-partido", () => {
  it("NS → 'Por iniciar'", () => {
    expect(getMinutoLabel({ statusShort: "NS", minuto: null })).toBe(
      "Por iniciar",
    );
  });
});

describe("getMinutoLabel — 1H / 2H (fases regulares)", () => {
  it("1H con minuto → '{minuto}''", () => {
    expect(getMinutoLabel({ statusShort: "1H", minuto: 23 })).toBe("23'");
  });

  it("1H sin minuto → statusShort crudo", () => {
    expect(getMinutoLabel({ statusShort: "1H", minuto: null })).toBe("1H");
  });

  it("2H con minuto → '{minuto}''", () => {
    expect(getMinutoLabel({ statusShort: "2H", minuto: 67 })).toBe("67'");
  });

  it("1H con extra > 0 → '{minuto}+{extra}''", () => {
    expect(
      getMinutoLabel({ statusShort: "1H", minuto: 45, extra: 3 }),
    ).toBe("45+3'");
  });

  it("2H con extra > 0 → '{minuto}+{extra}''", () => {
    expect(
      getMinutoLabel({ statusShort: "2H", minuto: 90, extra: 5 }),
    ).toBe("90+5'");
  });

  it("1H con extra=0 no suma el '+0'", () => {
    expect(
      getMinutoLabel({ statusShort: "1H", minuto: 30, extra: 0 }),
    ).toBe("30'");
  });

  it("2H con extra=null no suma", () => {
    expect(
      getMinutoLabel({ statusShort: "2H", minuto: 80, extra: null }),
    ).toBe("80'");
  });
});

describe("getMinutoLabel — entretiempos y prórroga", () => {
  it("HT → 'Medio tiempo'", () => {
    expect(getMinutoLabel({ statusShort: "HT", minuto: null })).toBe(
      "Medio tiempo",
    );
  });

  it("ET con minuto → 'TE {minuto}''", () => {
    expect(getMinutoLabel({ statusShort: "ET", minuto: 95 })).toBe("TE 95'");
  });

  it("ET sin minuto → 'TE'", () => {
    expect(getMinutoLabel({ statusShort: "ET", minuto: null })).toBe("TE");
  });

  it("BT → 'Descanso TE'", () => {
    expect(getMinutoLabel({ statusShort: "BT", minuto: null })).toBe(
      "Descanso TE",
    );
  });

  it("P → 'Penales'", () => {
    expect(getMinutoLabel({ statusShort: "P", minuto: null })).toBe("Penales");
  });
});

describe("getMinutoLabel — fin del partido", () => {
  it("FT → 'Final'", () => {
    expect(getMinutoLabel({ statusShort: "FT", minuto: 90 })).toBe("Final");
  });

  it("AET → 'Final'", () => {
    expect(getMinutoLabel({ statusShort: "AET", minuto: 120 })).toBe("Final");
  });

  it("PEN → 'Final'", () => {
    expect(getMinutoLabel({ statusShort: "PEN", minuto: 120 })).toBe("Final");
  });
});

describe("getMinutoLabel — fallbacks y status desconocidos", () => {
  it("status null → '—'", () => {
    expect(getMinutoLabel({ statusShort: null, minuto: 45 })).toBe("—");
  });

  it("status desconocido → statusShort tal cual", () => {
    expect(getMinutoLabel({ statusShort: "SUSP", minuto: 34 })).toBe("SUSP");
    expect(getMinutoLabel({ statusShort: "PST", minuto: null })).toBe("PST");
    expect(getMinutoLabel({ statusShort: "CANC", minuto: null })).toBe("CANC");
  });

  it("NUNCA retorna '?' como fallback", () => {
    expect(getMinutoLabel({ statusShort: null, minuto: null })).not.toBe("?");
    expect(getMinutoLabel({ statusShort: "XYZ", minuto: null })).not.toBe("?");
  });
});
