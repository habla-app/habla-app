// /las-fijas/[slug] — Lote M v3.2 (May 2026).
// Spec: docs/habla-mockup-v3.2.html § page-fijas-detail.
//
// Vista crítica de la pista usuario v3.2: paywall por nivel sobre los
// bloques del análisis rico (decisión §1.1 + §1.2 del análisis).
//
// Diferencia clave con la versión Lote B/E:
//   - Antes: contenido vivía en MDX + PickPremium 1-mercado para canal.
//   - Ahora: contenido vivía en AnalisisPartido (objeto rico, Lote K + L).
//     Slug derivado de equipos+fecha (no MDX). Si análisis está ARCHIVADO
//     (Filtro 1 desactivado por admin) → HTTP 410 Gone, no 404.
//
// Bloques en orden:
//   1. PartidoHero (común)
//   2. PronosticoLibreCard (Free + Socios — pronóstico 1X2 + mejor cuota)
//   3. AnalisisBasicoCard (Free + Socios — forma, H2H, lesiones)
//   4. CombinadaOptimaCard (Socios) | BloqueoSociosTeaser (no-Socios)
//   5. RazonamientoDetalladoCard (Socios) | teaser
//   6. AnalisisGolesCard (Socios) | teaser
//   7. AnalisisTarjetasCard (Socios) | teaser
//   8. MercadosSecundariosCard (Socios) | teaser
//   9. LigaWidgetInline (cross-link a /liga/[slug])
//  10. PartidoCierreCtas (Liga + Socios CTAs según estado)

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@habla/db";
import { auth } from "@/lib/auth";
import { obtenerEstadoAuthServer } from "@/lib/services/auth-state.service";
import { resolverFijaPorSlug } from "@/lib/services/las-fijas.service";
import { AuthGate } from "@/components/auth/AuthGate";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { BackToTop } from "@/components/legal/BackToTop";
import { PartidoHero } from "@/components/partido/PartidoHero";
import { LigaWidgetInline } from "@/components/partido/LigaWidgetInline";
import { SoporteFooter } from "@/components/partido/SoporteFooter";
import { PronosticoLibreCard } from "@/components/fijas/PronosticoLibreCard";
import { AnalisisBasicoCard } from "@/components/fijas/AnalisisBasicoCard";
import { BloqueoSociosTeaser } from "@/components/fijas/BloqueoSociosTeaser";
import { CombinadaOptimaCard } from "@/components/fijas/CombinadaOptimaCard";
import { RazonamientoDetalladoCard } from "@/components/fijas/RazonamientoDetalladoCard";
import {
  AnalisisGolesCard,
  AnalisisTarjetasCard,
} from "@/components/fijas/AnalisisProfundoCard";
import { MercadosSecundariosCard } from "@/components/fijas/MercadosSecundariosCard";
import { PartidoCierreCtas } from "@/components/fijas/PartidoCierreCtas";

interface Params {
  slug: string;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const r = await resolverFijaPorSlug(params.slug);
  if (r.estado !== "found" || !r.partido) {
    return { title: "Fija no encontrada · Habla!", robots: { index: false } };
  }
  const { equipoLocal, equipoVisita, liga } = r.partido;
  return {
    title: `${equipoLocal} vs ${equipoVisita} · ${liga} · Habla!`,
    description: `Pronóstico Habla! 1X2, mejores cuotas comparadas y análisis del partido ${equipoLocal} vs ${equipoVisita}.`,
    alternates: { canonical: `/las-fijas/${params.slug}` },
    openGraph: {
      type: "article",
      title: `${equipoLocal} vs ${equipoVisita} | Habla!`,
      description: `Análisis y pronóstico del partido en ${liga}.`,
    },
  };
}

