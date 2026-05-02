// CrossProductBanner — sincronía B↔C. v3.1 (Lote A). Spec:
// docs/ux-spec/00-design-system/componentes-mobile.md §10.
//
// Banner que linkea entre Producto B (cobertura del partido) y Producto C
// (Liga Habla! comunitaria) para el mismo partido. La spec define dos
// direcciones:
//
// - B-to-C: en /partidos/[slug] → "🏆 Compite por este partido en la Liga
//           Habla! · 234 tipsters compitiendo · [Hacer mi predicción]"
//           Linkea a /comunidad/torneo/[slug].
//
// - C-to-B: en /comunidad/torneo/[slug] → "📊 Ver análisis completo y
//           cuotas comparadas →"
//           Linkea a /partidos/[slug].
//
// Layout: card con icono + texto + arrow. Sin animaciones decorativas.
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export type CrossProductDirection = "B-to-C" | "C-to-B";

/**
 * Tono visual del banner.
 *
 * - `light` (default): card blanca con border-light, sirve sobre fondos
 *   claros (vista de partido tras hero, /comunidad/torneo después del hero).
 * - `dark`: card semi-transparente con borde claro, pensada para montarse
 *   sobre hero coloreado (gradient navy→blue del torneo).
 */
export type CrossProductTone = "light" | "dark";

interface CrossProductBannerProps {
  direction: CrossProductDirection;
  partidoSlug: string;
  /** Solo aplica a B-to-C: cuántos tipsters compiten en este torneo. */
  competidores?: number;
  tone?: CrossProductTone;
  className?: string;
}

export function CrossProductBanner({
  direction,
  partidoSlug,
  competidores,
  tone = "light",
  className,
}: CrossProductBannerProps) {
  const isBtoC = direction === "B-to-C";
  const isDark = tone === "dark";
  const href = isBtoC
    ? `/comunidad/torneo/${partidoSlug}`
    : `/partidos/${partidoSlug}`;
  const icon = isBtoC ? "🏆" : "📊";
  const title = isBtoC
    ? "Compite por este partido en la Liga Habla!"
    : "Ver análisis completo y cuotas comparadas";
  const subtitle = isBtoC
    ? competidores !== undefined
      ? `${competidores.toLocaleString("es-PE")} tipsters compitiendo · Predice gratis`
      : "Predice gratis · Subí en el ranking del mes"
    : "Análisis editorial + comparador de cuotas";

  return (
    <Link
      href={href}
      aria-label={title}
      className={cn(
        "group flex items-center gap-3 rounded-md border px-4 py-3",
        "transition-all duration-150 active:scale-[0.99]",
        isDark
          ? "border-white/15 bg-white/10 hover:border-white/30 hover:bg-white/15 text-white"
          : "border-light bg-card text-dark shadow-sm hover:border-brand-blue-main hover:bg-hover",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[22px]",
          isDark
            ? "bg-white/15"
            : isBtoC
              ? "bg-brand-gold-dim"
              : "bg-alert-info-bg",
        )}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-display-xs truncate",
            isDark ? "text-white" : "text-dark",
          )}
        >
          {title}
        </p>
        <p
          className={cn(
            "text-body-xs truncate",
            isDark ? "text-white/65" : "text-muted-d",
          )}
        >
          {subtitle}
        </p>
      </div>
      <span
        aria-hidden
        className={cn(
          "text-[18px] transition-transform duration-150 group-hover:translate-x-0.5",
          isDark ? "text-brand-gold-light" : "text-brand-blue-main",
        )}
      >
        →
      </span>
    </Link>
  );
}
