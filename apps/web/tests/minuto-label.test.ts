// Tests del Hotfix #4 Bug #9: `formatMinutoLabel` mapea status codes
// de api-football a labels legibles. La UI del LiveHero nunca debe
// renderizar "?" — el mapper garantiza un string renderizable para
// cada input razonable y devuelve "—" como fallback.

import { describe, expect, it } from "vitest";
import {
  formatMinutoLabel,
  renderMinutoLabel,
} from "@/lib/utils/minuto-label";

describe("formatMinutoLabel — pre-partido", () => {
  it("NS (Not Started) → 'Por empezar'", () => {
    expect(formatMinutoLabel({ statusShort: "NS", elapsed: null })).toBe(
      "Por empezar",
    );
  });

  it("TBD → 'Por empezar'", () => {
    expect(formatMinutoLabel({ statusShort: "TBD", elapsed: null })).toBe(
      "Por empezar",
    );
  });

  it("PST (Postponed) → 'Aplazado'", () => {
    expect(formatMinutoLabel({ statusShort: "PST", elapsed: null })).toBe(
      "Aplazado",
    );
  });
});

describe("formatMinutoLabel — en curso", () => {
  it("1H con elapsed → '{minuto}'", () => {
    expect(formatMinutoLabel({ statusShort: "1H", elapsed: 23 })).toBe("23'");
  });

  it("1H sin elapsed → '1T' (inicio del partido)", () => {
    expect(formatMinutoLabel({ statusShort: "1H", elapsed: null })).toBe("1T");
  });

  it("HT (Halftime) → 'ENT'", () => {
    expect(formatMinutoLabel({ statusShort: "HT", elapsed: null })).toBe("ENT");
  });

  it("2H con elapsed → '67''", () => {
    expect(formatMinutoLabel({ statusShort: "2H", elapsed: 67 })).toBe("67'");
  });

  it("ET (prórroga) con elapsed → 'Prór. 95''", () => {
    expect(formatMinutoLabel({ statusShort: "ET", elapsed: 95 })).toBe(
      "Prór. 95'",
    );
  });

  it("P (Penalty Time) → 'Penales'", () => {
    expect(formatMinutoLabel({ statusShort: "P", elapsed: null })).toBe(
      "Penales",
    );
  });

  it("BT (Break Time prórroga) → 'ENT prór.'", () => {
    expect(formatMinutoLabel({ statusShort: "BT", elapsed: null })).toBe(
      "ENT prór.",
    );
  });

  it("SUSP → 'Suspendido'", () => {
    expect(formatMinutoLabel({ statusShort: "SUSP", elapsed: 34 })).toBe(
      "Suspendido",
    );
  });

  it("INT → 'Interrumpido'", () => {
    expect(formatMinutoLabel({ statusShort: "INT", elapsed: 70 })).toBe(
      "Interrumpido",
    );
  });
});

describe("formatMinutoLabel — partido terminado", () => {
  it("FT → 'FIN'", () => {
    expect(formatMinutoLabel({ statusShort: "FT", elapsed: 90 })).toBe("FIN");
  });

  it("AET (after extra time) → 'FIN (prór.)'", () => {
    expect(formatMinutoLabel({ statusShort: "AET", elapsed: 120 })).toBe(
      "FIN (prór.)",
    );
  });

  it("PEN (penales terminados) → 'FIN (pen.)'", () => {
    expect(formatMinutoLabel({ statusShort: "PEN", elapsed: 120 })).toBe(
      "FIN (pen.)",
    );
  });

  it("CANC → 'Cancelado'", () => {
    expect(formatMinutoLabel({ statusShort: "CANC", elapsed: null })).toBe(
      "Cancelado",
    );
  });

  it("ABD → 'Abandonado'", () => {
    expect(formatMinutoLabel({ statusShort: "ABD", elapsed: 80 })).toBe(
      "Abandonado",
    );
  });

  it("AWD / WO → 'Por retiro'", () => {
    expect(formatMinutoLabel({ statusShort: "AWD", elapsed: null })).toBe(
      "Por retiro",
    );
    expect(formatMinutoLabel({ statusShort: "WO", elapsed: null })).toBe(
      "Por retiro",
    );
  });
});

describe("formatMinutoLabel — fallbacks (Bug #9 NUNCA muestra '?')", () => {
  it("status null + elapsed número → '{elapsed}''", () => {
    expect(formatMinutoLabel({ statusShort: null, elapsed: 45 })).toBe("45'");
  });

  it("status null + elapsed null → '—' (NO '?')", () => {
    const out = formatMinutoLabel({ statusShort: null, elapsed: null });
    expect(out).toBe("—");
    expect(out).not.toBe("?");
  });

  it("status desconocido + elapsed número → '{elapsed}''", () => {
    expect(formatMinutoLabel({ statusShort: "XYZ", elapsed: 15 })).toBe("15'");
  });

  it("status desconocido + elapsed null → '—' (NO '?')", () => {
    const out = formatMinutoLabel({ statusShort: "XYZ", elapsed: null });
    expect(out).toBe("—");
    expect(out).not.toBe("?");
  });
});

describe("renderMinutoLabel — wrapper que garantiza fallback en UI", () => {
  it("label string → devuelve el string", () => {
    expect(renderMinutoLabel("23'")).toBe("23'");
  });

  it("label null → '—' (NO '?')", () => {
    const out = renderMinutoLabel(null);
    expect(out).toBe("—");
    expect(out).not.toBe("?");
  });

  it("label undefined → '—'", () => {
    expect(renderMinutoLabel(undefined)).toBe("—");
  });

  it("label vacío → '—'", () => {
    expect(renderMinutoLabel("")).toBe("—");
  });
});
