// Helper compartido para calcular urgencia + label de una match card a
// partir de un `cierreAt`. Se usa en `/`, `/matches` y `/torneo/:id`.
//
// Tiers (CLAUDE.md §9, sección Sub-Sprint 3):
//   - critical: <15min al cierre
//   - high:     <1h al cierre
//   - med:      <3h al cierre
//   - low:      ≥3h al cierre (o ya cerrado — devuelve "low" como safe default)

import type { Urgency, TipoBadge } from "@/components/matches/MatchCard";

export function calcularUrgencia(cierreAt: Date, now: Date = new Date()): Urgency {
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
  // low: mostrar la hora del cierre (formato "Hoy HH:mm" o "DD/MM HH:mm")
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

/**
 * Infiere el tipoBadge visual del Torneo a partir de su tipo + liga. Patrón
 * temporal hasta que el schema agregue una columna `tipoBadge` explícita.
 *
 * Sub-Sprint 3 mock rules:
 *   - Liga con "Mundial" → mundial
 *   - Liga con "Champions" → champions
 *   - Liga con "Libertadores" → liberta
 *   - Tipo PREMIUM en clásicos peruanos → clasico
 *   - Tipo EXPRESS → express
 *   - Tipo PREMIUM → premium
 *   - default → estandar
 */
export function inferirTipoBadge(
  tipoTorneo: string,
  liga: string,
): TipoBadge {
  const L = liga.toLowerCase();
  if (L.includes("mundial")) return "mundial";
  if (L.includes("champions")) return "champions";
  if (L.includes("libertadores")) return "liberta";
  if (tipoTorneo === "EXPRESS") return "express";
  if (tipoTorneo === "PREMIUM") {
    // Clásicos peruanos: Alianza vs Universitario, etc. → clasico badge.
    if (
      (L.includes("liga 1") || L.includes("peru")) &&
      /alianza|universitario|cristal|melgar/i.test(liga)
    ) {
      return "clasico";
    }
    return "premium";
  }
  return "estandar";
}
