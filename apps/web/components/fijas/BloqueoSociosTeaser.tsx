// BloqueoSociosTeaser — Lote M v3.2.
// Spec: docs/habla-mockup-v3.2.html § page-fijas-detail .resumen-pick-socios.
//
// Teaser que reemplaza un bloque Socios cuando el visitante NO es Socio.
// Lista qué se desbloquea + línea cebo con blur + CTA "Hacete Socio".
// Reciclado entre múltiples bloques (combinada óptima, razonamiento,
// análisis profundo de goles, análisis profundo de tarjetas, mercados
// secundarios) — el caller pasa el título y la línea cebo concretos.

import Link from "next/link";

interface Props {
  titulo: string;
  /** Línea con datos blur-eada (ej: cuotas, números). */
  cebo: string;
  /** Lista corta de qué se desbloquea con Socios. */
  inclusiones: string[];
  /** Si true, el CTA dice "Registrate gratis" en vez de "Hacete Socio".
   *  Útil para visitantes anónimos que necesitan registrarse antes.   */
  variant?: "hacete-socio" | "registrate";
}

export function BloqueoSociosTeaser({
  titulo,
  cebo,
  inclusiones,
  variant = "hacete-socio",
}: Props) {
  const cta =
    variant === "registrate"
      ? { label: "Registrate gratis →", href: "/auth/signin?callbackUrl=/socios" }
      : { label: "Hacete Socio para desbloquear →", href: "/socios" };

  return (
    <section
      aria-label={titulo}
      className="overflow-hidden rounded-md border-2 border-brand-gold/40 bg-gradient-to-br from-brand-gold/[0.08] to-brand-blue-main/[0.04] p-5 shadow-sm md:p-6"
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-label-sm font-bold uppercase tracking-[0.06em] text-brand-gold-dark">
            💎 Análisis Socios bloqueado
          </p>
          <h3 className="font-display text-display-sm font-extrabold text-dark md:text-display-md">
            {titulo}
          </h3>
        </div>
      </header>

      <ul className="mb-4 space-y-1.5 text-body-sm text-body">
        {inclusiones.map((i) => (
          <li key={i} className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-brand-gold-dark">
              ✓
            </span>
            <span>{i}</span>
          </li>
        ))}
      </ul>

      <p
        aria-hidden
        className="mb-4 select-none rounded-sm bg-card/60 px-3 py-3 text-body-md font-medium text-body blur-[4px]"
      >
        {cebo}
      </p>

      <Link
        href={cta.href}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-3 font-display text-label-md font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-cta transition-all hover:-translate-y-px hover:bg-brand-gold-light md:w-auto"
      >
        {cta.label}
      </Link>
    </section>
  );
}
