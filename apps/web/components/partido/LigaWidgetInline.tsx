// LigaWidgetInline — widget azul brillante con CTA cross-product B → C.
// Lote B v3.1. Spec:
// docs/ux-spec/02-pista-usuario-publica/partidos-slug.spec.md.
//
// Renderiza si y solo si el partido tiene un torneo activo en BD. El
// widget linkea al torneo del partido en /comunidad/torneo/[slug] (URL
// canónica del Producto C en v3.1, creada por Lote C). Por ahora linkea
// a `/torneo/[id]` (URL legacy) hasta que Lote C complete la migración.

import Link from "next/link";

interface Props {
  /** Id del torneo asociado al partido. Si null se oculta. */
  torneoId: string | null;
  /** Slug del partido para construir la URL v3.1. Mientras Lote C no
   *  exista, fallback a /torneo/[id]. */
  partidoSlug?: string;
  totalInscritos: number;
}

export function LigaWidgetInline({
  torneoId,
  partidoSlug,
  totalInscritos,
}: Props) {
  if (!torneoId) return null;

  // Mientras Lote C no termine de migrar, usamos /torneo/[id] (la URL
  // legacy aún funciona). Cuando Lote C aterrice, swap a
  // `/comunidad/torneo/${partidoSlug}`.
  const href = partidoSlug
    ? `/comunidad/torneo/${partidoSlug}`
    : `/torneo/${torneoId}`;

  return (
    <Link
      href={href}
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
            mes
          </p>
        </div>
      </div>
      <span aria-hidden className="text-2xl text-brand-gold-light">
        →
      </span>
    </Link>
  );
}
