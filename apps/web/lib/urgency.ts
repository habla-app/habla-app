// Helper para calcular urgencia + label de un torneo a partir de su
// `cierreAt`. Lo usan páginas que ya no renderizan MatchCard pero
// necesitan un texto de urgencia (ej. el hero del detalle de torneo).
//
// Fase 3 — MatchCard pasó a usar los helpers de lib/utils/datetime.ts
// (tier 'crit' en vez de 'critical', label "Cierra en X"). Este
// archivo queda para callers legacy que ya tienen copy tipo
// "¡Cierra en 8 min!". No se recicla por compat visual.
//
// Tiers:
//   - critical: <15min al cierre
//   - high:     <1h al cierre
//   - med:      <3h al cierre
//   - low:      ≥3h al cierre (o ya cerrado — devuelve "low" como safe default)

export type Urgency = "critical" | "high" | "med" | "low";

export function calcularUrgencia(
  cierreAt: Date,
  now: Date = new Date(),
): Urgency {
  const diffMin = (cierreAt.getTime() - now.getTime()) / 60_000;
  if (diffMin < 15) return "critical";
  if (diffMin < 60) return "high";
  if (diffMin < 180) return "med";
  return "low";
}

export function formatearUrgencyLabel(
  cierreAt: Date,
  urgency: Urgency,
  now: Date = new Date(),
): string {
  const diffMs = cierreAt.getTime() - now.getTime();
  const diffMin = Math.max(0, Math.round(diffMs / 60_000));

  if (urgency === "critical") {
    return `¡Cierra en ${diffMin} min!`;
  }
  if (urgency === "high") {
    return `⏰ ${diffMin} min`;
  }
  if (urgency === "med") {
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return `${hours}h ${mins}min`;
  }
  // low: mostrar la hora del cierre en tz del runtime (no crítico —
  // esta rama solo se ve en hero estáticos, no en listados).
  const hoy = now;
  const sameDay =
    hoy.getFullYear() === cierreAt.getFullYear() &&
    hoy.getMonth() === cierreAt.getMonth() &&
    hoy.getDate() === cierreAt.getDate();
  const hh = cierreAt.getHours().toString().padStart(2, "0");
  const mm = cierreAt.getMinutes().toString().padStart(2, "0");
  if (sameDay) return `Hoy ${hh}:${mm}`;
  const dd = cierreAt.getDate().toString().padStart(2, "0");
  const mon = (cierreAt.getMonth() + 1).toString().padStart(2, "0");
  return `${dd}/${mon} ${hh}:${mm}`;
}
