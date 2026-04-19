"use client";
// Chips de filtro por día para /matches. Orden: "Todos" primero, luego
// Hoy/Mañana/días individuales futuros. Solo se renderizan días con
// >=1 torneo, hasta 7 días. "Todos" se muestra siempre.
//
// Estado de URL: `?dia=` ausente → chip "Todos" activo (default).
// `?dia=YYYY-MM-DD` → chip de ese día activo.
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
  /** Total de torneos en la ventana completa — alimenta el chip "Todos". */
  totalCount: number;
}

const MAX_DAYS = 7;
const TODOS_KEY = "__all__";

export function DayFilterChips({
  dayCounts,
  totalCount,
}: DayFilterChipsProps) {
  const { filters, setFilter } = useMatchesFilters();

  // Resolvemos la tz una vez en el cliente para evitar hydration mismatch.
  // En SSR usamos el default (America/Lima) y en client re-leemos.
  const [tz, setTz] = useState<string>(DEFAULT_TZ);
  useEffect(() => {
    setTz(getUserTimezone());
  }, []);

  const now = new Date();
  const todayKey = getDayKey(now, DEFAULT_TZ);

  // Generar los próximos MAX_DAYS días (hoy incluido). Solo incluimos
  // días con al menos un torneo, excepto hoy que siempre se muestra
  // aunque esté vacío (así el usuario siempre tiene "Hoy" disponible).
  const days: Array<{ key: string; count: number }> = [];
  for (let i = 0; i < MAX_DAYS; i++) {
    const offset = i * 86_400_000;
    const key = getDayKey(new Date(now.getTime() + offset), DEFAULT_TZ);
    const count = dayCounts[key] ?? 0;
    if (i === 0 || count > 0) days.push({ key, count });
  }

  // "Todos" es el default: se activa cuando no hay ?dia= en la URL.
  const chips: Array<{ key: string; label: string; count: number }> = [
    { key: TODOS_KEY, label: "Todos", count: totalCount },
    ...days.map((d) => ({
      key: d.key,
      label: formatDayChipLabel(d.key, tz, now),
      count: d.count,
    })),
  ];

  const activeKey = filters.dia ?? TODOS_KEY;

  const base =
    "flex-shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold shadow-sm transition-all duration-150";
  const activeCls = "border-dark-surface bg-dark-surface text-white";
  const neutralCls =
    "border-light bg-card text-muted-d hover:border-dark-border hover:text-dark";

  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
      {chips.map(({ key, label, count }) => {
        const active = key === activeKey;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() =>
              setFilter("dia", key === TODOS_KEY ? null : key)
            }
            className={`${base} ${active ? activeCls : neutralCls}`}
          >
            <span>{label}</span>
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