export default async function FijaDetallePage({
  params,
}: {
  params: Params;
}) {
  const resolved = await resolverFijaPorSlug(params.slug);

  if (resolved.estado === "archived") {
    // HTTP 410 Gone — el partido tenía análisis aprobado pero el admin
    // desactivó Filtro 1. Le decimos a Google "esto se retiró
    // intencionalmente" y devolvemos una vista informativa al humano.
    return <FijaArchivada />;
  }
  if (resolved.estado !== "found" || !resolved.partido) {
    notFound();
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const estadoAuth = await obtenerEstadoAuthServer(userId);
  const partido = resolved.partido;
  const analisis = resolved.analisisAprobado;

  // Cross-link a Liga: solo si el partido tiene Filtro 2 ON y un torneo
  // creado. Best-effort — si la query falla, el widget no se renderiza.
  const torneoCrossLink = await prisma.torneo
    .findFirst({
      where: { partidoId: partido.id, estado: { not: "CANCELADO" } },
      orderBy: { creadoEn: "desc" },
      select: { id: true, totalInscritos: true, partido: { select: { elegibleLiga: true } } },
    })
    .catch(() => null);

  const cebos = {
    combinada:
      "Combinada Local + Más 2.5 @ 2.10 con stake 2% del bankroll · EV+ 8.4% · 5 stats clave",
    razonamiento:
      "Forma reciente últimos 5 partidos: 4G 1E 0P. Lesiones clave del rival: 2 defensores titulares fuera. Probabilidad real bayesiana 47% vs implícita 38%.",
    goles:
      "xG Local 1.85 · xG Visita 0.92 · ratio de tiros al arco 1.7x. Probabilidad +2.5 goles 62%.",
    tarjetas:
      "Promedio combinado 4.2 tarjetas/partido. Riesgo roja: MEDIO. Árbitro saca 0.8 amarillas más que el promedio.",
    mercados:
      "BTTS Sí @ 1.78 (EV+ 4.2% Betsson) · +2.5 goles @ 1.85 (EV+ 5.8% Betano) · Marcador 2-1 @ 6.5 (EV+ 9.2%)",
  };

  return (
    <article className="mx-auto w-full max-w-[1100px]">
      <SportsEventJsonLd partido={partido} slug={params.slug} />
      <TrackOnMount
        event="fija_detalle_vista"
        props={{
          slug: params.slug,
          partidoId: partido.id,
          tieneAnalisis: !!analisis,
          estadoAuth,
        }}
      />

      <PartidoHero
        liga={partido.liga}
        equipoLocal={partido.equipoLocal}
        equipoVisita={partido.equipoVisita}
        fechaInicio={partido.fechaInicio}
        estadio={partido.venue}
        estado={mapEstadoPartido(partido.estado)}
        marcadorLocal={partido.golesLocal}
        marcadorVisita={partido.golesVisita}
        minuto={partido.liveElapsed}
      />

      <div className="space-y-5 px-4 py-6 md:px-6 md:py-8">
        {analisis ? (
          <>
            {/* 1. Pronóstico Habla! 1X2 + mejor cuota Local — Free + Socios */}
            <PronosticoLibreCard
              pronostico={analisis.pronostico1x2}
              probabilidades={analisis.probabilidades}
              mejorCuota={analisis.mejorCuota}
              equipoLocal={partido.equipoLocal}
              equipoVisita={partido.equipoVisita}
            />

            {/* 2. Análisis básico (forma, H2H, lesiones) — Free + Socios */}
            <AnalisisBasicoCard texto={analisis.analisisBasico} />

            {/* 3. Combinada óptima — Socios | Teaser para no-Socios */}
            <AuthGate
              state="socios"
              fallback={
                <BloqueoSociosTeaser
                  titulo="Combinada óptima + stake + EV+"
                  cebo={cebos.combinada}
                  inclusiones={[
                    "Combinada de 2-3 mercados con EV+ ≥ 5%",
                    "Stake sugerido como % de bankroll",
                    "EV+ realizado del histórico del motor",
                  ]}
                  variant={estadoAuth === "visitor" ? "registrate" : "hacete-socio"}
                />
              }
            >
              {analisis.combinadaOptima ? (
                <CombinadaOptimaCard data={analisis.combinadaOptima as never} />
              ) : null}
            </AuthGate>

            {/* 4. Razonamiento detallado — Socios | Teaser */}
            <AuthGate
              state="socios"
              fallback={
                <BloqueoSociosTeaser
                  titulo="Razonamiento estadístico detallado"
                  cebo={cebos.razonamiento}
                  inclusiones={[
                    "Análisis de forma reciente últimos 5 partidos",
                    "Estado de lesiones y bajas claves",
                    "Comparativa probabilidad real vs implícita en cuotas",
                  ]}
                  variant={estadoAuth === "visitor" ? "registrate" : "hacete-socio"}
                />
              }
            >
              {analisis.razonamiento ? (
                <RazonamientoDetalladoCard texto={analisis.razonamiento} />
              ) : null}
            </AuthGate>

            {/* 5. Análisis profundo de goles — Socios | Teaser */}
            <AuthGate
              state="socios"
              fallback={
                <BloqueoSociosTeaser
                  titulo="Análisis profundo de goles esperados"
                  cebo={cebos.goles}
                  inclusiones={[
                    "xG (goles esperados) por equipo",
                    "Factores que mueven el over/under",
                    "Probabilidad de cada total de goles",
                  ]}
                  variant={estadoAuth === "visitor" ? "registrate" : "hacete-socio"}
                />
              }
            >
              {analisis.analisisGoles ? (
                <AnalisisGolesCard
                  data={analisis.analisisGoles as never}
                  equipoLocal={partido.equipoLocal}
                  equipoVisita={partido.equipoVisita}
                />
              ) : null}
            </AuthGate>

            {/* 6. Análisis profundo de tarjetas — Socios | Teaser */}
            <AuthGate
              state="socios"
              fallback={
                <BloqueoSociosTeaser
                  titulo="Análisis profundo de tarjetas"
                  cebo={cebos.tarjetas}
                  inclusiones={[
                    "Tarjetas esperadas por equipo",
                    "Riesgo de tarjeta roja (BAJO/MEDIO/ALTO)",
                    "Estilo del árbitro y disciplina histórica",
                  ]}
                  variant={estadoAuth === "visitor" ? "registrate" : "hacete-socio"}
                />
              }
            >
              {analisis.analisisTarjetas ? (
                <AnalisisTarjetasCard data={analisis.analisisTarjetas as never} />
              ) : null}
            </AuthGate>

            {/* 7. Mercados secundarios con value — Socios | Teaser */}
            <AuthGate
              state="socios"
              fallback={
                <BloqueoSociosTeaser
                  titulo="Mercados secundarios con value"
                  cebo={cebos.mercados}
                  inclusiones={[
                    "BTTS, ±2.5 goles, marcador exacto, tarjetas",
                    "EV+ por mercado contra cuota implícita",
                    "Casa con la mejor cuota disponible",
                  ]}
                  variant={estadoAuth === "visitor" ? "registrate" : "hacete-socio"}
                />
              }
            >
              {Array.isArray(analisis.mercadosSecundarios) ? (
                <MercadosSecundariosCard
                  mercados={analisis.mercadosSecundarios as never}
                />
              ) : null}
            </AuthGate>
          </>
        ) : (
          <AnalisisPendiente />
        )}

        {/* Cross-link a Liga */}
        <LigaWidgetInline
          torneoId={
            torneoCrossLink && torneoCrossLink.partido?.elegibleLiga
              ? torneoCrossLink.id
              : null
          }
          partidoSlug={params.slug}
          totalInscritos={torneoCrossLink?.totalInscritos ?? 0}
        />

        {/* CTAs cierre */}
        <PartidoCierreCtas partidoSlug={params.slug} />

        {/* Soporte / juego responsable */}
        <SoporteFooter />
      </div>

      <BackToTop />
    </article>
  );
}

// ---------------------------------------------------------------------------
// Sub-vistas
// ---------------------------------------------------------------------------

function AnalisisPendiente() {
  return (
    <section className="rounded-md border border-dashed border-light bg-card px-5 py-10 text-center">
      <p className="font-display text-display-md text-dark">
        Análisis en preparación
      </p>
      <p className="mx-auto mt-3 max-w-[480px] text-body-sm leading-[1.55] text-muted-d">
        El motor está procesando este partido. El editor lo aprueba antes de
        publicarlo y vas a poder ver el pronóstico Habla! acá en cuestión de
        minutos.
      </p>
    </section>
  );
}

function FijaArchivada() {
  return (
    <article className="mx-auto w-full max-w-[640px] px-4 py-16 text-center md:py-24">
      <div aria-hidden className="mb-4 text-5xl">
        🗄️
      </div>
      <h1 className="font-display text-display-lg font-black leading-tight text-dark">
        Esta fija fue retirada
      </h1>
      <p className="mt-3 text-body-md text-body">
        Este análisis ya no está disponible. Mirá el resto de las fijas
        cubiertas o sumate a la Liga del mes.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/las-fijas"
          className="inline-flex items-center justify-center rounded-md bg-brand-gold px-5 py-3 font-display text-label-md font-extrabold uppercase text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light"
        >
          Ver Las Fijas
        </Link>
        <Link
          href="/liga"
          className="inline-flex items-center justify-center rounded-md border-2 border-strong bg-card px-5 py-3 font-display text-label-md font-extrabold uppercase text-body transition-colors hover:border-brand-blue-main hover:text-brand-blue-main"
        >
          Liga del mes
        </Link>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapEstadoPartido(
  estado: "PROGRAMADO" | "EN_VIVO" | "FINALIZADO",
): "programado" | "en_vivo" | "finalizado" {
  if (estado === "EN_VIVO") return "en_vivo";
  if (estado === "FINALIZADO") return "finalizado";
  return "programado";
}

function SportsEventJsonLd({
  partido,
  slug,
}: {
  partido: {
    liga: string;
    equipoLocal: string;
    equipoVisita: string;
    fechaInicio: Date;
    venue: string | null;
  };
  slug: string;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
  const data = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${partido.equipoLocal} vs ${partido.equipoVisita}`,
    description: `Análisis Habla! del partido ${partido.equipoLocal} vs ${partido.equipoVisita} en ${partido.liga}.`,
    startDate: partido.fechaInicio.toISOString(),
    location: partido.venue
      ? { "@type": "Place", name: partido.venue }
      : undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    sport: "Football",
    url: `${baseUrl}/las-fijas/${slug}`,
    organizer: { "@type": "Organization", name: "Habla!", url: baseUrl },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
