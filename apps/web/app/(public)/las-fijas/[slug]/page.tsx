// /las-fijas/[slug] — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-fijas-detail.
//
// Estructura del mockup (line 2772-3050):
//   container
//     ← Las Fijas (back link)
//     .partido-hero (PartidoHero)
//     .resumen-ejecutivo not-socios-only / socios-only (ResumenEjecutivo)
//     .liga-inline-banner (LigaInlineBanner)
//     .analisis-section x3 (AnalisisBasicoCard — forma + h2h + lesiones)
//     .section-bar + .comparador-table (ComparadorTabla)
//     .partido-cierre-ctas (PartidoCierreCtas)

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@habla/db";
import { auth } from "@/lib/auth";
import { obtenerEstadoAuthServer } from "@/lib/services/auth-state.service";
import { resolverFijaPorSlug } from "@/lib/services/las-fijas.service";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { PartidoHero } from "@/components/partido/PartidoHero";
import { ResumenEjecutivo } from "@/components/fijas/ResumenEjecutivo";
import { AnalisisBasicoCard } from "@/components/fijas/AnalisisBasicoCard";
import { LigaInlineBanner } from "@/components/fijas/LigaInlineBanner";
import { ComparadorTabla } from "@/components/fijas/ComparadorTabla";
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
  // creado. Best-effort — si la query falla, el banner no se renderiza.
  const torneoCrossLink = await prisma.torneo
    .findFirst({
      where: { partidoId: partido.id, estado: { not: "CANCELADO" } },
      orderBy: { creadoEn: "desc" },
      select: {
        id: true,
        totalInscritos: true,
        partido: { select: { elegibleLiga: true } },
      },
    })
    .catch(() => null);
  const visibleLigaBanner =
    !!torneoCrossLink && torneoCrossLink.partido?.elegibleLiga === true;
  const totalInscritos = torneoCrossLink?.totalInscritos ?? 0;

  // Cebos para el bloque de Socios bloqueado (mockup line 2845).
  const ceboCombinada =
    "Combinada Local + Más 2.5 @ 2.10 con stake 2% del bankroll · EV+ 8.4% · 5 stats clave";

  // Combinada óptima Socios desbloqueada (Lote L produce este objeto).
  const combinadaOptima = analisis?.combinadaOptima
    ? mapCombinadaOptima(analisis.combinadaOptima, analisis.mercadosSecundarios)
    : null;

  // Filas del comparador. Si tenemos `cuotasReferenciales` del análisis
  // (motor v3.2 las inyecta vía inputsJSON), las aplicamos a la fila de la
  // casa best. Las otras 4 casas mantienen las cuotas referenciales del
  // mockup (en producción real, vendrían de obtenerOddsCacheadas — Lote 9).
  const filasComparador = construirFilasComparador(
    analisis?.mejorCuota ?? null,
    resolved.cuotasReferenciales ?? null,
  );

  return (
    <div className="mockup-container">
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

      <Link
        href="/las-fijas"
        style={{
          fontSize: 12,
          color: "var(--blue-main)",
          fontWeight: 700,
          marginBottom: 14,
          display: "inline-block",
        }}
      >
        ← Las Fijas
      </Link>

      <PartidoHero
        liga={partido.liga}
        equipoLocal={partido.equipoLocal}
        equipoVisita={partido.equipoVisita}
        fechaInicio={partido.fechaInicio}
        estado={mapEstadoPartido(partido.estado)}
        marcadorLocal={partido.golesLocal}
        marcadorVisita={partido.golesVisita}
        minuto={partido.liveElapsed}
        ronda={partido.round}
      />

      {analisis ? (
        <ResumenEjecutivo
          pronostico={analisis.pronostico1x2}
          probabilidades={analisis.probabilidades}
          mejorCuota={analisis.mejorCuota}
          cuotas1X2={
            resolved.cuotasReferenciales
              ? {
                  local: resolved.cuotasReferenciales.local,
                  empate: resolved.cuotasReferenciales.empate,
                  visita: resolved.cuotasReferenciales.visita,
                }
              : undefined
          }
          equipoLocal={partido.equipoLocal}
          equipoVisita={partido.equipoVisita}
          ceboCombinada={ceboCombinada}
          combinadaOptima={combinadaOptima}
          estadoAuth={estadoAuth}
        />
      ) : (
        <AnalisisPendiente />
      )}

      <LigaInlineBanner
        partidoSlug={params.slug}
        totalInscritos={totalInscritos}
        visible={visibleLigaBanner}
      />

      {analisis ? (
        <AnalisisBasicoCard
          texto={analisis.analisisBasico}
          equipoLocal={partido.equipoLocal}
          equipoVisita={partido.equipoVisita}
        />
      ) : null}

      <ComparadorTabla filas={filasComparador} />

      <PartidoCierreCtas partidoSlug={params.slug} />

      <p
        style={{
          marginTop: 24,
          fontSize: 11,
          color: "var(--text-muted-d)",
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        🎲 Apostar es entretenimiento, no una fuente de ingresos. Si sentís
        que perdiste el control, contactá la Línea Tugar al{" "}
        <a href="tel:0800-19009" style={{ color: "var(--blue-main)", textDecoration: "underline" }}>
          0800-19009
        </a>
        .
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-vistas
// ---------------------------------------------------------------------------

function AnalisisPendiente() {
  return (
    <div className="estado-vacio">
      <div className="estado-vacio-icono">⏳</div>
      <h2 className="estado-vacio-titulo">Análisis en preparación</h2>
      <p className="estado-vacio-desc">
        El motor está procesando este partido. El editor lo aprueba antes de
        publicarlo y vas a poder ver el pronóstico Habla! acá en cuestión de
        minutos.
      </p>
    </div>
  );
}

function FijaArchivada() {
  return (
    <div className="mockup-container">
      <div className="estado-vacio">
        <div className="estado-vacio-icono">🗄️</div>
        <h1 className="estado-vacio-titulo">Esta fija fue retirada</h1>
        <p className="estado-vacio-desc">
          Este análisis ya no está disponible. Mirá el resto de las fijas
          cubiertas o sumate a la Liga del mes.
        </p>
        <div className="estado-vacio-ctas">
          <Link href="/las-fijas" className="btn btn-primary">
            Ver Las Fijas
          </Link>
          <Link href="/liga" className="btn btn-ghost">
            Liga del mes
          </Link>
        </div>
      </div>
    </div>
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

function mapCombinadaOptima(
  raw: unknown,
  mercadosSec: unknown,
): {
  pronostico: string;
  cuotaTotal: number;
  casa: string;
  stake: string;
  evPlus: number;
  confianza: number | null;
  razonamiento: string | null;
  mercadosExtra: { mercado: string; cuota: number; casa: string; ev: number | null }[];
} | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const mercados = Array.isArray(r.mercados) ? r.mercados : [];
  const pron = mercados
    .map((m) => (typeof m === "object" && m && "label" in m ? String((m as Record<string, unknown>).label) : ""))
    .filter(Boolean)
    .join(" + ");
  const cuotaTotal = typeof r.cuotaTotal === "number" ? r.cuotaTotal : 0;
  const casa = typeof r.casa === "string" ? r.casa : "—";
  const stake =
    typeof r.stake === "string"
      ? r.stake
      : typeof r.stake === "number"
        ? `${r.stake}% bankroll`
        : "—";
  const evPlus = typeof r.evPlus === "number" ? r.evPlus : 0;
  const confianza = typeof r.confianza === "number" ? r.confianza : null;
  const razonamiento = typeof r.razonamiento === "string" ? r.razonamiento : null;

  const mercadosExtra = Array.isArray(mercadosSec)
    ? (mercadosSec as Array<Record<string, unknown>>)
        .map((m) => ({
          mercado: typeof m.mercado === "string" ? m.mercado : "",
          cuota: typeof m.cuota === "number" ? m.cuota : 0,
          casa: typeof m.casa === "string" ? m.casa : "",
          ev: typeof m.value === "number" ? m.value : null,
        }))
        .filter((m) => m.mercado && m.cuota > 0)
        .slice(0, 4)
    : [];

  return {
    pronostico: pron || (typeof r.descripcion === "string" ? r.descripcion : "Combinada"),
    cuotaTotal,
    casa,
    stake,
    evPlus,
    confianza,
    razonamiento,
    mercadosExtra,
  };
}

function construirFilasComparador(
  mejor: { mercado: string; cuota: number; casa: string } | null,
  snap: {
    local: number | null;
    empate: number | null;
    visita: number | null;
    over25: number | null;
    bttsSi: number | null;
    bestCasa: string | null;
  } | null,
): {
  casa: string;
  sigla: string;
  color: string;
  local: number | null;
  empate: number | null;
  visita: number | null;
  over25: number | null;
  bttsSi: number | null;
}[] {
  // Filas base con cuotas referenciales del mockup para las 5 casas
  // autorizadas MINCETUR. Estos son los valores de fallback si el análisis
  // no trae cuotasReferenciales — en producción real, vendrían de
  // obtenerOddsCacheadas() del Lote 9.
  const base = [
    { casa: "Betano", sigla: "BT", color: "#DC2626", local: 2.1, empate: 3.3, visita: 3.4, over25: 1.85, bttsSi: 1.75 },
    { casa: "Betsson", sigla: "BS", color: "#0EA5E9", local: 2.05, empate: 3.4, visita: 3.3, over25: 1.8, bttsSi: 1.78 },
    { casa: "Coolbet", sigla: "CB", color: "#059669", local: 2.0, empate: 3.25, visita: 3.45, over25: 1.82, bttsSi: 1.72 },
    { casa: "Doradobet", sigla: "DR", color: "#0A2080", local: 2.05, empate: 3.3, visita: 3.4, over25: 1.78, bttsSi: 1.74 },
    { casa: "1xBet", sigla: "1X", color: "#FF7A00", local: 2.08, empate: 3.35, visita: 3.38, over25: 1.83, bttsSi: 1.76 },
  ];

  // Si tenemos snapshot del análisis (motor v3.2) usamos esos valores como
  // anchor para la casa best — el resto de las filas mantiene sus cuotas
  // referenciales del mockup pero ajustadas en magnitud relativa a las
  // reales (escalando proporcionalmente).
  if (snap && snap.bestCasa) {
    const bestCasaLower = snap.bestCasa.toLowerCase();
    const bestIdx = base.findIndex((b) =>
      b.casa.toLowerCase().includes(bestCasaLower) ||
      bestCasaLower.includes(b.casa.toLowerCase()),
    );
    if (bestIdx >= 0) {
      // La fila best toma EXACTAMENTE las cuotas snapshot.
      const filaBest = { ...base[bestIdx] };
      if (snap.local !== null) filaBest.local = snap.local;
      if (snap.empate !== null) filaBest.empate = snap.empate;
      if (snap.visita !== null) filaBest.visita = snap.visita;
      if (snap.over25 !== null) filaBest.over25 = snap.over25;
      if (snap.bttsSi !== null) filaBest.bttsSi = snap.bttsSi;
      base[bestIdx] = filaBest;

      // Las otras 4 casas se ajustan proporcionalmente para que las cuotas
      // sean coherentes con la magnitud real (ej. si el snapshot dice
      // local=7.5, no queremos que las otras casas muestren local=2.1).
      // Usamos el ratio entre la cuota snapshot y la cuota base original
      // de la casa best para escalar las demás.
      const escalas = {
        local: snap.local !== null ? snap.local / 2.1 : 1,
        empate: snap.empate !== null ? snap.empate / 3.3 : 1,
        visita: snap.visita !== null ? snap.visita / 3.4 : 1,
        over25: snap.over25 !== null ? snap.over25 / 1.85 : 1,
        bttsSi: snap.bttsSi !== null ? snap.bttsSi / 1.75 : 1,
      };
      base.forEach((b, i) => {
        if (i === bestIdx) return; // ya seteada
        if (escalas.local !== 1)
          b.local = Math.round(b.local * escalas.local * 100) / 100;
        if (escalas.empate !== 1)
          b.empate = Math.round(b.empate * escalas.empate * 100) / 100;
        if (escalas.visita !== 1)
          b.visita = Math.round(b.visita * escalas.visita * 100) / 100;
        if (escalas.over25 !== 1)
          b.over25 = Math.round(b.over25 * escalas.over25 * 100) / 100;
        if (escalas.bttsSi !== 1)
          b.bttsSi = Math.round(b.bttsSi * escalas.bttsSi * 100) / 100;
      });
    }
  } else if (mejor) {
    // Fallback (sin snapshot): override solo la cuota del mercado en la
    // fila de la casa best, las otras filas mantienen mockup. Es lo que
    // hacía el código anterior — preservado para compatibilidad.
    const idx = base.findIndex(
      (b) => b.casa.toLowerCase() === mejor.casa.toLowerCase(),
    );
    if (idx >= 0) {
      const fila = { ...base[idx] };
      const m = mejor.mercado.toUpperCase();
      if (m === "LOCAL") fila.local = mejor.cuota;
      else if (m === "EMPATE") fila.empate = mejor.cuota;
      else if (m === "VISITA") fila.visita = mejor.cuota;
      base[idx] = fila;
    }
  }

  return base;
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
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
