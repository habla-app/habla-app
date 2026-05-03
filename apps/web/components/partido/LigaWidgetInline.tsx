// LigaWidgetInline — widget azul brillante con CTA cross-product B → C.
// Lote B v3.1 + Lote M v3.2 (URL nueva /liga/[slug]).
// Spec: docs/habla-mockup-v3.2.html § page-fijas-detail .liga-inline-banner.
//
// Renderiza si y solo si el partido tiene un torneo activo en BD. Linkea
// a `/liga/[slug]` (URL canónica v3.2 del Producto C). El partidoSlug es
// el mismo slug que se usa en /las-fijas/[slug].

import Link from "next/link";

interface Props {
  /** Id del torneo asociado al partido. Si null se oculta. */
  torneoId: string | null;
  /** Slug del partido para construir la URL del detalle de Liga. */
  partidoSlug?: string;
  totalInscritos: number;
}

export function LigaWidgetInline({
  torneoId,
  partidoSlug,
  totalInscritos,
}: Props) {
  if (!torneoId || !partidoSlug) return null;

  return (
    <Link
      href={`/liga/${partidoSlug}`}
      className="my-6 flex items-center justify-between gap-4 rounded-md bg-gradient-to-r from-brand-blue-main to-brand-blue-light p-4 text-white shadow-md transition-all hover:-translate-y-px hover:shadow-lg md:p-5"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-3xl">
          🏆
        </span>
        <div>
          <p className="font-display text-display-sm uppercase text-white">
            Compite gratis por este partido
          </p>
          <p className="text-body-sm text-white/85">
            <strong className="text-brand-gold-light">
              {totalInscritos.toLocaleString("es-PE")}
            </strong>{" "}
            tipster{totalInscritos === 1 ? "" : "s"} compitiendo · S/ 1,250 al
            mes · armá tu combinada de 5 predicciones gratis
          </p>
        </div>
      </div>
      <span aria-hidden className="text-2xl text-brand-gold-light">
        →
      </span>
    </Link>
  );
}
