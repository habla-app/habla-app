// Mapper puro: status + minuto + extra de api-football → label legible.
// Reimplementación simplificada (Abr 2026) — referencia Google Live Match
// card. Función única `getMinutoLabel({ statusShort, minuto, extra })` que
// devuelve un string listo para renderizar.
//
// Tabla de retornos por status:
//   NS              → "Por iniciar"
//   1H / 2H         → "{minuto}'" (si extra > 0 → "{minuto}+{extra}'")
//   HT              → "Medio tiempo"
//   ET              → "TE {minuto}'"
//   BT              → "Descanso TE"
//   P               → "Penales"
//   FT / AET / PEN  → "Final"
//   otro            → statusShort tal cual
//
// Si `statusShort` es null/undefined, devuelve "—".
//
// Status codes de api-football:
// https://www.api-football.com/documentation-v3#tag/Fixtures

export interface MinutoLabelInput {
  /** `fixture.status.short` de api-football. */
  statusShort: string | null | undefined;
  /** `fixture.status.elapsed` — minuto cursando en el partido. */
  minuto: number | null | undefined;
  /** `fixture.status.extra` — minutos de descuento/añadido sobre el cap
   *  de la fase. Solo aplica a 1H/2H (p.ej. 45+3'). */
  extra?: number | null | undefined;
}

/**
 * Deriva un label renderizable a partir del snapshot de estado. Pura —
 * no lee `Date.now()` ni dispara side-effects.
 */
export function getMinutoLabel(input: MinutoLabelInput): string {
  const { statusShort, minuto, extra } = input;

  if (statusShort === null || statusShort === undefined) return "—";

  switch (statusShort) {
    case "NS":
      return "Por iniciar";

    case "1H":
    case "2H": {
      if (minuto === null || minuto === undefined) return statusShort;
      if (typeof extra === "number" && extra > 0) {
        return `${minuto}+${extra}'`;
      }
      return `${minuto}'`;
    }

    case "HT":
      return "Medio tiempo";

    case "ET":
      if (minuto === null || minuto === undefined) return "TE";
      return `TE ${minuto}'`;

    case "BT":
      return "Descanso TE";

    case "P":
      return "Penales";

    case "FT":
    case "AET":
    case "PEN":
      return "Final";

    default:
      return statusShort;
  }
}
