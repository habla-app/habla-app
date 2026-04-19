"use client";
// Chips de filtro por día para /matches. Los días se derivan del conteo
// que manda el parent (`dayCounts`) — solo se renderizan días con >=1
// torneo, hasta 7 días futuros (hoy incluido). Labels: Hoy / Mañana /
// "Lun 20".
//
// Estilo diferenciado de LeagueFilterChips: el chip activo usa
// `bg-dark-surface text-white`, no dorado. Evita visual clash cuando
// los dos filtros están seleccionados a la vez.

import { useMatchesFilters } from "@/hooks/useMatchesFilters";
import {
  DEFAULT_TZ,
  formatDayChipLabel,
  getDayKey,
  getUserTimezone,
} from "@/lib/utils/datetime";
import { useEffect, useState } from "react";

interface DayFilterChipsProps {
  /**
   * Map dayKey (YYYY-MM-DD en hora Perú) → número de torneos.
   * Generado en el server component antes de renderizar.
   */
  dayCounts: Record<string, number>;
}

const MAX_DAYS = 7;

export function DayFilterChips({ dayCounts }: DayFilterChipsProps) {
  const { filters, setFilter } = useMatchesFilters();

  // Resolvemos la tz una vez en el cliente para evitar hydration mismatch.
  // En SSR usamos el default (America/Lima) y en client re-leemos.
  const [tz, setTz] = useState<string>(DEFAULT_TZ);
  useEffect(() => {
    setTz(getUserTimezone());
  }, []);

  const now = new Date();
  const todayKey = getDayKey(now, DEFAULT_TZ);
  const activeKey = filters.dia ?? todayKey;

  // Generar los próximos MAX_DAYS días a partir de hoy (hora Perú) y
  // quedarnos con los que tienen al menos un torneo. Hoy siempre se
  // muestra aunque esté vacío (permite volver al default sin borrar URL).
  const days: Array<{ key: string; count: number }> = [];
  for (let i = 0; i < MAX_DAYS; i++) {
    const offset = i * 86_400_000;
    const key = getDayKey(new Date(now.getTime() + offset), DEFAULT_TZ);
    const count = dayCounts[key] ?? 0;
    if (i === 0 || count > 0) days.push({ key, count });
  }

  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
      {days.map(({ key, count }) => {
        const active = key === activeKey;
        const base =
          "flex-shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold shadow-sm transition-all duration-150";
        const activeCls =
          "border-dark-surface bg-dark-surface text-white";
        const neutralCls =
          "border-light bg-card text-muted-d hover:border-dark-border hover:text-dark";
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() =>
              setFilter("dia", key === todayKey ? null : key)
            }
            className={`${base} ${active ? activeCls : neutralCls}`}
          >
            <span>{formatDayChipLabel(key, tz, now)}</span>
            <span
              className={`inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${active ? "bg-white/20 text-white" : "bg-subtle text-muted-d"}`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
