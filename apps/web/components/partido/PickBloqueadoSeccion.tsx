// PickBloqueadoSeccion — sección oscura "💎 Pick Premium del editor".
// Lote B v3.1. Spec:
// docs/ux-spec/02-pista-usuario-publica/partidos-slug.spec.md.
//
// Comportamiento por estado del usuario:
// - premium → renderiza el pick desbloqueado con razonamiento completo +
//   cuota recomendada + casa.
// - resto   → blur + lock overlay + CTA "⚡ Probar 7 días gratis".
//
// Si NO hay pick para el partido (Lote E aún no creó el modelo), muestra
// un placeholder sobrio con CTA al landing /premium. NO se rompe.

import Link from "next/link";
import type { EstadoUsuario } from "@/lib/services/estado-usuario.service";

interface PickPremium {
  mercado: string;
  recomendacion: string;
  cuotaSugerida: number;
  casaNombre: string;
  casaSlug: string;
  stake: number;
  evCalculado?: number | null;
  razonamiento: string;
}

interface Props {
  pick: PickPremium | null;
  estadoUsuario: EstadoUsuario;
  /** Email del usuario logueado (para watermark si Premium). */
  email?: string | null;
}

export function PickBloqueadoSeccion({ pick, estadoUsuario, email }: Props) {
  const esPremium = estadoUsuario === "premium";

  // Caso 1: Premium con pick → desbloqueado
  if (esPremium && pick) {
    return (
      <section
        aria-label="Pick Premium desbloqueado"
        className="relative my-6 overflow-hidden rounded-md bg-premium-card-gradient p-5 shadow-premium-card md:p-7"
      >
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

          <p className="mb-2 text-display-md text-premium-text-on-dark">
            {pick.recomendacion}
          </p>
          <p className="mb-3 text-body-md text-premium-text-muted-on-dark">
            {pick.mercado} · cuota{" "}
            <strong className="text-brand-gold">
              {pick.cuotaSugerida.toFixed(2)}
            </strong>{" "}
            en <strong className="text-white">{pick.casaNombre}</strong> · stake{" "}
            <strong className="text-white">{pick.stake}u</strong>
            {pick.evCalculado !== null && pick.evCalculado !== undefined ? (
              <>
                {" "}
                · EV{" "}
                <span className="text-status-green">
                  +{(pick.evCalculado * 100).toFixed(1)}%
                </span>
              </>
            ) : null}
          </p>

          <div className="mb-4 rounded-md bg-premium-blur-content p-4">
            <p className="text-body-sm leading-[1.55] text-premium-text-on-dark">
              {pick.razonamiento}
            </p>
          </div>

          <a
            href={`/go/${pick.casaSlug}?utm_source=pick-premium&utm_medium=partido&cuota=${pick.cuotaSugerida}`}
            rel="sponsored noopener"
            className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-3.5 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-premium-cta transition-all hover:-translate-y-px hover:bg-brand-gold-light"
          >
            💰 Apostar @ {pick.cuotaSugerida.toFixed(2)} en {pick.casaNombre}
          </a>

          {email ? (
            <p className="premium-watermark mt-3 text-center">{email}</p>
          ) : null}
        </div>
      </section>
    );
  }

  // Caso 2: NO premium (con o sin pick) → bloqueado / fallback
  const tienePick = !!pick;
  const ctaLabel =
    estadoUsuario === "anonimo"
      ? "Crear cuenta y desbloquear"
      : "⚡ Probar 7 días gratis";

  return (
    <section
      aria-label="Pick Premium bloqueado"
      className="relative my-6 overflow-hidden rounded-md bg-premium-card-gradient p-5 shadow-premium-card md:p-7"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gold-soft-glow opacity-30"
      />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold px-2.5 py-0.5 text-label-sm text-black">
            💎 Premium
          </span>
          <span className="text-body-xs text-premium-text-soft-on-dark">
            {tienePick ? "Pick del editor" : "Próximamente"}
          </span>
        </div>

        <p className="mb-2 text-display-md text-premium-text-on-dark">
          {tienePick ? pick.recomendacion : "Pick del editor para este partido"}
        </p>

        {tienePick ? (
          <p className="mb-3 text-body-sm text-premium-text-muted-on-dark">
            {pick.mercado} · cuota recomendada cargando…
          </p>
        ) : (
          <p className="mb-3 text-body-sm leading-[1.55] text-premium-text-muted-on-dark">
            Análisis estadístico, cuota sugerida con EV+ y stake recomendado.
            Llega directo a tu WhatsApp.
          </p>
        )}

        <div className="relative mb-4 rounded-md bg-premium-blur-content p-4">
          <p className="select-none text-body-sm leading-[1.55] text-premium-text-soft-on-dark blur-[3px]">
            {tienePick
              ? pick.razonamiento.slice(0, 120) + "…"
              : "Análisis basado en estadísticas avanzadas: forma reciente, xG, cabeza a cabeza, lesiones reportadas y línea actual del mercado…"}
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <span aria-hidden className="text-3xl">
              🔒
            </span>
          </div>
        </div>

        <Link
          href={
            estadoUsuario === "anonimo"
              ? "/auth/signup?callbackUrl=/premium"
              : "/premium"
          }
          className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-3.5 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-premium-cta transition-all hover:-translate-y-px hover:bg-brand-gold-light"
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
