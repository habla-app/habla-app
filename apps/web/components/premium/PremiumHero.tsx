// PremiumHero — hero oscuro de la landing /premium (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/premium-landing.spec.md.
//
// Hero con crown dorada + título "Picks de valor en tu WhatsApp" con la
// frase "en tu WhatsApp" en gold. Sub con value-prop. Personalizado por
// estado del usuario:
// - anonimo: copy genérico
// - free: saludo + value-prop estándar
// - ftd: copy más agresivo si tenemos su acierto

import type { EstadoUsuario } from "@/lib/services/estado-usuario.service";

interface Props {
  estadoUsuario: EstadoUsuario;
  nombre?: string | null;
  /** Acierto % del usuario (FTD). Si está, se usa en el sub. */
  aciertoPropio?: number | null;
}

export function PremiumHero({ estadoUsuario, nombre, aciertoPropio }: Props) {
  let titulo = (
    <>
      Picks de valor
      <br />
      <span className="text-brand-gold">en tu WhatsApp</span>
    </>
  );
  let subtitulo =
    "Recibe 2-4 picks/día generados con datos y validados por nuestro editor. Directo en tu canal privado.";

  if (estadoUsuario === "free" && nombre) {
    titulo = (
      <>
        Hola {nombre}
        <br />
        <span className="text-brand-gold">tu Premium te espera</span>
      </>
    );
  }

  if (estadoUsuario === "ftd" && typeof aciertoPropio === "number") {
    titulo = (
      <>
        Tu acierto: {aciertoPropio}%
        <br />
        <span className="text-brand-gold">Premium llega a 65%</span>
      </>
    );
    subtitulo =
      "Picks con razonamiento estadístico de nuestro editor. Más datos, mejores decisiones.";
  }

  return (
    <header
      aria-label="Premium — Habla! Picks"
      className="relative overflow-hidden bg-premium-hero-gradient px-4 pb-7 pt-10 text-center text-white md:pt-14"
    >
      <div
        aria-hidden
        className="mx-auto mb-3.5 flex h-[60px] w-[60px] items-center justify-center rounded-md bg-gradient-to-br from-brand-gold to-brand-gold-light text-3xl shadow-premium-cta"
      >
        💎
      </div>
      <h1 className="font-display text-display-xl font-black uppercase leading-none tracking-tight md:text-[36px]">
        {titulo}
      </h1>
      <p className="mx-auto mt-3 max-w-[320px] text-body-sm leading-[1.5] text-premium-text-muted-on-dark">
        {subtitulo}
      </p>
    </header>
  );
}
