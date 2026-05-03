// LigaInlineBanner — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-fijas-detail (.liga-inline-banner).
//
// Banner cross-link a /liga/[slug] con CTA "Predecir gratis" (visitor/free)
// o "Editar mi combinada" si ya predijo.

import Link from "next/link";

interface Props {
  partidoSlug: string;
  totalInscritos: number;
  /** Si el usuario actual ya tiene combinada en este partido. */
  yaPredijo?: boolean;
  /** Si false, no renderiza nada (partido no es elegible Liga). */
  visible: boolean;
}

export function LigaInlineBanner({
  partidoSlug,
  totalInscritos,
  yaPredijo = false,
  visible,
}: Props) {
  if (!visible) return null;
  const cta = yaPredijo ? "Editar mi combinada" : "Predecir gratis";
  const href = `/liga/${partidoSlug}${yaPredijo ? "?modal=1" : "?modal=1"}`;

  return (
    <div className="liga-inline-banner">
      <div className="liga-inline-banner-icon">🏆</div>
      <div className="liga-inline-banner-text">
        <div className="liga-inline-banner-title">
          {totalInscritos} tipster{totalInscritos === 1 ? "" : "s"} compitiendo en
          este partido
        </div>
        <div className="liga-inline-banner-desc">
          Armá tu combinada de 5 predicciones gratis. Top 10 del mes cobra S/1,250.
        </div>
      </div>
      <Link href={href} className="btn btn-primary">
        {cta}
      </Link>
    </div>
  );
}
