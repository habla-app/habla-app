"use client";
// Tabla de contenidos sticky para páginas legales. Desktop: sidebar
// derecho. Mobile: collapsable arriba del contenido.

import { useEffect, useState } from "react";

interface Props {
  headings: Array<{ id: string; text: string }>;
}

export function LegalTOC({ headings }: Props) {
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
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
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
        onToggle={(e) => setOpenMobile((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer font-display text-[14px] font-bold uppercase tracking-wide text-muted-d">
          Tabla de contenidos
        </summary>
        <ol className="mt-3 space-y-1.5 pl-4 text-[14px]">
          {headings.map((h, i) => (
            <li key={h.id} className="list-decimal text-soft">
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
      <aside className="hidden lg:sticky lg:top-24 lg:block lg:h-fit lg:w-[260px] lg:flex-shrink-0">
        <div className="rounded-md border border-light bg-card p-5">
          <p className="mb-3 font-display text-[12px] font-bold uppercase tracking-wider text-muted-d">
            Tabla de contenidos
          </p>
          <ol className="space-y-1.5 text-[13.5px] leading-snug">
            {headings.map((h) => (
              <li key={h.id}>
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
