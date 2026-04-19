"use client";
// Estado vacío de /matches cuando la combinación de filtros (liga +
// día) no devuelve torneos. Ofrece dos CTAs: uno que limpia el filtro
// de día y otro que limpia el de liga. Usar los dos vuelve a la vista
// por default (todas las ligas, hoy).

import { useMatchesFilters } from "@/hooks/useMatchesFilters";
import {
  LIGA_CHIP_LABELS,
  slugToLiga,
} from "@/lib/config/liga-slugs";
import { DEFAULT_TZ, formatDayChipLabel } from "@/lib/utils/datetime";

interface EmptyFilteredStateProps {
  ligaSlug?: string;
  dia?: string;
}

export function EmptyFilteredState({ ligaSlug, dia }: EmptyFilteredStateProps) {
  const { setFilter } = useMatchesFilters();
  const ligaLabel = ligaSlug
    ? (LIGA_CHIP_LABELS[ligaSlug] ?? slugToLiga(ligaSlug) ?? "esa liga")
    : null;
  const diaLabel = dia ? formatDayChipLabel(dia, DEFAULT_TZ) : null;

  const linea = [
    ligaLabel ? `de ${ligaLabel}` : null,
    diaLabel ? `para ${diaLabel.toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mb-10 rounded-md border border-light bg-card px-6 py-12 text-center shadow-sm">
      <div aria-hidden className="mb-3 text-4xl">
        🔍
      </div>
      <p className="text-sm font-semibold text-dark">
        No encontramos torneos {linea || "con esos filtros"}.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {dia && (
          <button
            type="button"
            onClick={() => setFilter("dia", null)}
            className="rounded-full border border-light bg-subtle px-4 py-2 text-[13px] font-semibold text-dark transition-colors hover:border-brand-gold hover:bg-chip-hover"
          >
            Ver todos los días
          </button>
        )}
        {ligaSlug && (
          <button
            type="button"
            onClick={() => setFilter("liga", null)}
            className="rounded-full border border-light bg-subtle px-4 py-2 text-[13px] font-semibold text-dark transition-colors hover:border-brand-gold hover:bg-chip-hover"
          >
            Cambiar liga
          </button>
        )}
      </div>
    </div>
  );
}
