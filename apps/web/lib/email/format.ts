// Helpers de formato compartidos entre los templates de email (Lote H).

const TZ = "America/Lima";

/** "30 de abril de 2026" */
export function fmtFechaLarga(date: Date): string {
  try {
    return date.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: TZ,
    });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** "30/04/2026" */
export function fmtFechaCorta(date: Date): string {
  try {
    return date.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: TZ,
    });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Convierte céntimos de soles a "S/ X.XX". Si recibe un `number` ya en soles,
 * pasarlo directo y usar `fmtSolesNumero`.
 */
export function fmtSolesCentimos(centimos: number): string {
  return `S/ ${(centimos / 100).toFixed(2)}`;
}

export function fmtSolesNumero(soles: number): string {
  return `S/ ${soles.toFixed(2)}`;
}

const ORDINALES_ES: Record<number, string> = {
  1: "1°",
  2: "2°",
  3: "3°",
  4: "4°",
  5: "5°",
  6: "6°",
  7: "7°",
  8: "8°",
  9: "9°",
  10: "10°",
};

export function ordinalEs(n: number): string {
  return ORDINALES_ES[n] ?? `${n}°`;
}
