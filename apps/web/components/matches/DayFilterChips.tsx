"use client";
// Chips de filtro por día para /matches. Orden: "Todos" primero, luego
// Hoy / Mañana / días individuales futuros. Se genera 1 chip por cada día
// distinto (en tz Perú) que tenga ≥1 torneo abierto dentro de la ventana
// de 14 días que expone el backend.
//
// Layout: scrolleable horizontal. Cuando hay contenido oculto a los
// lados se pinta un gradiente + flecha redonda (oculta en mobile — los
// gestos táctiles bastan). La navegación por teclado con ← → mueve el
// foco entre chips adyacentes y auto-scrollea al chip focuseado.
//
// Estado de URL: `?dia=` ausente → chip "Todos" activo (default).
// `?dia=YYYY-MM-DD` → chip de ese día activo.
//
// Estilo diferenciado de LeagueFilterChips: el chip activo usa
// `bg-dark-surface text-white`, no dorado. Evita visual clash cuando
// los dos filtros están seleccionados a la vez.

import { useMatchesFilters } from "@/hooks/useMatchesFilters";
import { useScrollIndicators } from "@/hooks/useScrollIndicators";
import {
  DEFAULT_TZ,
  formatDayChip,
  getDayKey,
} from "@/lib/utils/datetime";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

interface DayFilterChipsProps {
  /**
   * Map dayKey (YYYY-MM-DD en hora Perú) → número de torneos. Generado en
   * el server component antes de renderizar.
   */
  dayCounts: Record<string, number>;
  /** Total de torneos en la ventana completa — alimenta el chip "Todos". */
  totalCount: number;
}

const WINDOW_DAYS = 14;
const TODOS_KEY = "__all__";
const SCROLL_STEP_PX = 200;

export function DayFilterChips({
  dayCounts,
  totalCount,
}: DayFilterChipsProps) {
  const { filters, setFilter } = useMatchesFilters();

  // Recorremos la ventana de 14 días (hoy incluido, en tz Perú) y
  // generamos un chip por cada día con ≥1 torneo. Hoy solo se incluye
  // si tiene torneos — el chip "Todos" cubre el caso "no hay nada hoy
  // pero sí esta semana".
  //
  // Tanto los dayKeys del prop como los labels se resuelven contra
  // `DEFAULT_TZ` (America/Lima) para que coincidan con el bucketing que
  // usa el backend. Si usáramos la tz del navegador para formatear,
  // "Hoy" podría no caer en el mismo día que la dayKey Lima (ej.
  // usuario en EDT a las 00:30 aún es 23:30 del día anterior en Lima).
  const todayKey = getDayKey(new Date(), DEFAULT_TZ);
  const chips = useMemo(() => {
    const now = new Date();
    const days: Array<{ key: string; count: number }> = [];
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const key = getDayKey(
        new Date(now.getTime() + i * 86_400_000),
        DEFAULT_TZ,
      );
      const count = dayCounts[key] ?? 0;
      if (count > 0) days.push({ key, count });
    }
    return [
      { key: TODOS_KEY, label: "Todos", count: totalCount },
      ...days.map((d) => ({
        key: d.key,
        label: formatDayChip(d.key, DEFAULT_TZ, now),
        count: d.count,
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayCounts, totalCount, todayKey]);

  const activeKey = filters.dia ?? TODOS_KEY;

  // Scroll container + indicators.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { canScrollLeft, canScrollRight } = useScrollIndicators(scrollRef);

  const scrollBy = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({
      left: dir * SCROLL_STEP_PX,
      behavior: "smooth",
    });
  };

  // Roving tabindex: el chip focuseado (o el activo por default) tiene
  // tabIndex=0, el resto tabIndex=-1. Así Tab entra al grupo y las
  // flechas navegan entre chips.
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const defaultIdx = Math.max(
    0,
    chips.findIndex((c) => c.key === activeKey),
  );
  const tabIndexFor = (i: number) =>
    (focusIdx ?? defaultIdx) === i ? 0 : -1;

  const focusChip = (idx: number) => {
    setFocusIdx(idx);
    const btn = chipRefs.current[idx];
    if (!btn) return;
    btn.focus();
    btn.scrollIntoView({ inline: "nearest", block: "nearest" });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % chips.length;
    else if (e.key === "ArrowLeft")
      next = (i - 1 + chips.length) % chips.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = chips.length - 1;
    if (next !== null) {
      e.preventDefault();
      focusChip(next);
    }
  };

  const base =
    "flex-shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold shadow-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-main focus-visible:ring-offset-2 focus-visible:ring-offset-page";
  const activeCls = "border-dark-surface bg-dark-surface text-white";
  const neutralCls =
    "border-light bg-card text-muted-d hover:border-dark-border hover:text-dark";

  // Botón redondo de arrow para desktop (hover-capable). En mobile se
  // oculta con [@media(hover:none)] porque los gestos táctiles bastan.
  const arrowBtn =
    "absolute top-1/2 z-[2] hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-light bg-card text-[18px] leading-none text-dark shadow-sm transition-colors hover:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-main [@media(hover:hover)]:flex";

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        role="toolbar"
        aria-label="Filtro por día"
        aria-orientation="horizontal"
        className="scrollbar-none flex flex-nowrap gap-2 overflow-x-auto scroll-smooth pb-1"
        style={{
          scrollSnapType: "x proximity",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {chips.map(({ key, label, count }, i) => {
          const active = key === activeKey;
          return (
            <button
              key={key}
              ref={(el) => {
                chipRefs.current[i] = el;
              }}
              type="button"
              aria-pressed={active}
              tabIndex={tabIndexFor(i)}
              onClick={() =>
                setFilter("dia", key === TODOS_KEY ? null : key)
              }
              onKeyDown={(e) => onKeyDown(e, i)}
              style={{ scrollSnapAlign: "start" }}
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
        {/* Spacer al final — deja aire para que el último chip no quede
            pegado al fade/arrow al scrollear al extremo derecho. */}
        <div aria-hidden className="w-12 flex-shrink-0" />
      </div>

      {/* Indicadores laterales — aparecen según el scroll. `pointer-events-none`
          en el gradiente para no bloquear clicks sobre los chips. */}
      {canScrollLeft && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[54px] bg-gradient-to-r from-[var(--bg-page)] to-transparent"
          />
          <button
            type="button"
            aria-label="Desplazar filtros a la izquierda"
            tabIndex={-1}
            onClick={() => scrollBy(-1)}
            className={`${arrowBtn} left-1`}
          >
            ‹
          </button>
        </>
      )}
      {canScrollRight && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-[54px] bg-gradient-to-l from-[var(--bg-page)] to-transparent"
          />
          <button
            type="button"
            aria-label="Desplazar filtros a la derecha"
            tabIndex={-1}
            onClick={() => scrollBy(1)}
            className={`${arrowBtn} right-1`}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
