// CasaReviewCard — Lote 7.
//
// Card completa con logo, nombre, rating con estrellas, bono actual,
// pros/contras cortos y CTA. Layout tipo `.mcard` del mockup
// (línea 250+ de habla-mockup-completo.html): borde light, sombra suave,
// header denso, footer con CTA dorado.
//
// Uso esperado en MDX:
//   <CasaReviewCard slug="te-apuesto" />
//
// Sólo renderiza si el afiliado existe Y está activo Y autorizado por
// MINCETUR. Esa triple condición protege contra mostrar reviews de
// operadores que perdieron autorización (la regulación cambia y un
// afiliado puede dejar de estar autorizado a mitad de mes).

import Link from "next/link";
import {
  obtenerAfiliadoPorSlug,
  type AfiliadoVista,
} from "@/lib/services/afiliacion.service";

interface Props {
  slug: string;
}

export async function CasaReviewCard({ slug }: Props) {
  const afiliado = await obtenerAfiliadoPorSlug(slug);
  if (!afiliado || !afiliado.activo || !afiliado.autorizadoMincetur) {
    return null;
  }

  return (
    <article className="my-6 overflow-hidden rounded-md border border-light bg-card shadow-sm">
      {/* Header: logo + nombre + rating */}
      <header className="flex items-start gap-4 border-b border-light bg-subtle px-5 py-4">
        <CasaLogo afiliado={afiliado} />
        <div className="min-w-0 flex-1">
          <h3 className="m-0 font-display text-[20px] font-black uppercase tracking-[0.02em] text-dark">
            {afiliado.nombre}
          </h3>
          {afiliado.rating !== null ? (
            <RatingEstrellas rating={afiliado.rating} />
          ) : null}
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.06em] text-brand-blue-main">
            ✓ Autorizado por MINCETUR
          </p>
        </div>
      </header>

      {/* Body: bono + pros/contras + métodos pago */}
      <div className="space-y-4 px-5 py-4">
        {afiliado.bonoActual ? (
          <div className="rounded-sm border border-brand-gold/30 bg-brand-gold-dim px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-gold-dark">
              Bono de bienvenida
            </div>
            <div className="mt-1 font-display text-[18px] font-black text-dark">
              {afiliado.bonoActual}
            </div>
          </div>
        ) : null}

        {(afiliado.pros.length > 0 || afiliado.contras.length > 0) && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {afiliado.pros.length > 0 && (
              <ListaPros titulo="Lo bueno" items={afiliado.pros} tipo="pro" />
            )}
            {afiliado.contras.length > 0 && (
              <ListaPros
                titulo="Lo no tan bueno"
                items={afiliado.contras}
                tipo="contra"
              />
            )}
          </div>
        )}

        {afiliado.metodosPago.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-d">
              Métodos de pago
            </div>
            <div className="flex flex-wrap gap-1.5">
              {afiliado.metodosPago.map((m) => (
                <span
                  key={m}
                  className="inline-block rounded-sm border border-light bg-subtle px-2.5 py-1 text-[11px] font-bold text-dark"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer: CTA dorado */}
      <footer className="border-t border-light bg-subtle/60 px-5 py-4">
        <Link
          href={`/go/${afiliado.slug}`}
          rel="sponsored noopener"
          className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-brand-gold px-5 py-3 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light hover:shadow-gold"
        >
          Ir a {afiliado.nombre}
          <span aria-hidden>→</span>
        </Link>
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes — exportados para que TablaCasas los reuse.
// ---------------------------------------------------------------------------

export function CasaLogo({ afiliado }: { afiliado: AfiliadoVista }) {
  if (afiliado.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={afiliado.logoUrl}
        alt={`Logo de ${afiliado.nombre}`}
        // Lote I: explicit dimensions + lazy/decoding async para CWV.
        width={48}
        height={48}
        loading="lazy"
        decoding="async"
        className="h-12 w-12 flex-shrink-0 rounded-sm bg-card object-contain shadow-sm"
      />
    );
  }
  // Fallback: inicial sobre un cuadrado dorado, mismo tratamiento que
  // .logo-mark del mockup.
  const inicial = afiliado.nombre.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      aria-hidden
      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-sm bg-brand-gold font-display text-[20px] font-black text-black shadow-gold-btn"
    >
      {inicial}
    </div>
  );
}

export function RatingEstrellas({ rating }: { rating: number }) {
  // Rating 0-5 con 1 decimal. Ej. 4.5 → 4 enteras + 1 media.
  const enteras = Math.floor(rating);
  const media = rating - enteras >= 0.5 ? 1 : 0;
  const vacias = 5 - enteras - media;
  return (
    <div className="mt-0.5 flex items-center gap-1.5">
      <span aria-hidden className="text-[15px] leading-none tracking-tight text-brand-gold">
        {"★".repeat(enteras)}
        {media ? "⯨" : ""}
        <span className="text-soft">{"★".repeat(vacias)}</span>
      </span>
      <span className="font-mono text-[12px] font-bold tabular-nums text-dark">
        {rating.toFixed(2)}
      </span>
      <span className="text-[11px] text-muted-d">/ 5</span>
    </div>
  );
}

function ListaPros({
  titulo,
  items,
  tipo,
}: {
  titulo: string;
  items: string[];
  tipo: "pro" | "contra";
}) {
  const icono = tipo === "pro" ? "✓" : "✕";
  const colorIcono =
    tipo === "pro" ? "text-alert-success-text" : "text-brand-live";
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-d">
        {titulo}
      </div>
      <ul className="m-0 list-none space-y-1 p-0">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] text-dark">
            <span aria-hidden className={`flex-shrink-0 font-bold ${colorIcono}`}>
              {icono}
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
