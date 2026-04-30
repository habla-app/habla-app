// PremiumTeaserHome — card oscura con badge "Pick Premium del día".
// Lote B (nuevo). Spec:
// docs/ux-spec/02-pista-usuario-publica/home.spec.md §"Estructura completa".
//
// Si usuario es Premium → no se renderiza (oculto en home).
// Si usuario NO es Premium → render con blur + lock + CTA "Probar 7 días".
//
// Mientras Lote E no exista (sin modelo `PickPremium`), se renderiza el
// fallback "Próximamente picks Premium" con CTA al landing /premium.

import Link from "next/link";
import type { EstadoUsuario } from "@/lib/services/estado-usuario.service";

interface PickPreview {
  partidoNombre: string;
  mercado: string;
  cuotaSugerida: number;
  razonamientoPreview: string;
}

interface Props {
  estado: EstadoUsuario;
  pickPreview?: PickPreview | null;
}

export function PremiumTeaserHome({ estado, pickPreview }: Props) {
  if (estado === "premium") return null;

  const tienePick = !!pickPreview;
  const ctaHref = "/premium";
  const ctaLabel =
    estado === "anonimo"
      ? "Desbloquear con Premium"
      : estado === "ftd"
        ? "Probar 7 días gratis"
        : "Probar Premium 7 días";

  return (
    <section
      aria-label="Pick Premium del día"
      className="relative mb-12 overflow-hidden rounded-md bg-premium-card-gradient p-5 shadow-premium-card md:p-7"
    >
      <span
        aria-hidden
        className="absolute inset-0 bg-gold-soft-glow opacity-60"
      />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full bg-brand-gold px-2.5 py-0.5 text-label-sm text-black"
            aria-hidden
          >
            💎 Premium
          </span>
          <span className="text-body-xs text-premium-text-soft-on-dark">
            Pick del día
          </span>
        </div>

        {tienePick ? (
          <div>
            <p className="mb-1 text-display-sm text-premium-text-on-dark">
              {pickPreview!.partidoNombre}
            </p>
            <p className="mb-3 text-body-sm text-premium-text-muted-on-dark">
              {pickPreview!.mercado} · cuota{" "}
              <strong className="text-brand-gold">
                {pickPreview!.cuotaSugerida.toFixed(2)}
              </strong>
            </p>
            <div className="relative mb-4 rounded-md bg-premium-blur-content p-4">
              <p className="select-none text-body-sm leading-[1.55] text-premium-text-soft-on-dark blur-[3px]">
                {pickPreview!.razonamientoPreview}
              </p>
              <div className="absolute inset-0 flex items-center justify-center">
                <span aria-hidden className="text-3xl">
                  🔒
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <p className="mb-2 text-display-md text-premium-text-on-dark">
              Picks por WhatsApp con análisis estadístico
            </p>
            <p className="text-body-sm leading-[1.55] text-premium-text-muted-on-dark">
              2-4 picks/día con razonamiento basado en datos. Llega directo a
              tu WhatsApp.
            </p>
          </div>
        )}

        <Link
          href={ctaHref}
          className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-3.5 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-premium-cta transition-all hover:-translate-y-px hover:bg-brand-gold-light"
        >
          ⚡ {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
