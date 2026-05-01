// TorneoHero — hero de la vista /comunidad/torneo/[slug] (Lote C v3.1).
// Spec: docs/ux-spec/03-pista-usuario-autenticada/comunidad-torneo-slug.spec.md.
//
// Layout mobile-first: gradient navy → blue + dos pills horizontales (tipsters
// compitiendo + countdown) + título grande "Predice X vs Y" en Barlow
// Condensed + sub motivacional + <CrossProductBanner direction="C-to-B"> al
// pie del hero linkeando a /partidos/[slug] (Producto B).
//
// Lote C consume `<CrossProductBanner>` del Lote A directamente, así el
// link y el copy quedan unificados con la pista pública.

import { CrossProductBanner } from "@/components/ui/mobile";
import { formatCountdown } from "@/lib/utils/datetime";

interface TorneoHeroProps {
  partidoSlug: string;
  equipoLocal: string;
  equipoVisita: string;
  totalInscritos: number;
  cierreAt: Date;
  /** Combina estados de partido (`PROGRAMADO`/`EN_VIVO`/`FINALIZADO`/
   *  `CANCELADO`) y de torneo (`EN_JUEGO`) en un único enum visual. La page
   *  resuelve cuál mostrar (priorizando partido en vivo cuando aplica). */
  estado:
    | "PROGRAMADO"
    | "ABIERTO"
    | "EN_VIVO"
    | "EN_JUEGO"
    | "CERRADO"
    | "FINALIZADO"
    | "CANCELADO";
  marcadorLocal: number | null;
  marcadorVisita: number | null;
}

export function TorneoHero({
  partidoSlug,
  equipoLocal,
  equipoVisita,
  totalInscritos,
  cierreAt,
  estado,
  marcadorLocal,
  marcadorVisita,
}: TorneoHeroProps) {
  const enVivo = estado === "EN_VIVO" || estado === "EN_JUEGO";
  const finalizado = estado === "FINALIZADO";
  const countdown = !enVivo && !finalizado
    ? formatCountdown(cierreAt).replace(/^Cierra en\s*/i, "")
    : null;

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-blue-mid via-brand-blue-main to-brand-blue-dark px-4 pb-6 pt-5 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-soft-glow"
      />

      <div className="relative">
        {/* Pills row */}
        <div className="mb-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/50 bg-brand-gold/20 px-2.5 py-1 text-label-sm font-bold uppercase tracking-[0.05em] text-brand-gold-light">
            <span aria-hidden>⚡</span>
            {totalInscritos.toLocaleString("es-PE")} tipster
            {totalInscritos === 1 ? "" : "s"}
          </span>
          {enVivo ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-urgent-critical/50 bg-urgent-critical/20 px-2.5 py-1 text-label-sm font-bold uppercase tracking-[0.05em] text-white">
              <span
                aria-hidden
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-white"
              />
              EN VIVO
              {marcadorLocal !== null && marcadorVisita !== null
                ? ` · ${marcadorLocal}-${marcadorVisita}`
                : ""}
            </span>
          ) : finalizado ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/50 bg-brand-green/20 px-2.5 py-1 text-label-sm font-bold uppercase tracking-[0.05em] text-white">
              <span aria-hidden>✓</span>
              FINAL
              {marcadorLocal !== null && marcadorVisita !== null
                ? ` · ${marcadorLocal}-${marcadorVisita}`
                : ""}
            </span>
          ) : countdown ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-urgent-critical/40 bg-urgent-critical/15 px-2.5 py-1 text-label-sm font-bold uppercase tracking-[0.05em] text-white/90">
              <span aria-hidden>⏱</span>
              {countdown}
            </span>
          ) : null}
        </div>

        {/* Título */}
        <div className="text-center">
          <p className="font-display text-display-sm font-bold uppercase tracking-[0.06em] text-brand-gold-light">
            Predice
          </p>
          <h1 className="mt-1 font-display text-display-md font-black uppercase leading-[1.05]">
            {equipoLocal}
            <span className="mx-2 text-white/60">vs</span>
            {equipoVisita}
          </h1>
          <p className="mt-2 text-body-sm text-white/75">
            Suma hasta 21 puntos · Top 10 gana S/ 1,250
          </p>
        </div>

        {/* Cross-product banner */}
        <div className="mt-5">
          <CrossProductBanner
            direction="C-to-B"
            partidoSlug={partidoSlug}
            tone="dark"
          />
        </div>
      </div>
    </section>
  );
}
