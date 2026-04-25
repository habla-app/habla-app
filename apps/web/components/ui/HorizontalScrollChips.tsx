"use client";
// HorizontalScrollChips — wrapper genérico para una fila de chips con
// scroll horizontal + edge fades + flechas de navegación (desktop) +
// auto-scroll al chip activo. Reutiliza el patrón ya probado en
// DayFilterChips, generalizado para cualquier filtro.
//
// El consumer pasa los chips como children. Para activar el auto-scroll,
// el chip activo debe tener el atributo `data-active="true"` (los demás
// pueden no tenerlo o tenerlo en "false"). El componente Chip propaga
// `data-*` via ...rest, así que basta con pasar el atributo en el JSX.
//
// Uso:
//   <HorizontalScrollChips ariaLabel="Filtrar por liga">
//     <Chip active={a===null} data-active={a===null} onClick={...}>Todas</Chip>
//     {ligas.map(l => (
//       <Chip key={l.slug} active={a===l.slug} data-active={a===l.slug}
//         onClick={...}>{l.label}</Chip>
//     ))}
//   </HorizontalScrollChips>
//
// Mobile: los gestos táctiles del navegador hacen el swipe horizontal;
// las flechas se ocultan vía `[@media(hover:hover)]` (solo aparecen en
// dispositivos con hover real, típicamente desktop).

import { useEffect, useRef, type ReactNode } from "react";
import { useScrollIndicators } from "@/hooks/useScrollIndicators";

interface HorizontalScrollChipsProps {
  /** Chips a renderizar. Se les aplica scroll-snap automático. */
  children: ReactNode;
  /** Texto descriptivo del filtro para a11y (toolbar role). */
  ariaLabel?: string;
  /**
   * Si true (default), al montar y al cambiar `children` el componente
   * busca el chip con `data-active="true"` y lo trae al viewport visible
   * vía scrollIntoView. Se ejecuta sólo si el chip activo está fuera
   * del área visible — evita scroll innecesario cuando ya está OK.
   */
  scrollActiveIntoView?: boolean;
  /** Clase extra al wrapper exterior. */
  className?: string;
}

const SCROLL_STEP_PX = 220;

export function HorizontalScrollChips({
  children,
  ariaLabel,
  scrollActiveIntoView = true,
  className,
}: HorizontalScrollChipsProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { canScrollLeft, canScrollRight } = useScrollIndicators(scrollRef);

  useEffect(() => {
    if (!scrollActiveIntoView) return;
    const container = scrollRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(
      '[data-active="true"]',
    );
    if (!active) return;
    const cb = container.getBoundingClientRect();
    const ab = active.getBoundingClientRect();
    // Solo scroll si está fuera del viewport visible (con tolerancia de
    // 4px para evitar disparos por subpixel rounding).
    const fueraIzq = ab.left < cb.left - 4;
    const fueraDer = ab.right > cb.right + 4;
    if (fueraIzq || fueraDer) {
      active.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [scrollActiveIntoView, children]);

  const scrollBy = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({
      left: dir * SCROLL_STEP_PX,
      behavior: "smooth",
    });
  };

  // Botón redondo de flecha — solo visible en hover-capable (desktop).
  // En mobile/touch los gestos bastan.
  const arrowBtn =
    "absolute top-1/2 z-[2] hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-light bg-card text-[18px] leading-none text-dark shadow-md transition-colors hover:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-main [@media(hover:hover)]:flex";

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        ref={scrollRef}
        role="toolbar"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        className="scrollbar-none flex flex-nowrap gap-2 overflow-x-auto scroll-smooth pb-1"
        style={{
          scrollSnapType: "x proximity",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/*
          Hijos: cada chip debería tener `flex-shrink-0` y
          `scroll-snap-align: start`. El primitivo Chip ya viene con
          `flex-shrink-0`; el snap lo aplicamos genéricamente acá.
        */}
        <div
          className="contents"
          style={{ scrollSnapAlign: "start" }}
          aria-hidden
        />
        {children}
        {/* Spacer al final para que el último chip no quede pegado al
            fade/arrow al scrollear al extremo derecho. */}
        <div aria-hidden className="w-12 flex-shrink-0" />
      </div>

      {canScrollLeft && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[54px] bg-gradient-to-r from-[var(--bg-page)] to-transparent"
          />
          <button
            type="button"
            aria-label="Ver opciones a la izquierda"
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
            aria-label="Ver opciones a la derecha"
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
