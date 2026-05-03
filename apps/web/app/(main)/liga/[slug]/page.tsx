// /liga/[slug] — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-liga-detail (líneas 3522-3760).
//
// Estructura del mockup:
//   container
//     ← La Liga (back link)
//     .partido-hero (PartidoHero — vista LIVE con marcadores)
//     .mi-combinada-card (MiCombinadaCard via LigaDetalleClient)
//     .section-bar + .partido-stats-card (datos del partido en vivo)
//     .section-bar + #ranking-live-container (RankingPaginado)
//     .liga-inline-banner (cross-link a Las Fijas)

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { resolverLigaPorSlug } from "@/lib/services/liga.service";
import { listarRanking } from "@/lib/services/ranking.service";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { PartidoHero } from "@/components/partido/PartidoHero";
import { LigaDetalleClient } from "@/components/liga/LigaDetalleClient";
import { PartidoStatsCard } from "@/components/liga/PartidoStatsCard";
import {
  RankingPaginado,
  type RankingFila,
} from "@/components/liga/RankingPaginado";

interface Props {
  params: { slug: string };
  searchParams?: { modal?: string };
}

export const dynamic = "force-dynamic";

export default async function LigaDetallePage({ params }: Props) {
  const session = await auth();
  const usuarioId = session?.user?.id ?? null;

  const r = await resolverLigaPorSlug(params.slug, usuarioId ?? undefined);
  if (r.estado !== "found" || !r.partido || !r.torneo) {
    notFound();
  }

  const partido = r.partido;
  const torneo = r.torneo;
  const miTicket = r.miTicket;
  const enVivo = partido.estado === "EN_VIVO";
  const finalizado = partido.estado === "FINALIZADO";
  const cancelado = partido.estado === "CANCELADO";
  const editable =
    !cancelado &&
    !finalizado &&
    !enVivo &&
    partido.fechaInicio.getTime() > Date.now();

  const rankingData = await listarRanking(torneo.id, {
    limit: 200,
    usuarioId: usuarioId ?? undefined,
  }).catch(() => null);

  const filas: RankingFila[] = rankingData
    ? rankingData.ranking.map((r) => ({
        rank: r.rank,
        ticketId: r.ticketId,
        usuarioId: r.usuarioId,
        username: r.username,
        nombre: r.nombre,
        puntosTotal: r.puntosTotal,
        aciertos: contarAciertos(r.puntosDetalle),
        totalMercados: 5,
      }))
    : [];

  const totalInscritos = rankingData?.totalInscritos ?? torneo.totalInscritos;
  const miPosicion = rankingData?.miPosicion?.posicion ?? null;

  if (cancelado) {
    return (
      <div className="mockup-container">
        <Link
          href="/liga"
          style={{
            fontSize: 12,
            color: "var(--blue-main)",
            fontWeight: 700,
            marginBottom: 14,
            display: "inline-block",
          }}
        >
          ← La Liga
        </Link>
        <PartidoCancelado />
      </div>
    );
  }

  return (
    <div className="mockup-container">
      <TrackOnMount
        event="liga_detalle_visto"
        props={{
          torneoId: torneo.id,
          partidoId: partido.id,
          slug: params.slug,
          partido: `${partido.equipoLocal} vs ${partido.equipoVisita}`,
          inscritos: totalInscritos,
        }}
      />

      <Link
        href="/liga"
        style={{
          fontSize: 12,
          color: "var(--blue-main)",
          fontWeight: 700,
          marginBottom: 14,
          display: "inline-block",
        }}
      >
        ← La Liga
      </Link>

      <PartidoHero
        liga={partido.liga}
        equipoLocal={partido.equipoLocal}
        equipoVisita={partido.equipoVisita}
        fechaInicio={partido.fechaInicio}
        estado={enVivo ? "en_vivo" : finalizado ? "finalizado" : "programado"}
        marcadorLocal={partido.golesLocal}
        marcadorVisita={partido.golesVisita}
        minuto={partido.liveElapsed ?? null}
      />

      <LigaDetalleClient
        torneoId={torneo.id}
        ticketId={miTicket?.id ?? null}
        predIniciales={
          miTicket && !miTicket.esPlaceholder
            ? {
                predResultado: miTicket.predResultado,
                predBtts: miTicket.predBtts,
                predMas25: miTicket.predMas25,
                predTarjetaRoja: miTicket.predTarjetaRoja,
                predMarcadorLocal: miTicket.predMarcadorLocal,
                predMarcadorVisita: miTicket.predMarcadorVisita,
              }
            : null
        }
        partidoNombre={`${partido.equipoLocal} vs ${partido.equipoVisita}`}
        equipoLocal={partido.equipoLocal}
        equipoVisita={partido.equipoVisita}
        cierreAt={torneo.cierreAt.toISOString()}
        combinada={
          miTicket
            ? {
                predResultado: miTicket.predResultado,
                predBtts: miTicket.predBtts,
                predMas25: miTicket.predMas25,
                predTarjetaRoja: miTicket.predTarjetaRoja,
                predMarcadorLocal: miTicket.predMarcadorLocal,
                predMarcadorVisita: miTicket.predMarcadorVisita,
                puntosTotal: miTicket.puntosTotal,
                puntosResultado: miTicket.puntosResultado,
                puntosBtts: miTicket.puntosBtts,
                puntosMas25: miTicket.puntosMas25,
                puntosTarjeta: miTicket.puntosTarjeta,
                puntosMarcador: miTicket.puntosMarcador,
                numEdiciones: miTicket.numEdiciones,
                esPlaceholder: miTicket.esPlaceholder,
              }
            : null
        }
        editable={editable}
        finalizado={finalizado}
        requiereLogin={!usuarioId}
      />

      {enVivo ? (
        <PartidoStatsCard
          local={{
            posesion: null,
            tiros: null,
            corners: null,
            tarjetasAmarillas: null,
          }}
          visita={{
            posesion: null,
            tiros: null,
            corners: null,
            tarjetasAmarillas: null,
          }}
        />
      ) : null}

      <RankingPaginado
        filas={filas}
        totalInscritos={totalInscritos}
        miUsuarioId={usuarioId}
        miPosicion={miPosicion}
        hasSession={!!usuarioId}
      />

      <div className="liga-inline-banner" style={{ marginTop: 24 }}>
        <div className="liga-inline-banner-icon">🎯</div>
        <div className="liga-inline-banner-text">
          <div className="liga-inline-banner-title">
            Mira el análisis y comparador
          </div>
          <div className="liga-inline-banner-desc">
            Ficha completa, cuotas comparadas y pronóstico Habla! del partido
          </div>
        </div>
        <Link href={`/las-fijas/${params.slug}`} className="btn btn-secondary">
          Ver fija →
        </Link>
      </div>

      <p
        style={{
          marginTop: 24,
          textAlign: "center",
          fontSize: 11,
          color: "var(--text-muted-d)",
          lineHeight: 1.6,
        }}
      >
        🎲 Apostar es entretenimiento, no una fuente de ingresos. Si sentís que
        perdiste el control, contactá la Línea Tugar al{" "}
        <a
          href="tel:0800-19009"
          style={{ color: "var(--blue-main)", textDecoration: "underline" }}
        >
          0800-19009
        </a>
        .
      </p>
    </div>
  );
}

function PartidoCancelado() {
  return (
    <div className="estado-vacio">
      <div className="estado-vacio-icono">⚠️</div>
      <h1 className="estado-vacio-titulo">Este partido fue cancelado</h1>
      <p className="estado-vacio-desc">
        Las predicciones quedaron sin efecto. No se descuentan ni suman puntos
        del ranking del mes.
      </p>
      <div className="estado-vacio-ctas">
        <Link href="/liga" className="btn btn-primary">
          Volver a la Liga
        </Link>
      </div>
    </div>
  );
}

function contarAciertos(detalle: {
  resultado: number;
  btts: number;
  mas25: number;
  tarjeta: number;
  marcador: number;
}): number {
  let n = 0;
  if (detalle.resultado > 0) n += 1;
  if (detalle.btts > 0) n += 1;
  if (detalle.mas25 > 0) n += 1;
  if (detalle.tarjeta > 0) n += 1;
  if (detalle.marcador > 0) n += 1;
  return n;
}
