// Utilidades de fecha con timezone explícito. Default del proyecto:
// America/Lima (CLAUDE.md §14 — Convenciones de código).
//
// Regla dura: prohibido usar `toLocaleString` / `toLocaleDateString` /
// `toLocaleTimeString` sin `timeZone` explícito en apps/web/. Todo
// formateo de fechas pasa por los helpers de este archivo.

export const DEFAULT_TZ = "America/Lima";

export function getUserTimezone(): string {
  if (typeof window === "undefined") return DEFAULT_TZ;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

/**
 * Formatea la hora de arranque de un partido. Ejemplos:
 *   HOY 19:30
 *   MAÑANA 15:00
 *   SÁB 12 · 20:45
 */
export function formatKickoff(
  date: Date | string,
  tz: string = DEFAULT_TZ,
): string {
  const kickoff = new Date(date);
  const now = new Date();

  const time = kickoff.toLocaleTimeString("es-PE", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (isSameDay(kickoff, now, tz)) return `HOY ${time}`;
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (isSameDay(kickoff, tomorrow, tz)) return `MAÑANA ${time}`;

  const dayShort = kickoff
    .toLocaleDateString("es-PE", {
      timeZone: tz,
      weekday: "short",
      day: "2-digit",
    })
    .toUpperCase()
    .replace(/\./g, "");
  return `${dayShort} · ${time}`;
}

/**
 * Countdown al cierre de un torneo en términos humanos. Ejemplos:
 *   Cierra en 14 min
 *   Cierra en 2h 15m
 *   Cierra en 18h 55m
 *   Cerrado
 */
export function formatCountdown(cierreAt: Date | string): string {
  const diff = new Date(cierreAt).getTime() - Date.now();
  if (diff <= 0) return "Cerrado";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `Cierra en ${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `Cierra en ${hours}h ${remMins.toString().padStart(2, "0")}m`;
}

export type UrgencyTier = "crit" | "high" | "med" | "low";

/**
 * Nivel de urgencia según tiempo al cierre — consume los tokens
 * urgent-* de tailwind.config.ts. `crit` para <15min, `high` <1h,
 * `med` <3h, `low` ≥3h.
 */
export function urgencyLevel(cierreAt: Date | string): UrgencyTier {
  const mins = (new Date(cierreAt).getTime() - Date.now()) / 60_000;
  if (mins < 15) return "crit";
  if (mins < 60) return "high";
  if (mins < 180) return "med";
  return "low";
}

/**
 * YYYY-MM-DD en la tz dada. Sirve como clave estable para agrupar
 * partidos por día local (filtro de día de /matches).
 */
export function getDayKey(
  date: Date | string,
  tz: string = DEFAULT_TZ,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

/**
 * Rango UTC [00:00, 23:59:59.999] del día local identificado por
 * `dayKey` (YYYY-MM-DD) en la tz dada. Se usa para mandar `desde/hasta`
 * al backend como ISO UTC sin ambigüedad.
 *
 * Estrategia: probamos la medianoche UTC del día, le preguntamos a Intl
 * qué offset tiene la tz en ese instante, y corregimos. Funciona para
 * cualquier tz (incl. DST) sin depender de la tz del runtime.
 */
export function getDayBounds(
  dayKey: string,
  tz: string = DEFAULT_TZ,
): { desde: Date; hasta: Date } {
  const [y, m, d] = dayKey.split("-").map(Number);
  const utcMidnightMs = Date.UTC(y, m - 1, d, 0, 0, 0);
  // Offset (en ms) de la tz en ese instante. Para America/Lima es
  // -5h, ej: offsetMs = -18_000_000. Restarlo nos mueve de la
  // medianoche UTC a la medianoche local del mismo día.
  const offsetMs = getTimezoneOffsetMs(utcMidnightMs, tz);
  const desde = new Date(utcMidnightMs - offsetMs);
  const hasta = new Date(desde.getTime() + 86_399_999);
  return { desde, hasta };
}

/**
 * Devuelve el offset (en ms) de la tz dada en un instante. Positivo si
 * la tz está al este de UTC, negativo si está al oeste. Para
 * `America/Lima` devuelve -5 * 3_600_000.
 */
function getTimezoneOffsetMs(instantMs: number, tz: string): number {
  const date = new Date(instantMs);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const hour = get("hour") === 24 ? 0 : get("hour");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  return asUtc - instantMs;
}

/**
 * Label legible para un chip de día. `Hoy`, `Mañana`, o `Lun 20`.
 */
export function formatDayChipLabel(
  dayKey: string,
  tz: string = DEFAULT_TZ,
  now: Date = new Date(),
): string {
  const todayKey = getDayKey(now, tz);
  const tomorrowKey = getDayKey(new Date(now.getTime() + 86_400_000), tz);
  if (dayKey === todayKey) return "Hoy";
  if (dayKey === tomorrowKey) return "Mañana";

  // Reconstruir Date a partir del dayKey y mostrar "Lun 20".
  const [y, m, d] = dayKey.split("-").map(Number);
  const asDate = new Date(Date.UTC(y, m - 1, d, 12)); // mediodía UTC para evitar offset flip
  const label = asDate
    .toLocaleDateString("es-PE", {
      timeZone: tz,
      weekday: "short",
      day: "2-digit",
    })
    .replace(/\./g, "");
  // es-PE devuelve "lun. 20" → capitalizar la primera letra.
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isSameDay(a: Date, b: Date, tz: string): boolean {
  return getDayKey(a, tz) === getDayKey(b, tz);
}
