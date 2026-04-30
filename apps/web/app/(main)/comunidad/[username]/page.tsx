// /comunidad/[username] — perfil público de un tipster.
//
// Lote 11 (May 2026). Lookup case-insensitive del @handle. Render:
//   - 404 si no existe.
//   - Estado "perfil privado" si el usuario tiene `perfilPublico=false`.
//   - Hero (avatar + @handle + nivel + "Tipster Habla! desde …") +
//     6 stats + 10 últimas predicciones FINALIZADAS + JSON-LD Person.
//
// SEO: OK schemas (Person + opcional aggregateRating si >20 predicciones).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerPerfilPublico } from "@/lib/services/perfil-publico.service";
import type {
  PerfilPublicoTicket,
  PerfilPublicoVista,
} from "@/lib/services/perfil-publico.service";

interface Props {
  params: { username: string };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const perfil = await obtenerPerfilPublico(params.username);
  if (!perfil) {
    return {
      title: "Tipster no encontrado · Habla!",
      robots: { index: false },
    };
  }
  if (perfil.privacidad === "privado") {
    return {
      title: `@${perfil.username} · Habla!`,
      description: "Este tipster mantiene su perfil privado.",
      robots: { index: false },
    };
  }
  return {
    title: `@${perfil.username} — Tipster en Habla!`,
    description: `Stats y últimas predicciones de @${perfil.username}: ${perfil.stats.jugadas} predicciones · ${perfil.stats.aciertoPct}% de acierto.`,
    alternates: { canonical: `/comunidad/${perfil.username}` },
  };
}

export default async function PerfilPublicoPage({ params }: Props) {
  const perfil = await obtenerPerfilPublico(params.username);
  if (!perfil) notFound();

  if (perfil.privacidad === "privado") {
    return <PerfilPrivado username={perfil.username} />;
  }

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6 md:py-8">
      <PersonJsonLd perfil={perfil} />

      <Link
        href="/comunidad"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-muted-d transition-colors hover:text-brand-blue-main"
      >
        ← Volver al leaderboard
      </Link>

      <Hero perfil={perfil} />
      <Stats perfil={perfil} />
      <Historial tickets={perfil.ultimasFinalizadas} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PerfilPrivado({ username }: { username: string }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 text-center md:py-24">
      <div aria-hidden className="mb-4 text-5xl">
        🔒
      </div>
      <h1 className="font-display text-[28px] font-black uppercase leading-tight text-dark md:text-[36px]">
        @{username}
      </h1>
      <p className="mt-3 text-[14px] leading-[1.6] text-body">
        Este usuario tiene su perfil <strong>privado</strong>. No se exponen
        sus stats ni su historial de predicciones.
      </p>
      <Link
        href="/comunidad"
        className="mt-6 inline-flex items-center justify-center rounded-md border-[1.5px] border-strong bg-transparent px-5 py-2.5 text-[13px] font-bold text-body transition-colors hover:border-brand-blue-main hover:text-brand-blue-main"
      >
        ← Volver al leaderboard
      </Link>
    </div>
  );
}

