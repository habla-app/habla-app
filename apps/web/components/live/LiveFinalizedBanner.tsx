// LiveFinalizedBanner — banda motivacional que se muestra AL FINAL
// del detalle post-partido (`/live-match?torneoId=<finished>`). Bug #16.
//
// Invita al usuario a seguir jugando el próximo torneo disponible,
// cerrando el loop: "acabo de ver cómo terminó esta combinada → veo
// que hay uno próximo a arrancar → me inscribo".
//
// Props:
//   - proximoTorneoId (opcional): si el servidor conoce el próximo
//     torneo abierto (el más cercano a cerrar), linkea directo al
//     detalle. Si no, CTA genérico a /matches.

import Link from "next/link";

interface Props {
  proximoTorneoId: string | null;
}

export function LiveFinalizedBanner({ proximoTorneoId }: Props) {
  const href = proximoTorneoId
    ? `/torneo/${proximoTorneoId}`
    : "/matches";
  const label = proximoTorneoId
    ? "Ir al próximo torneo →"
    : "Ver torneos abiertos →";

  return (
    <section
      className="mt-6 rounded-lg border border-brand-gold/40 bg-hero-blue p-6 text-center text-white shadow-md"
      data-testid="live-finalized-banner"
      aria-label="Continuar jugando"
    >
      <div aria-hidden className="mb-2 text-3xl">
        🎯
      </div>
      <h2 className="mb-1 font-display text-[22px] font-black uppercase tracking-[0.02em]">
        El próximo torneo te espera
      </h2>
      <p className="mx-auto mb-4 max-w-[500px] text-[13px] text-white/80">
        Este partido ya terminó. Entrá a otro torneo, armá tu combinada de 5
        predicciones y competí por el pozo.
      </p>
      <Link
        href={href}
        data-testid="live-finalized-banner-cta"
        className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-gold px-6 py-3 font-display text-[15px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light"
      >
        {label}
      </Link>
    </section>
  );
}
