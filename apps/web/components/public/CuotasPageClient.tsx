"use client";
// CuotasPageClient — Lote 9.
//
// Wrapper client-side de /cuotas que renderiza chips de liga (HorizontalScrollChips)
// y aplica filter via toggle de visibilidad sobre los `<li data-liga="...">`
// que el server pintó. No reordena ni paginas — solo show/hide.
//
// El server pasa los partidos ya renderizados como `children`. Esto permite
// que `<CuotasComparator>` (async server component) lea el cache de Redis
// en tiempo de SSR. El cliente no toca esos componentes; sólo decide qué
// `<li>` muestra.

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Chip, HorizontalScrollChips } from "@/components/ui";
import { LIGA_CHIP_LABELS, LIGA_SLUGS_ORDER } from "@/lib/config/liga-slugs";

interface Props {
  /** Lista de slugs de liga presentes entre los partidos renderizados.
   *  Sólo mostramos chips para estos. */
  ligasPresentes: string[];
  children: ReactNode;
}

export function CuotasPageClient({ ligasPresentes, children }: Props) {
  const [activo, setActivo] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Orden estable de chips: usamos LIGA_SLUGS_ORDER y filtramos a las
  // que aparecen en `ligasPresentes`. Si un slug viene fuera del catálogo
  // (no debería) lo descartamos.
  const chips = useMemo(() => {
    const set = new Set(ligasPresentes);
    return LIGA_SLUGS_ORDER.filter((s) => set.has(s));
  }, [ligasPresentes]);

  // Cada vez que cambia `activo`, actualizamos el atributo `data-hidden` de
  // los `<li data-liga="...">`. CSS hace el show/hide vía la clase
  // `[&[data-hidden=true]]:hidden`. El effect corre post-render para que
  // los `<li>` ya estén en el DOM.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const items = root.querySelectorAll<HTMLLIElement>("li[data-liga]");
    items.forEach((li) => {
      const slug = li.getAttribute("data-liga");
      const visible = activo === null || slug === activo;
      if (visible) {
        li.removeAttribute("data-hidden");
      } else {
        li.setAttribute("data-hidden", "true");
      }
    });
  }, [activo]);

  if (chips.length === 0) {
    // No hay nada que filtrar (todos los partidos son de ligas fuera del
    // catálogo, raro). Mostramos todo sin chips.
    return <div ref={containerRef}>{children}</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <HorizontalScrollChips ariaLabel="Filtrar por liga">
          <Chip
            key="todas"
            active={activo === null}
            data-active={activo === null ? "true" : "false"}
            onClick={() => setActivo(null)}
          >
            Todas las ligas
          </Chip>
          {chips.map((slug) => (
            <Chip
              key={slug}
              active={activo === slug}
              data-active={activo === slug ? "true" : "false"}
              onClick={() => setActivo(slug)}
            >
              {LIGA_CHIP_LABELS[slug] ?? slug}
            </Chip>
          ))}
        </HorizontalScrollChips>
      </div>
      <div
        ref={containerRef}
        className="[&_li[data-hidden=true]]:hidden"
      >
        {children}
      </div>
    </div>
  );
}
