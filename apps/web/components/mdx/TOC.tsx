"use client";

// TOC — Lote 8.
//
// Tabla de contenidos con scroll-spy. Recibe `headings` (extraídos en SSR
// por `extractHeadings()` de `lib/content/loader.ts`) y resalta el item
// activo según qué heading tiene visible el usuario via
// IntersectionObserver. Mismo patrón que `LegalTOC` del Lote 3 — copiado
// y adaptado para soportar h3 anidados, no para evitar duplicación
// (LegalTOC lo usan los .md legales y no quiero acoplar su evolución).
//
// Desktop: sticky a la izquierda. Mobile: collapsable arriba.
//
// El componente no renderiza nada si `headings.length === 0` — eso pasa
// cuando un artículo es muy corto y no usa h2/h3.

import { useEffect, useState } from "react";

interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

interface Props {
  headings: Heading[];
}

export function TOC({ headings }: Props) {
  const [activeId, setActiveId] = useState<string | null>(
    headings[0]?.id ?? null,
  );
  const [openMobile, setOpenMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (visible) setActiveId(visible.target.id);
      },
      {
        rootMargin: "-80px 0px -65% 0px",
        threshold: 0,
      },
    );

    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <>
      {/* Mobile: collapsable */}
      <details
        className="mb-6 rounded-md border border-light bg-card p-4 lg:hidden"
        open={openMobile}
        onToggle={(e) =>
          setOpenMobile((e.target as HTMLDetailsElement).open)
        }
      >
        <summary className="cursor-pointer font-display text-[13px] font-bold uppercase tracking-wide text-muted-d">
          Tabla de contenidos
        </summary>
        <ol className="mt-3 space-y-1.5 text-[14px]">
          {headings.map((h) => (
            <li key={h.id} className={h.level === 3 ? "ml-4" : ""}>
              <a
                href={`#${h.id}`}
                className="text-body hover:text-brand-blue-main hover:underline"
                onClick={() => setOpenMobile(false)}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ol>
      </details>

      {/* Desktop: sidebar sticky */}
      <aside
        className="hidden lg:sticky lg:top-24 lg:block lg:h-fit lg:w-[260px] lg:flex-shrink-0"
        aria-label="Tabla de contenidos"
      >
        <div className="rounded-md border border-light bg-card p-5">
          <p className="mb-3 font-display text-[12px] font-bold uppercase tracking-wider text-muted-d">
            Tabla de contenidos
          </p>
          <ol className="space-y-1 text-[13.5px] leading-snug">
            {headings.map((h) => (
              <li
                key={h.id}
                className={h.level === 3 ? "ml-4 text-[12.5px]" : ""}
              >
                <a
                  href={`#${h.id}`}
                  className={`block border-l-2 py-1 pl-3 transition-colors ${
                    activeId === h.id
                      ? "border-brand-blue-main font-bold text-brand-blue-main"
                      : "border-transparent text-body hover:border-light hover:text-dark"
                  }`}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </>
  );
}
