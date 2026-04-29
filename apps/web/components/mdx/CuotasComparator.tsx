// CuotasComparator — Lote 8 (placeholder hasta Lote 9).
//
// La data real de cuotas la cablea Lote 9. Por ahora renderiza una card
// con el copy "Comparador de cuotas próximamente" en el estilo del
// mockup, y dispara el evento `cuotas_comparator_visto` al montar para
// que el funnel del Lote 6 ya tenga conteo.
//
// Cuando llegue Lote 9: este componente pasa a leer la data y desaparece
// el placeholder. La firma `<CuotasComparator partidoId={...} />` se
// mantiene para no romper los .mdx ya escritos.

import { TrackOnMount } from "@/components/analytics/TrackOnMount";

interface Props {
  partidoId: string;
}

export function CuotasComparator({ partidoId }: Props) {
  return (
    <>
      <TrackOnMount
        event="cuotas_comparator_visto"
        props={{ partidoId, placeholder: true }}
      />
      <aside
        role="note"
        aria-label="Comparador de cuotas"
        className="my-6 overflow-hidden rounded-md border border-light bg-card shadow-sm"
      >
        <header className="border-b border-light bg-subtle px-5 py-3">
          <span className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-brand-blue-main">
            📊 Comparador de cuotas
          </span>
        </header>
        <div className="px-5 py-6 text-center">
          <p className="m-0 font-display text-[16px] font-bold text-dark">
            Comparador de cuotas próximamente
          </p>
          <p className="mt-2 text-[13px] text-muted-d">
            Estamos cableando la integración con las casas autorizadas por
            MINCETUR. Volvé pronto para comparar las mejores cuotas del
            partido.
          </p>
        </div>
      </aside>
    </>
  );
}
