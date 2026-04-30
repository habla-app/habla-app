// SectionBar — Lote 11.
//
// Barra de sección editorial. Réplica de `.section-bar` del mockup
// (línea 228 de docs/habla-mockup-completo.html): borde lateral dorado
// 5px, gradient subtle→transparent, ícono dorado a la izquierda, título
// + subtítulo apilado, opcional contador a la derecha.
//
// Reusable a lo largo de la home y de los listings; mantiene el lenguaje
// visual coherente entre /matches, /comunidad, /casas, /blog.

import Link from "next/link";

interface Props {
  icon: string;
  title: string;
  subtitle?: string;
  /** Texto del CTA derecho (ej. "Ver todas →"). Si no, no se renderiza. */
  ctaLabel?: string;
  ctaHref?: string;
  /** Color del borde lateral. Default brand-gold. */
  tone?: "gold" | "blue" | "green";
}

const TONE_CLASSES: Record<NonNullable<Props["tone"]>, { border: string; iconBg: string; iconText: string }> = {
  gold: {
    border: "border-brand-gold",
    iconBg: "bg-brand-gold",
    iconText: "text-black",
  },
  blue: {
    border: "border-brand-blue-main",
    iconBg: "bg-brand-blue-main",
    iconText: "text-white",
  },
  green: {
    border: "border-brand-green",
    iconBg: "bg-brand-green",
    iconText: "text-black",
  },
};

export function SectionBar({
  icon,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  tone = "gold",
}: Props) {
  const t = TONE_CLASSES[tone];
  return (
    <div
      className={`mb-5 flex items-center gap-4 rounded-r-sm border-l-[5px] bg-gradient-to-r from-section-subtle to-transparent px-4 py-3 ${t.border}`}
    >
      <span
        aria-hidden
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-sm text-[20px] shadow-gold ${t.iconBg} ${t.iconText}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="mb-0.5 font-display text-[22px] font-black uppercase leading-none tracking-[0.02em] text-dark md:text-[26px]">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-[13px] leading-tight text-muted-d">
            {subtitle}
          </p>
        ) : null}
      </div>
      {ctaLabel && ctaHref ? (
        <Link
          href={ctaHref}
          className="flex-shrink-0 rounded-sm border border-light bg-card px-3.5 py-1.5 text-[12px] font-bold text-dark transition-colors hover:border-brand-blue-main hover:text-brand-blue-main"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
