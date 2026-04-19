"use client";
// Estado vacío de /matches — cubre las 4 combinaciones de filtros
// activos. Mensaje y CTAs dependen de qué filtro esté puesto:
//
//   liga ∧ día  → "No encontramos torneos de {Liga} para {día}."
//                 [Ver todos los días] [Cambiar liga]
//   liga ∧ !día → "No encontramos torneos de {Liga} en los próximos 14 días."
//                 [Cambiar liga]
//   !liga ∧ día → "No hay torneos para {día}."
//                 [Ver todos los días]
//   !liga ∧ !día → "No hay torneos abiertos ahora mismo. Volvé en un rato."
//                  (sin botones — no hay nada que limpiar)

import { useMatchesFilters } from "@/hooks/useMatchesFilters";
import {
  LIGA_CHIP_LABELS,
  slugToLiga,
} from "@/lib/config/liga-slugs";
import { DEFAULT_TZ, formatDayChip } from "@/lib/utils/datetime";

interface EmptyFilteredStateProps {
  ligaSlug?: string;
  dia?: string;
}

export function EmptyFilteredState({ ligaSlug, dia }: EmptyFilteredStateProps) {
  const { setFilter } = useMatchesFilters();
  const ligaLabel = ligaSlug
    ? (LIGA_CHIP_LABELS[ligaSlug] ?? slugToLiga(ligaSlug) ?? "esa liga")
    : null;
  const diaLabel = dia
    ? formatDayChip(dia, DEFAULT_TZ).toLowerCase()
    : null;

  const mensaje = buildMensaje({ ligaLabel, diaLabel });
  const icono = ligaLabel || diaLabel ? "🔍" : "📅";

  return (
    <div className="mb-10 rounded-md border border-light bg-card px-6 py-12 text-center shadow-sm">
      <div aria-hidden className="mb-3 text-4xl">
        {icono}
      </div>
      <p className="text-sm font-semibold text-dark">{mensaje}</p>
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

function buildMensaje({
  ligaLabel,
  diaLabel,
}: {
  ligaLabel: string | null;
  diaLabel: string | null;
}): string {
  if (ligaLabel && diaLabel) {
    return `No encontramos torneos de ${ligaLabel} para ${diaLabel}.`;
  }
  if (ligaLabel) {
    return `No encontramos torneos de ${ligaLabel} en los próximos 14 días.`;
  }
  if (diaLabel) {
    return `No hay torneos para ${diaLabel}.`;
  }
  return "No hay torneos abiertos ahora mismo. Volvé en un rato.";
}
