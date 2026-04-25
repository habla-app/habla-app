"use client";
// FAQ acordeón con buscador. Cliente porque maneja:
//  - input de búsqueda (filtra preguntas + categorías por matching)
//  - estado expandido por pregunta (acordeón individual)
//  - apertura inicial: primera categoría desktop, todo colapsado mobile
//  - anchor links: leemos `location.hash` para abrir la pregunta o
//    categoría correspondiente (ej: /ayuda/faq#pregunta-7)

import { useEffect, useMemo, useState } from "react";
import { MarkdownContent } from "@/components/legal/MarkdownContent";
import type { FaqCategory } from "@/lib/faq-content";

interface Props {
  categories: FaqCategory[];
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 1024px)").matches;
}

export function FaqClient({ categories }: Props) {
  const [query, setQuery] = useState("");
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  // Apertura inicial: primera categoría en desktop, todo colapsado mobile.
  // También respetamos hash (#pregunta-N o #categoria-X).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cats = new Set<string>();
    const qs = new Set<string>();
    if (isDesktop() && categories[0]) {
      cats.add(categories[0].id);
    }
    const hash = window.location.hash.slice(1);
    if (hash.startsWith("pregunta-")) {
      qs.add(hash);
      // Encontrar la categoría que contiene la pregunta y abrirla.
      for (const cat of categories) {
        if (cat.questions.some((q) => q.id === hash)) {
          cats.add(cat.id);
          break;
        }
      }
      // Scroll diferido al elemento.
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    } else if (hash.startsWith("categoria-")) {
      cats.add(hash);
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }
    setOpenCategories(cats);
    setOpenQuestions(qs);
  }, [categories]);

  // Filtrado: busca en pregunta + respuesta. Si hay query, mostramos
  // solo categorías con al menos un match y forzamos la categoría
  // expandida + cada pregunta matchada expandida.
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return categories.map((c) => ({ cat: c, matches: c.questions }));
    return categories
      .map((c) => ({
        cat: c,
        matches: c.questions.filter(
          (qst) =>
            normalize(qst.question).includes(q) ||
            normalize(qst.answerMd).includes(q),
        ),
      }))
      .filter((entry) => entry.matches.length > 0);
  }, [query, categories]);

  const isFiltering = query.trim().length > 0;

  function toggleQuestion(id: string): void {
    setOpenQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCategory(id: string): void {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="mb-8">
        <label htmlFor="faq-search" className="sr-only">
          Buscar en preguntas frecuentes
        </label>
        <div className="relative">
          <input
            id="faq-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar... (ej: Lukas, canje, vencimiento)"
            className="w-full rounded-md border border-light bg-card px-12 py-3.5 text-[15px] text-dark placeholder:text-soft focus:border-brand-blue-main focus:outline-none focus:ring-2 focus:ring-brand-blue-main/20"
          />
          <svg
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-d"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
        {isFiltering && (
          <p className="mt-2 text-[13px] text-muted-d">
            {filtered.reduce((acc, e) => acc + e.matches.length, 0)} resultado
            {filtered.reduce((acc, e) => acc + e.matches.length, 0) === 1
              ? ""
              : "s"}
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-light bg-card p-8 text-center">
          <p className="text-[15px] text-muted-d">
            No encontramos preguntas que coincidan. Probá con otra palabra o
            escribínos a soporte.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map(({ cat, matches }) => {
            const isOpen = isFiltering || openCategories.has(cat.id);
            return (
              <section
                key={cat.id}
                id={cat.id}
                className="overflow-hidden rounded-md border border-light bg-card"
              >
                <button
                  type="button"
                  onClick={() => !isFiltering && toggleCategory(cat.id)}
                  disabled={isFiltering}
                  className="flex w-full items-center justify-between gap-4 bg-subtle px-5 py-4 text-left transition-colors hover:bg-bg-hover disabled:cursor-default"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-blue-main font-display text-[16px] font-bold text-white">
                      {cat.letter}
                    </span>
                    <h2 className="font-display text-[20px] font-bold text-dark md:text-[22px]">
                      {cat.label}
                    </h2>
                    <span className="text-[13px] text-muted-d">
                      ({matches.length})
                    </span>
                  </div>
                  {!isFiltering && (
                    <svg
                      className={`flex-shrink-0 text-muted-d transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      aria-hidden="true"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  )}
                </button>
                {isOpen && (
                  <div className="divide-y divide-light">
                    {matches.map((q) => {
                      const qOpen = openQuestions.has(q.id) || isFiltering;
                      return (
                        <div key={q.id} id={q.id} className="scroll-mt-24">
                          <button
                            type="button"
                            onClick={() => toggleQuestion(q.id)}
                            className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-bg-hover"
                            aria-expanded={qOpen}
                          >
                            <div className="flex flex-1 items-start gap-3">
                              <span className="font-display text-[15px] font-bold text-muted-d">
                                {q.number}.
                              </span>
                              <span className="font-display text-[16px] font-bold text-dark md:text-[17px]">
                                {q.question}
                              </span>
                            </div>
                            <svg
                              className={`mt-1 flex-shrink-0 text-muted-d transition-transform ${
                                qOpen ? "rotate-180" : ""
                              }`}
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              aria-hidden="true"
                            >
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </button>
                          {qOpen && (
                            <div className="px-5 pb-5 pl-12">
                              <MarkdownContent content={q.answerMd} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
