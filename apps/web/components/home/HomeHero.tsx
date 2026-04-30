// HomeHero v3.1 — Lote B (rewrite del Lote 11).
// Spec: docs/ux-spec/02-pista-usuario-publica/home.spec.md.
//
// Hero editorial mobile-first. Tagline pivota a "Todas las fijas en una"
// (slogan oficial del modelo v3.1 + WhatsApp Channel Premium). Los CTAs
// se personalizan según el estado del usuario:
//
// - anonimo: "Empezar gratis" + "Ver pronósticos del día"
// - free:    "Hola Juan" + "Tus partidos"
// - ftd:     "Hola Juan" + "Próximos picks"
// - premium: "Hola Juan, suscriptor 💎" + "Ver mi canal"
//
// Componente puro de presentación — no fetchea datos.

import Link from "next/link";
import type { EstadoUsuario } from "@/lib/services/estado-usuario.service";

interface Props {
  estadoUsuario: EstadoUsuario;
  nombreUsuario?: string | null;
}

export function HomeHero({ estadoUsuario, nombreUsuario }: Props) {
  const greeting = saludo(estadoUsuario, nombreUsuario);
  const ctas = ctaSet(estadoUsuario);

  return (
    <section className="relative mb-8 overflow-hidden rounded-lg bg-gradient-to-b from-brand-blue-dark via-[#000530] to-[#000420] px-5 py-9 text-white shadow-lg md:px-10 md:py-14">
      {/* Franja dorada animada arriba */}
      <span
        aria-hidden
        className="absolute left-0 right-0 top-0 block h-[5px] animate-shimmer bg-gold-shimmer bg-[length:400px_100%]"
      />
      {/* Decoración con emoji gigante */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-30px] top-[-30px] -rotate-[15deg] select-none text-[180px] leading-none opacity-[0.06] md:text-[260px]"
      >
        ⚽
      </div>

      <div className="relative max-w-2xl">
        <p className="mb-3 font-display text-[12px] font-bold uppercase tracking-[0.12em] text-brand-gold">
          {greeting.eyebrow}
        </p>
        <h1 className="font-display text-display-xl uppercase leading-[0.95] tracking-[0.01em] text-white md:text-[64px]">
          {greeting.title}
        </h1>
        <p className="mt-5 text-body-lg leading-[1.6] text-white/80 md:text-[17px]">
          {greeting.subtitle}
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={ctas.primary.href}
            className="touch-target inline-flex items-center justify-center gap-2 rounded-md bg-brand-gold px-6 py-3.5 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light hover:shadow-gold md:text-[15px]"
          >
            {ctas.primary.label}
            <span aria-hidden>→</span>
          </Link>
          <Link
            href={ctas.secondary.href}
            className="touch-target inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-white/30 bg-white/[0.06] px-6 py-3.5 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-white backdrop-blur-sm transition-all hover:border-white/60 hover:bg-white/[0.12] md:text-[15px]"
          >
            {ctas.secondary.label}
          </Link>
        </div>
      </div>
    </section>
  );
}

interface Greeting {
  eyebrow: string;
  title: string;
  subtitle: string;
}

function saludo(estado: EstadoUsuario, nombre?: string | null): Greeting {
  const nombreCorto = (nombre ?? "").split(" ")[0]?.trim() || "tipster";

  if (estado === "premium") {
    return {
      eyebrow: "Suscriptor Premium 💎",
      title: `Hola ${nombreCorto}`,
      subtitle:
        "Tus picks llegan al WhatsApp Channel privado · 2-4 al día con análisis estadístico.",
    };
  }
  if (estado === "ftd" || estado === "free") {
    return {
      eyebrow: "Comunidad gratuita · Premios reales",
      title: `Hola ${nombreCorto}, todas las fijas en una`,
      subtitle:
        "Análisis editorial, comparador de cuotas y Liga Habla! con S/ 1,250 al mes en premios.",
    };
  }
  return {
    eyebrow: "Habla! · Pronósticos en Perú",
    title: "Todas las fijas en una",
    subtitle:
      "Comunidad gratuita de pronósticos deportivos. Compite por S/ 1,250 cada mes — sin gastar un sol.",
  };
}

function ctaSet(estado: EstadoUsuario) {
  if (estado === "premium") {
    return {
      primary: { label: "Mi suscripción", href: "/premium/mi-suscripcion" },
      secondary: { label: "Cuotas comparadas", href: "/cuotas" },
    };
  }
  if (estado === "ftd") {
    return {
      primary: { label: "Probar Premium 7 días", href: "/premium" },
      secondary: { label: "Ver pronósticos", href: "/pronosticos" },
    };
  }
  if (estado === "free") {
    return {
      primary: { label: "Tus partidos", href: "/cuotas" },
      secondary: { label: "Liga Habla!", href: "/comunidad" },
    };
  }
  return {
    primary: { label: "Empezar gratis", href: "/auth/signup" },
    secondary: { label: "Ver pronósticos", href: "/pronosticos" },
  };
}
