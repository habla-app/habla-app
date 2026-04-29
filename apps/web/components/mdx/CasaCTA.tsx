// CasaCTA — Lote 7.
//
// Botón dorado prominente que linkea al redirect tracker `/go/[slug]`.
// Estilo del CTA dorado del mockup (.btn-primary, línea 373 del HTML):
// fondo brand-gold, texto negro, sombra dorada en hover, escala -1px.
//
// Uso esperado en MDX (Lote 8+):
//   <CasaCTA slug="te-apuesto" texto="Reclamar bono" />
//
// Si el slug no existe o el afiliado está inactivo, el componente NO
// rompe la página — devuelve `null`. La razón: el editorial (artículos
// MDX que se construyen en Lote 8) no debería caerse si un afiliado se
// desactiva temporalmente.

import Link from "next/link";
import { obtenerAfiliadoPorSlug } from "@/lib/services/afiliacion.service";

interface Props {
  slug: string;
  /** Texto del botón. Default: "Ir a {nombre}". */
  texto?: string;
  /** Variante visual. `gold` (default) replica el .btn-primary del mockup;
   *  `compact` es más pequeño para insertar inline en párrafos. */
  variant?: "gold" | "compact";
}

export async function CasaCTA({ slug, texto, variant = "gold" }: Props) {
  const afiliado = await obtenerAfiliadoPorSlug(slug);
  if (!afiliado || !afiliado.activo || !afiliado.autorizadoMincetur) {
    return null;
  }

  const label = texto ?? `Ir a ${afiliado.nombre}`;
  const href = `/go/${afiliado.slug}`;

  if (variant === "compact") {
    return (
      <Link
        href={href}
        rel="sponsored noopener"
        className="inline-flex items-center gap-1.5 rounded-sm bg-brand-gold px-3 py-1.5 text-[12px] font-bold text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light hover:shadow-gold"
      >
        {label}
        <span aria-hidden>→</span>
      </Link>
    );
  }

  return (
    <div className="my-6 flex flex-col items-stretch gap-2">
      <Link
        href={href}
        rel="sponsored noopener"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-6 py-4 font-display text-[16px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light hover:shadow-gold md:w-auto md:self-center"
      >
        {label}
        <span aria-hidden>→</span>
      </Link>
      {afiliado.bonoActual ? (
        <p className="text-center text-[12px] text-muted-d">
          <strong className="text-dark">{afiliado.bonoActual}</strong> ·{" "}
          Operador autorizado por MINCETUR.
        </p>
      ) : (
        <p className="text-center text-[12px] text-muted-d">
          Operador autorizado por MINCETUR.
        </p>
      )}
    </div>
  );
}
