"use client";
// FijasFilters — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-fijas-list (.fijas-filters).
// Estructura del mockup: una sola fila de chips horizontal (ligas + días)
// + un input de búsqueda. Mobile: scroll horizontal sin wrap. Desktop: wrap.

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

interface Props {
  ligasPresentes: string[];
}

const DIAS: Array<{ slug: "hoy" | "manana" | "semana"; label: string }> = [
  { slug: "hoy", label: "Hoy" },
  { slug: "manana", label: "Mañana" },
  { slug: "semana", label: "Esta semana" },
];

export function FijasFilters({ ligasPresentes }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState(() => params.get("q") ?? "");

  const ligaActiva = params.get("liga") ?? null;
  const diaActivo = params.get("dia") ?? null;

  function setParam(key: "liga" | "dia" | "q", value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "todas" || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `/las-fijas?${qs}` : "/las-fijas", { scroll: false });
    });
  }

  return (
    <div className="fijas-filters" aria-label="Filtros de fijas">
      <button
        type="button"
        className={`filter-chip${ligaActiva === null ? " active" : ""}`}
        onClick={() => setParam("liga", null)}
      >
        Todas las ligas
      </button>
      {ligasPresentes.map((l) => (
        <button
          key={l}
          type="button"
          className={`filter-chip${ligaActiva === l ? " active" : ""}`}
          onClick={() => setParam("liga", l)}
        >
          {l}
        </button>
      ))}
      {DIAS.map((d) => (
        <button
          key={d.slug}
          type="button"
          className={`filter-chip${diaActivo === d.slug ? " active" : ""}`}
          onClick={() => setParam("dia", d.slug)}
        >
          {d.label}
        </button>
      ))}
      <input
        className="filter-search"
        placeholder="🔎 Buscar equipo..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") setParam("q", busqueda || null);
        }}
        onBlur={() => {
          // Sync al perder foco también, para que el back/refresh funcione.
          if ((params.get("q") ?? "") !== busqueda) setParam("q", busqueda || null);
        }}
      />
    </div>
  );
}
