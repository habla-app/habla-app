// NivelProgressBar — barra de progreso al siguiente nivel (Lote C v3.1).
// Spec: docs/ux-spec/00-design-system/componentes-mobile.md §16.
//
// Se muestra dentro del ProfileHero (perfil mobile). Muestra el nivel
// actual con su emoji + progreso visual al siguiente. Si el usuario ya es
// Leyenda, oculta la barra y muestra "Nivel máximo 👑".

import { cn } from "@/lib/utils/cn";
import type { Nivel } from "@/lib/utils/nivel";

interface NivelProgressBarProps {
  nivelActual: Nivel;
  /** Torneos jugados totales del usuario. */
  torneosJugados: number;
  /** Siguiente nivel al que apunta o null si ya es Leyenda. */
  nivelSiguiente: Nivel | null;
  /** Torneos faltantes para llegar al siguiente nivel. 0 si Leyenda. */
  faltanParaSiguiente: number;
  className?: string;
  /** Color del fill: "gold" sobre fondo oscuro, "blue" sobre fondo claro. */
  tone?: "gold" | "blue";
}

export function NivelProgressBar({
  nivelActual,
  torneosJugados,
  nivelSiguiente,
  faltanParaSiguiente,
  className,
  tone = "gold",
}: NivelProgressBarProps) {
  const techo = nivelSiguiente?.min ?? nivelActual.min;
  const piso = nivelActual.min;
  const span = Math.max(1, techo - piso);
  const dentro = Math.max(0, torneosJugados - piso);
  const porcentaje = nivelSiguiente
    ? Math.min(100, Math.round((dentro / span) * 100))
    : 100;

  const fillCls =
    tone === "gold"
      ? "bg-gradient-to-r from-brand-gold to-brand-gold-light"
      : "bg-gradient-to-r from-brand-blue-main to-brand-blue-light";
  const trackCls = tone === "gold" ? "bg-white/10" : "bg-subtle";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        className={cn(
          "h-2 overflow-hidden rounded-full",
          trackCls,
        )}
        role="progressbar"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso al siguiente nivel: ${porcentaje}%`}
      >
        <div
          aria-hidden
          className={cn("h-full rounded-full transition-all", fillCls)}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-label-md">
        <span
          className={
            tone === "gold" ? "text-white/80" : "text-muted-d"
          }
        >
          <strong
            className={
              tone === "gold" ? "text-brand-gold-light" : "text-dark"
            }
          >
            {nivelActual.emoji} Nivel {nivelActual.label}
          </strong>{" "}
          · {torneosJugados} torneos jugados
        </span>
        <span
          className={
            tone === "gold" ? "text-white/70" : "text-muted-d"
          }
        >
          {nivelSiguiente
            ? `+${faltanParaSiguiente} para ${nivelSiguiente.emoji} ${nivelSiguiente.label}`
            : "Nivel máximo 👑"}
        </span>
      </div>
    </div>
  );
}
