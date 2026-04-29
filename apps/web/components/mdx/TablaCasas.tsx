// TablaCasas — Lote 7.
//
// Tabla comparativa de N casas lado a lado. Para artículos editoriales
// que comparan varios operadores ("Las mejores casas para Yape",
// "Top 5 casinos online en Perú"). Layout:
//   - Desktop: tabla horizontal con columnas por afiliado (logo / rating /
//     bono / métodos pago / CTA).
//   - Mobile: scroll horizontal manteniendo la tabla compacta. Los
//     usuarios ya están entrenados en swipear tablas en mobile y ese
//     pattern preserva la comparación lado a lado.
//
// Uso esperado en MDX:
//   <TablaCasas slugs={["te-apuesto", "betsson", "doradobet"]} />
//
// Sólo se renderizan los afiliados ACTIVOS y AUTORIZADOS. Si todos los
// slugs pasados están inactivos / inexistentes, devolvemos `null` (no
// renderiza una tabla vacía).

import Link from "next/link";
import { obtenerAfiliadoPorSlug } from "@/lib/services/afiliacion.service";
import { CasaLogo, RatingEstrellas } from "./CasaReviewCard";

interface Props {
  slugs: string[];
}

export async function TablaCasas({ slugs }: Props) {
  if (slugs.length === 0) return null;

  const afiliados = await Promise.all(
    slugs.map((s) => obtenerAfiliadoPorSlug(s)),
  );
  const visibles = afiliados.filter(
    (a): a is NonNullable<typeof a> =>
      a !== null && a.activo && a.autorizadoMincetur,
  );

  if (visibles.length === 0) return null;

  return (
    <div className="my-6 overflow-x-auto rounded-md border border-light bg-card shadow-sm">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b-[1.5px] border-light bg-subtle text-left">
            <th className="w-[140px] px-4 py-3 font-body text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
              Casa
            </th>
            <th className="px-4 py-3 font-body text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
              Rating
            </th>
            <th className="px-4 py-3 font-body text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
              Bono
            </th>
            <th className="px-4 py-3 font-body text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
              Métodos de pago
            </th>
            <th className="px-4 py-3 text-right font-body text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
              Acción
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-light">
          {visibles.map((a) => (
            <tr key={a.id} className="text-dark">
              <td className="px-4 py-4 align-middle">
                <div className="flex items-center gap-3">
                  <CasaLogo afiliado={a} />
                  <div className="min-w-0">
                    <div className="font-display text-[15px] font-black uppercase tracking-[0.02em] text-dark">
                      {a.nombre}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-brand-blue-main">
                      ✓ MINCETUR
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 align-middle">
                {a.rating !== null ? (
                  <RatingEstrellas rating={a.rating} />
                ) : (
                  <span className="text-[12px] text-muted-d">—</span>
                )}
              </td>
              <td className="px-4 py-4 align-middle">
                {a.bonoActual ? (
                  <span className="inline-block rounded-sm border border-brand-gold/30 bg-brand-gold-dim px-2.5 py-1 text-[12px] font-bold text-brand-gold-dark">
                    {a.bonoActual}
                  </span>
                ) : (
                  <span className="text-[12px] text-muted-d">—</span>
                )}
              </td>
              <td className="px-4 py-4 align-middle">
                {a.metodosPago.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {a.metodosPago.slice(0, 4).map((m) => (
                      <span
                        key={m}
                        className="inline-block rounded-sm border border-light bg-subtle px-2 py-0.5 text-[11px] font-semibold text-dark"
                      >
                        {m}
                      </span>
                    ))}
                    {a.metodosPago.length > 4 ? (
                      <span className="text-[11px] text-muted-d">
                        +{a.metodosPago.length - 4}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-[12px] text-muted-d">—</span>
                )}
              </td>
              <td className="px-4 py-4 text-right align-middle">
                <Link
                  href={`/go/${a.slug}`}
                  rel="sponsored noopener"
                  className="inline-flex items-center gap-1.5 rounded-sm bg-brand-gold px-4 py-2 font-display text-[12px] font-extrabold uppercase tracking-[0.03em] text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light hover:shadow-gold"
                >
                  Ir
                  <span aria-hidden>→</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
