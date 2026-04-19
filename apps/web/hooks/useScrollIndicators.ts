"use client";
// Hook: devuelve si un contenedor scrolleable tiene contenido oculto a
// la izquierda o a la derecha. Se usa para renderizar gradientes + flechas
// en /matches (filtro de día) y cualquier otra fila con scroll horizontal.
//
// Escucha `scroll` del propio contenedor, `resize` del viewport y un
// ResizeObserver sobre el contenedor para cubrir cambios de layout
// (por ejemplo, cuando aparecen/desaparecen chips tras un fetch).

import { useEffect, useState, type RefObject } from "react";

export interface ScrollIndicators {
  canScrollLeft: boolean;
  canScrollRight: boolean;
}

export function useScrollIndicators(
  ref: RefObject<HTMLElement | null>,
): ScrollIndicators {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      // Tolerancia de 1px para evitar flicker en subpixel rounding.
      setCanScrollLeft(el.scrollLeft > 1);
      setCanScrollRight(el.scrollLeft < maxScroll - 1);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, [ref]);

  return { canScrollLeft, canScrollRight };
}
