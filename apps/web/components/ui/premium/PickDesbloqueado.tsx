// PickDesbloqueado — pick Premium desbloqueado para suscriptores activos
// (Lote D). Spec: docs/ux-spec/04-pista-usuario-premium/pick-bloqueado.spec.md.
//
// Renderiza el pick completo (recomendación + cuota + razonamiento + casa
// recomendada) sin blur. CTA principal: link afiliado a la casa con UTM.
// Watermark con email del usuario al pie (decorativo, dificulta forwarding
// masivo del screenshot del pick).
//
// Modo `card` (compacto) y `section` (full prominente). Diferencia es la
// cantidad de razonamiento que se muestra; ambos muestran cuota + casa.

import type { PickWrapperData, PickWrapperMode } from "./types";

interface Props {
  pick: PickWrapperData;
  mode: PickWrapperMode;
  utmSource: string;
  email?: string | null;
}

export function PickDesbloqueado({ pick, mode, utmSource, email }: Props) {
  const evPctMostrar =
    pick.evPctSugerido !== null && pick.evPctSugerido !== undefined
      ? `+${(pick.evPctSugerido * 100).toFixed(1)}%`
      : null;
  const stakePctMostrar = `${(pick.stakeSugerido * 100).toFixed(0)}%`;

  const containerCls =
    mode === "card"
      ? "relative overflow-hidden rounded-md bg-premium-card-gradient p-5 shadow-premium-card"
      : "relative my-6 overflow-hidden rounded-md bg-premium-card-gradient p-5 shadow-premium-card md:p-7";

  const razonamiento =
    mode === "card" && pick.razonamiento.length > 200
      ? pick.razonamiento.slice(0, 200).trimEnd() + "…"
      : pick.razonamiento;

  return (
    <section aria-label="Pick Premium desbloqueado" className={containerCls}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gold-soft-glow opacity-50"
      />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold px-2.5 py-0.5 text-label-sm text-black">
            💎 Premium
          </span>
          <span className="text-body-xs text-premium-text-soft-on-dark">
            Pick del editor
          </span>
        </div>

        <p className="mb-1 text-display-md text-premium-text-on-dark">
          {pick.recomendacion}
        </p>
        <p className="mb-3 text-body-sm text-premium-text-muted-on-dark">
          {pick.partido.local} vs {pick.partido.visitante}
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-premium-text-muted-on-dark">
          <span>
            Cuota{" "}
            <strong className="text-brand-gold">
              {pick.cuotaSugerida.toFixed(2)}
            </strong>
          </span>
          {pick.casa ? (
            <span>
              en <strong className="text-white">{pick.casa.nombre}</strong>
            </span>
          ) : null}
          <span>
            · stake <strong className="text-white">{stakePctMostrar}</strong>
          </span>
          {evPctMostrar ? (
            <span>
              · EV <span className="text-status-green">{evPctMostrar}</span>
            </span>
          ) : null}
        </div>

        <div className="mb-4 rounded-md bg-premium-blur-content p-4">
          <p className="text-body-sm leading-[1.55] text-premium-text-on-dark">
            {razonamiento}
          </p>
        </div>

        {pick.casa ? (
          <a
            href={`/go/${pick.casa.slug}?utm_source=pick-premium&utm_medium=${encodeURIComponent(
              utmSource,
            )}&cuota=${pick.cuotaSugerida.toFixed(2)}`}
            rel="sponsored noopener"
            className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-3.5 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-premium-cta transition-all hover:-translate-y-px hover:bg-brand-gold-light"
          >
            💰 Apostar @ {pick.cuotaSugerida.toFixed(2)} en {pick.casa.nombre}
          </a>
        ) : null}

        {email ? (
          <p
            aria-hidden
            className="premium-watermark mt-3 text-center select-none"
          >
            {email}
          </p>
        ) : null}
      </div>
    </section>
  );
}
