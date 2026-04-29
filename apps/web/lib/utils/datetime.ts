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
 * Rango UTC del mes calendario identificado por `mesKey` (formato YYYY-MM)
 * en la tz dada. `desde` = primer día del mes 00:00 en la tz dada;
 * `hasta` = primer día del mes siguiente 00:00 (exclusivo).
 *
 * Se usa para agregar `puntosFinales` por usuario sobre tickets de torneos
 * cuyo `partido.fechaInicio` cae dentro del mes (Lote 5 — leaderboard
 * mensual). El intervalo es [desde, hasta) — usar `lt: hasta` en Prisma.
 */
export function getMonthBounds(
  mesKey: string,
  tz: string = DEFAULT_TZ,
): { desde: Date; hasta: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(mesKey);
  if (!m) throw new Error(`mesKey inválido: "${mesKey}" (esperado YYYY-MM)`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error(`mesKey con mes inválido: "${mesKey}"`);

  // Mediodía UTC de los días pivote — evita flips por DST/offset.
  const pivotInicio = Date.UTC(y, mo - 1, 1, 12);
  const pivotFin =
    mo === 12 ? Date.UTC(y + 1, 0, 1, 12) : Date.UTC(y, mo, 1, 12);

  const inicioKey = getDayKey(new Date(pivotInicio), tz);
  const finKey = getDayKey(new Date(pivotFin), tz);

  const { desde } = getDayBounds(inicioKey, tz);
  const { desde: hasta } = getDayBounds(finKey, tz);
  return { desde, hasta };
}

/**
 * `mesKey` (YYYY-MM) del mes calendario que contiene `reference` en la tz
 * dada. Default reference = ahora.
 */
export function getMesKey(
  reference: Date = new Date(),
  tz: string = DEFAULT_TZ,
): string {
  const dayKey = getDayKey(reference, tz); // YYYY-MM-DD
  return dayKey.slice(0, 7);
}

/**
 * `mesKey` del mes calendario inmediatamente anterior al de `reference` en
 * la tz dada. Usado por el cron J (Lote 5) que cierra el leaderboard del
 * mes pasado el día 1 a las ≥01:00 hora Lima.
 */
export function getMesAnteriorKey(
  reference: Date = new Date(),
  tz: string = DEFAULT_TZ,
): string {
  const cur = getMesKey(reference, tz);
  const [y, m] = cur.split("-").map(Number);
  const prevYear = m === 1 ? y - 1 : y;
  const prevMonth = m === 1 ? 12 : m - 1;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
}

/**
 * Hora del día (0-23) en la tz dada para una fecha. Lima es UTC-5 sin DST.
 * Se usa por el cron J para detectar la ventana "día 1, ≥01:00 Lima".
 */
export function horaEnTimezone(d: Date, tz: string = DEFAULT_TZ): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  });
  return Number(fmt.format(d));
}

/**
 * Día del mes (1-31) en la tz dada para una fecha.
 */
export function diaDelMesEnTimezone(d: Date, tz: string = DEFAULT_TZ): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    day: "numeric",
  });
  return Number(fmt.format(d));
}

/**
 * Nombre del mes en español + año. Ej. "abril 2026", "mayo 2026".
 * Usado en titulares de /comunidad y emails.
 */
export function formatNombreMes(
  mesKey: string,
  tz: string = DEFAULT_TZ,
): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mesKey);
  if (!m) return mesKey;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  // Día 15 del mes a mediodía UTC: estable bajo cualquier offset.
  const ref = new Date(Date.UTC(y, mo - 1, 15, 12));
  const nombre = ref
    .toLocaleDateString("es-PE", { timeZone: tz, month: "long" })
    .toLowerCase();
  return `${nombre} ${y}`;
}

/**
 * Rango UTC de la semana local en curso — lunes 00:00 a domingo 23:59:59.999
 * en la tz dada. Útil para agregados semanales de UI (widgets del sidebar
 * de /matches).
 *
 * Semana que contiene la fecha `reference` (default: ahora). El inicio de
 * semana es el lunes (estándar europeo/latinoamericano, no domingo estilo US).
 */
export function getWeekBounds(
  reference: Date = new Date(),
  tz: string = DEFAULT_TZ,
): { desde: Date; hasta: Date } {
  const refKey = getDayKey(reference, tz);
  const [y, m, d] = refKey.split("-").map(Number);
  // Mediodía UTC del día local — evita flips por DST/offset al calcular
  // el día de la semana.
  const asDate = new Date(Date.UTC(y, m - 1, d, 12));
  const dayOfWeek = asDate.getUTCDay(); // 0 dom, 1 lun, ..., 6 sáb
  const offsetToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayNoonUtc = new Date(Date.UTC(y, m - 1, d - offsetToMonday, 12));
  const sundayNoonUtc = new Date(
    Date.UTC(y, m - 1, d - offsetToMonday + 6, 12),
  );
  const mondayKey = getDayKey(mondayNoonUtc, tz);
  const sundayKey = getDayKey(sundayNoonUtc, tz);
  const { desde } = getDayBounds(mondayKey, tz);
  const { hasta } = getDayBounds(sundayKey, tz);
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
 * Label legible para un chip de día. El formato varía según si el día cae
 * dentro del mes actual del navegador o en un mes distinto:
 *
 *   Hoy               → día en curso (en la tz dada)
 *   Mañana            → día siguiente
 *   Lun 20            → día en el mes actual (solo día-de-mes)
 *   Sáb 28 abr        → día en otro mes (incluye mes abreviado)
 *   Vie 1 may         → idem (cruza al mes siguiente)
 *   Mié 1 ene         → idem (cruza al año siguiente)
 *
 * El "mes actual" se determina contra `now` en la tz dada, no contra el
 * dayKey del chip. Así todos los chips del mes en curso comparten el
 * formato corto y los que caen fuera muestran el mes para desambiguar.
 */
export function formatDayChip(
  dayKey: string,
  tz: string = DEFAULT_TZ,
  now: Date = new Date(),
): string {
  const todayKey = getDayKey(now, tz);
  const tomorrowKey = getDayKey(new Date(now.getTime() + 86_400_000), tz);
  if (dayKey === todayKey) return "Hoy";
  if (dayKey === tomorrowKey) return "Mañana";

  // Reconstruimos el Date del dayKey con mediodía UTC para evitar flips de
  // offset al cruzar medianoche en tz's con offset negativo (Lima UTC-5).
  const [y, m, d] = dayKey.split("-").map(Number);
  const asDate = new Date(Date.UTC(y, m - 1, d, 12));

  // Mes actual del navegador en la tz dada, para decidir si el chip cae
  // en el mes en curso (formato corto) o en otro mes (formato con mes).
  const [currentY, currentM] = getDayKey(now, tz).split("-").map(Number);
  const sameMonth = y === currentY && m === currentM;

  const weekday = capitalizeFirst(
    asDate
      .toLocaleDateString("es-PE", { timeZone: tz, weekday: "short" })
      .replace(/\./g, ""),
  );

  if (sameMonth) return `${weekday} ${d}`;

  const monthAbbrev = asDate
    .toLocaleDateString("es-PE", { timeZone: tz, month: "short" })
    .replace(/\./g, "")
    .toLowerCase();
  return `${weekday} ${d} ${monthAbbrev}`;
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isSameDay(a: Date, b: Date, tz: string): boolean {
  return getDayKey(a, tz) === getDayKey(b, tz);
}
