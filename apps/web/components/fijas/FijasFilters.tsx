"use client";
// FijasFilters — Lote M v3.2 (May 2026).
// Spec: docs/habla-mockup-v3.2.html § page-fijas-list.
//
// Chips horizontales (mobile: scroll horizontal smooth, desktop: wrap)
// para filtrar la lista de Las Fijas por liga y por día.

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

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
  const [pending, startTransition] = useTransition();

  const ligaActiva = params.get("liga") ?? null;
  const diaActivo = params.get("dia") ?? null;

  function setParam(key: "liga" | "dia", value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "todas") {
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
    <div
      className={`mb-4 flex flex-col gap-2 ${pending ? "opacity-70" : ""}`}
      aria-label="Filtros de fijas"
    >
      <div
        className="-mx-4 flex gap-1.5 overflow-x-auto scroll-smooth px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
        role="group"
        aria-label="Liga"
      >
        <Chip
          label="Todas las ligas"
          active={ligaActiva === null}
          onClick={() => setParam("liga", null)}
        />
        {ligasPresentes.map((l) => (
          <Chip
            key={l}
            label={l}
            active={ligaActiva === l}
            onClick={() => setParam("liga", l)}
          />
        ))}
      </div>
      <div
        className="-mx-4 flex gap-1.5 overflow-x-auto scroll-smooth px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
        role="group"
        aria-label="Día"
      >
        <Chip
          label="Próximos 14 días"
          active={diaActivo === null}
          onClick={() => setParam("dia", null)}
        />
        {DIAS.map((d) => (
          <Chip
            key={d.slug}
            label={d.label}
            active={diaActivo === d.slug}
            onClick={() => setParam("dia", d.slug)}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`touch-target shrink-0 rounded-full border px-3.5 py-1.5 font-display text-label-sm font-bold uppercase tracking-[0.04em] transition-colors ${
        active
          ? "border-brand-blue-main bg-brand-blue-main text-white"
          : "border-light bg-card text-body hover:border-brand-blue-main hover:text-brand-blue-main"
      }`}
    >
      {label}
    </button>
  );
}
