// Mapper puro: status.short + elapsed de api-football → label legible
// para el hero del /live-match.
//
// Hotfix #4 Bug #9: antes el LiveHero renderizaba `{minuto ?? "?"}` y
// mostraba "?" literalmente cuando el poller no había enviado el
// número (primer render pre-WS, halftime sin elapsed, etc.). Ahora el
// backend entrega un string ya formateado (ej. "23'", "ENT", "FIN",
// "Prór. 95'", "Penales") y la UI solo lo renderiza. El fallback para
// null/undefined es "—", nunca "?".
//
// Status codes de api-football documentados en:
// https://www.api-football.com/documentation-v3#tag/Fixtures

/** Snapshot del estado en vivo de un partido, tal como viene del poller. */
export interface MinutoLabelInput {
  /** `fixture.status.short` de api-football — ver tabla abajo. */
  statusShort: string | null;
  /** `fixture.status.elapsed` — minuto cursando en el partido. */
  elapsed: number | null;
}

/**
 * Deriva un string renderizable para el hero del partido en vivo.
 *
 * Códigos comunes de api-football:
 *  - `NS`   → Not Started (aún no empezó; improbable en /live-match)
 *  - `1H`   → Primer tiempo en curso
 *  - `HT`   → Halftime (entretiempo)
 *  - `2H`   → Segundo tiempo en curso
 *  - `ET`   → Extra time (prórroga)
 *  - `BT`   → Break Time (entretiempo de prórroga)
 *  - `P`    → In Penalty Time (tanda de penales)
 *  - `SUSP` → Suspended
 *  - `INT`  → Interrupted
 *  - `FT`   → Full Time (90 min, sin prórroga)
 *  - `AET`  → After Extra Time (120 min)
 *  - `PEN`  → Penalties Ended (tanda de penales terminada)
 *  - `PST`  → Postponed
 *  - `CANC` → Cancelled
 *  - `ABD`  → Abandoned
 *  - `AWD`  → Technical Loss
 *  - `WO`   → Walkover
 *
 * Si recibimos un status desconocido y hay `elapsed`, mostramos
 * `{elapsed}'` como fallback razonable. Si no hay datos devolvemos
 * `"—"` — nunca `"?"`.
 */
export function formatMinutoLabel(input: MinutoLabelInput): string {
  const { statusShort, elapsed } = input;

  if (statusShort === null || statusShort === undefined) {
    if (typeof elapsed === "number") return `${elapsed}'`;
    return "—";
  }

  switch (statusShort) {
    // Pre-partido
    case "NS":
    case "TBD":
      return "Por empezar";
    case "PST":
      return "Aplazado";

    // En curso
    case "1H":
      return typeof elapsed === "number" ? `${elapsed}'` : "1T";
    case "HT":
      return "ENT"; /* entretiempo */
    case "2H":
      return typeof elapsed === "number" ? `${elapsed}'` : "2T";
    case "ET":
      return typeof elapsed === "number" ? `Prór. ${elapsed}'` : "Prórroga";
    case "BT":
      return "ENT prór."; /* break time de la prórroga */
    case "P":
      return "Penales";
    case "SUSP":
      return "Suspendido";
    case "INT":
      return "Interrumpido";

    // Fin del partido
    case "FT":
      return "FIN";
    case "AET":
      return "FIN (prór.)";
    case "PEN":
      return "FIN (pen.)";
    case "CANC":
      return "Cancelado";
    case "ABD":
      return "Abandonado";
    case "AWD":
    case "WO":
      return "Por retiro";

    default:
      if (typeof elapsed === "number") return `${elapsed}'`;
      return "—";
  }
}

/**
 * Convenience: recibe el label ya calculado y lo devuelve si es string;
 * si es null/undefined, devuelve "—". Útil en renders directos donde
 * el label viene de un payload externo (WS, endpoint, props).
 */
export function renderMinutoLabel(label: string | null | undefined): string {
  if (label === null || label === undefined || label === "") return "—";
  return label;
}