function Hero({ perfil }: { perfil: PerfilPublicoVista }) {
  const desdeStr = perfil.desde.toLocaleDateString("es-PE", {
    timeZone: "America/Lima",
    month: "long",
    year: "numeric",
  });
  return (
    <section className="relative mb-6 overflow-hidden rounded-lg bg-gradient-to-br from-brand-blue-main to-brand-blue-dark px-6 py-8 text-white shadow-lg md:px-8 md:py-10">
      <span
        aria-hidden
        className="absolute left-0 right-0 top-0 block h-[5px] animate-shimmer bg-gold-shimmer bg-[length:400px_100%]"
      />
      <div className="flex flex-wrap items-center gap-4 md:gap-6">
        <div
          aria-hidden
          className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-[#FF8C00] font-display text-[28px] font-black text-black shadow-gold md:h-[88px] md:w-[88px] md:text-[32px]"
        >
          {perfil.username.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-black uppercase leading-none text-white md:text-[40px]">
            @{perfil.username}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-[0.06em] text-white/80">
            <span className="rounded-full bg-white/15 px-3 py-1">
              {perfil.nivel.emoji} {perfil.nivel.label}
            </span>
            <span>·</span>
            <span>Tipster Habla! desde {desdeStr}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats({ perfil }: { perfil: PerfilPublicoVista }) {
  const { stats, mensual, torneosJugados } = perfil;
  const items: Array<{
    icon: string;
    value: string;
    label: string;
    tone: "neutral" | "gold" | "green" | "blue" | "purple";
  }> = [
    {
      icon: "🎯",
      value: stats.jugadas.toString(),
      label: "Predicciones",
      tone: "neutral",
    },
    {
      icon: "🏆",
      value: stats.ganadas.toString(),
      label: "Aciertos (Top 10)",
      tone: "gold",
    },
    {
      icon: "📈",
      value: `${stats.aciertoPct}%`,
      label: "% Acierto",
      tone: "green",
    },
    {
      icon: "🥇",
      value: mensual.mejorMes ? `#${mensual.mejorMes.posicion}` : "—",
      label: "Mejor mes",
      tone: "blue",
    },
    {
      icon: "⭐",
      value: stats.mejorPuesto ? `${stats.mejorPuesto}°` : "—",
      label: "Pos. histórica",
      tone: "purple",
    },
    {
      icon: "📅",
      value:
        mensual.posicionDelMes !== null
          ? `#${mensual.posicionDelMes}`
          : "—",
      label: `Mes actual${torneosJugados > 0 && mensual.posicionDelMes !== null ? ` · de ${mensual.totalUsuariosMes}` : ""}`,
      tone: "gold",
    },
  ];
  return (
    <section className="mb-6 grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => (
        <StatPill key={it.label} {...it} />
      ))}
    </section>
  );
}

function StatPill({
  icon,
  value,
  label,
  tone,
}: {
  icon: string;
  value: string;
  label: string;
  tone: "neutral" | "gold" | "green" | "blue" | "purple";
}) {
  const valueCls =
    tone === "gold"
      ? "text-brand-gold-dark"
      : tone === "green"
        ? "text-alert-success-text"
        : tone === "blue"
          ? "text-brand-blue-main"
          : tone === "purple"
            ? "text-accent-mundial-dark"
            : "text-dark";
  return (
    <div className="rounded-md border border-light bg-card px-2 py-3.5 text-center shadow-sm">
      <div aria-hidden className="mb-1 text-xl leading-none">
        {icon}
      </div>
      <div
        className={`font-display text-[18px] font-black leading-tight md:text-[20px] ${valueCls}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase leading-tight tracking-[0.05em] text-muted-d">
        {label}
      </div>
    </div>
  );
}

function Historial({ tickets }: { tickets: PerfilPublicoTicket[] }) {
  if (tickets.length === 0) {
    return (
      <section className="rounded-md border border-light bg-card px-5 py-8 text-center shadow-sm">
        <div aria-hidden className="mb-2 text-3xl">
          🗒️
        </div>
        <p className="text-sm font-semibold text-dark">
          Aún no hay predicciones finalizadas
        </p>
        <p className="mt-1 text-[12px] text-muted-d">
          Apenas finalice un torneo, las predicciones se reflejan aquí.
        </p>
      </section>
    );
  }
  return (
    <section className="overflow-hidden rounded-md border border-light bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-light bg-subtle px-5 py-3">
        <h2 className="font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-dark">
          🎯 Últimas {tickets.length} predicciones finalizadas
        </h2>
      </header>
      <ul className="divide-y divide-light">
        {tickets.map((t) => {
          const acerto =
            t.resultadoReal !== null && t.predResultado === t.resultadoReal;
          return (
            <li key={t.id} className="px-5 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
                    {t.partidoLiga} ·{" "}
                    {t.partidoFechaInicio.toLocaleDateString("es-PE", {
                      timeZone: "America/Lima",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                  <div className="mt-0.5 truncate font-display text-[14px] font-extrabold uppercase tracking-[0.02em] text-dark">
                    {t.partidoEquipoLocal} vs {t.partidoEquipoVisita}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    <span className="rounded-sm border border-light bg-subtle px-2 py-0.5 text-dark">
                      Predicción: {predicionLabel(t.predResultado)}
                    </span>
                    {t.resultadoReal !== null ? (
                      <span
                        className={`rounded-sm px-2 py-0.5 font-bold ${
                          acerto
                            ? "bg-pred-correct-bg text-alert-success-text"
                            : "bg-pred-wrong-bg text-pred-wrong"
                        }`}
                      >
                        {acerto ? "✓ Acertó" : "✕ Falló"}
                      </span>
                    ) : (
                      <span className="rounded-sm bg-subtle px-2 py-0.5 text-muted-d">
                        Pendiente
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="font-display text-[22px] font-black leading-none text-brand-gold-dark">
                    {t.puntosFinales}
                    <span className="ml-1 text-[10px] font-bold text-muted-d">
                      pts
                    </span>
                  </div>
                  {t.posicionFinal !== null ? (
                    <div className="mt-0.5 text-[10px] text-muted-d">
                      Pos. #{t.posicionFinal}
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function predicionLabel(pred: string): string {
  if (pred === "LOCAL") return "Local";
  if (pred === "EMPATE") return "Empate";
  if (pred === "VISITA") return "Visita";
  return pred;
}

function PersonJsonLd({ perfil }: { perfil: PerfilPublicoVista }) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
  const aggregateRating =
    perfil.stats.jugadas > 20
      ? {
          // Mapeamos % de acierto (0-100) a un rating 0-5 estrellas.
          "@type": "AggregateRating",
          ratingValue: (perfil.stats.aciertoPct / 20).toFixed(2),
          ratingCount: perfil.stats.jugadas,
          bestRating: "5",
          worstRating: "0",
        }
      : undefined;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: `@${perfil.username}`,
    alternateName: perfil.nombre || `@${perfil.username}`,
    url: `${baseUrl}/comunidad/${perfil.username}`,
    description: `Tipster en Habla! · Nivel ${perfil.nivel.label} · ${perfil.stats.jugadas} predicciones realizadas.`,
    memberOf: {
      "@type": "Organization",
      name: "Habla!",
      url: baseUrl,
    },
  };
  if (aggregateRating) data.aggregateRating = aggregateRating;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
