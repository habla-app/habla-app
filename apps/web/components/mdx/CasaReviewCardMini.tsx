// CasaReviewCardMini — Lote 11.
//
// Variante compacta de CasaReviewCard del Lote 7. Card más chica con:
//   - Logo + nombre + rating con estrellas (1 línea).
//   - Bono actual breve.
//   - CTA dorado.
//
// Sin pros/contras, sin métodos de pago, sin disclaimer (eso queda para
// la review completa o la page /casas/[slug]). Pensado para grids/carousels
// en home y otros listings denso.

import Link from "next/link";
import {
  obtenerAfiliadoPorSlug,
  type AfiliadoVista,
} from "@/lib/services/afiliacion.service";
import { CasaLogo, RatingEstrellas } from "./CasaReviewCard";

interface Props {
  slug: string;
  /** Si true (default), enlaza a /casas/[slug] desde el cuerpo de la card.
   *  Si false, sólo el CTA es clickeable. */
  linkResena?: boolean;
}

export async function CasaReviewCardMini({ slug, linkResena = true }: Props) {
  const afiliado = await obtenerAfiliadoPorSlug(slug);
  if (!afiliado || !afiliado.activo || !afiliado.autorizadoMincetur) {
    return null;
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-md border border-light bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Body afiliado={afiliado} linkResena={linkResena} />
      <Footer afiliado={afiliado} />
    </article>
  );
}

function Body({
  afiliado,
  linkResena,
}: {
  afiliado: AfiliadoVista;
  linkResena: boolean;
}) {
  const inner = (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <CasaLogo afiliado={afiliado} />
        <div className="min-w-0 flex-1">
          <h3 className="m-0 truncate font-display text-[16px] font-black uppercase tracking-[0.02em] text-dark">
            {afiliado.nombre}
          </h3>
          {afiliado.rating !== null ? (
            <RatingEstrellas rating={afiliado.rating} />
          ) : (
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-brand-blue-main">
              ✓ MINCETUR
            </p>
          )}
        </div>
      </div>
      {afiliado.bonoActual ? (
        <div className="rounded-sm border border-brand-gold/30 bg-brand-gold-dim px-2.5 py-1.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-brand-gold-dark">
            Bono
          </div>
          <div className="mt-0.5 font-display text-[13px] font-black leading-tight text-dark">
            {afiliado.bonoActual}
          </div>
        </div>
      ) : null}
    </div>
  );

  if (linkResena) {
    return (
      <Link
        href={`/casas/${afiliado.slug}`}
        className="block flex-1 transition-colors hover:bg-subtle"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

function Footer({ afiliado }: { afiliado: AfiliadoVista }) {
  return (
    <div className="border-t border-light bg-subtle/60 px-3 py-2.5">
      <Link
        href={`/go/${afiliado.slug}?utm_source=home&utm_medium=casa-mini`}
        rel="sponsored noopener"
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm bg-brand-gold px-3 py-2 font-display text-[12px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light"
      >
        Ir a {afiliado.nombre}
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
