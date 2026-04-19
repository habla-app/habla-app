"use client";
// LiveCountBadge — el "globo rojo" con el número de partidos EN_VIVO
// ahora mismo. Se usa tanto en el NavBar desktop (como sufijo del link
// "🔴 En vivo") como en el BottomNav mobile (como overlay del icono).
//
// Bug #12: antes NavBar hardcodeaba `LIVE_COUNT_PLACEHOLDER = 2` y el
// badge se renderizaba aunque no hubiera partidos reales. Ahora este
// componente devuelve null cuando count === 0 — sin dot, sin globo,
// sin el número "0". Cuando count > 0 renderiza el globo con el
// número o "9+" si supera 9.

import { useLiveMatchesCount } from "@/hooks/useLiveMatchesCount";

type Variant = "desktop" | "mobile";

interface Props {
  /** Count del SSR para evitar flicker pre-hydration. */
  initialCount: number;
  /** Layout: desktop (píldora roja al lado del label) o mobile
   *  (overlay absoluto encima del icono del BottomNav). */
  variant?: Variant;
}

export function LiveCountBadge({ initialCount, variant = "desktop" }: Props) {
  const count = useLiveMatchesCount(initialCount);

  // Regla dura del Bug #12: si no hay partidos, no se rendera NADA.
  // Ni un dot, ni el número "0", ni un círculo gris. Nada.
  if (count <= 0) return null;

  const label = count > 9 ? "9+" : String(count);

  if (variant === "mobile") {
    return (
      <span
        aria-label={`${count} partidos en vivo`}
        data-testid="live-count-badge-mobile"
        className="absolute -right-1.5 -top-1 min-w-[18px] animate-live-pulse rounded-full bg-urgent-critical px-1 text-center text-[10px] font-extrabold leading-[18px] text-white shadow-sm"
      >
        {label}
      </span>
    );
  }

  return (
    <span
      aria-label={`${count} partidos en vivo`}
      data-testid="live-count-badge"
      className="animate-live-pulse rounded-full bg-urgent-critical px-[7px] py-[2px] text-[10px] font-extrabold leading-none text-white"
    >
      {label}
    </span>
  );
}
