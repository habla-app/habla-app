// /liga/[slug] — Lote M v3.2 (May 2026).
// Spec: docs/habla-mockup-v3.2.html § page-liga-detail.
//
// Vista crítica del Producto C (La Liga Habla!) — detalle del partido con
// ranking en vivo, mi combinada (CTA hacer/editar), cross-link a Las Fijas.
//
// Consolidación: reemplaza la coexistencia previa de /comunidad/torneo/[slug]
// (estática) + /live-match (en vivo). En v3.2 una sola URL maneja PROGRAMADO,
// EN_VIVO y FINALIZADO. El ranking se renderiza paginado con sticky-bottom
// (decisiones §4.10 + §4.11). El modal de combinada respeta las 9 reglas
// integrales §4.9.

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { resolverLigaPorSlug } from "@/lib/services/liga.service";
import { listarRanking } from "@/lib/services/ranking.service";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { TorneoHero } from "@/components/torneo/TorneoHero";
import { LigaDetalleClient } from "@/components/liga/LigaDetalleClient";
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
    !cancelado && !finalizado && !enVivo && partido.fechaInicio.getTime() > Date.now();

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

  return (
    <div className="space-y-3 pb-24">
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

      <TorneoHero
        partidoSlug={params.slug}
        equipoLocal={partido.equipoLocal}
        equipoVisita={partido.equipoVisita}
        totalInscritos={totalInscritos}
        cierreAt={torneo.cierreAt}
        estado={
          cancelado
            ? "CANCELADO"
            : finalizado
              ? "FINALIZADO"
              : enVivo
                ? "EN_VIVO"
                : (torneo.estado as "ABIERTO" | "EN_JUEGO" | "CERRADO")
        }
        marcadorLocal={partido.golesLocal}
        marcadorVisita={partido.golesVisita}
      />

      {cancelado ? (
        <PartidoCancelado />
      ) : (
        <div className="mx-auto w-full max-w-[1100px] space-y-3 md:px-6">
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

          <RankingPaginado
            filas={filas}
            totalInscritos={totalInscritos}
            miUsuarioId={usuarioId}
            miPosicion={miPosicion}
            hasSession={!!usuarioId}
          />

          <CrossLinkAFijas slug={params.slug} />
        </div>
      )}

      <p className="mx-auto max-w-[1100px] px-4 pt-4 text-center text-body-xs text-muted-d md:px-6">
        🎲 Apostar es entretenimiento, no una fuente de ingresos. Si sentís
        que perdiste el control, contactá la Línea Tugar al{" "}
        <a href="tel:0800-19009" className="underline hover:text-brand-blue-main">
          0800-19009
        </a>
        .
      </p>
    </div>
  );
}

function CrossLinkAFijas({ slug }: { slug: string }) {
  return (
    <Link
      href={`/las-fijas/${slug}`}
      className="my-3 mx-4 flex items-center justify-between gap-3 rounded-md border-2 border-brand-blue-main/20 bg-brand-blue-main/[0.04] p-4 transition-colors hover:border-brand-blue-main/40 hover:bg-brand-blue-main/[0.08] md:mx-0"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-2xl">
          🎯
        </span>
        <div>
          <p className="font-display text-display-xs font-bold text-dark">
            Mirá el análisis y el comparador
          </p>
          <p className="text-body-xs text-muted-d">
            Pronóstico Habla!, mejores cuotas y análisis del partido
          </p>
        </div>
      </div>
      <span aria-hidden className="text-brand-blue-main">
        →
      </span>
    </Link>
  );
}

function PartidoCancelado() {
  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-12 text-center md:py-16">
      <div aria-hidden className="mb-4 text-5xl">
        ⚠️
      </div>
      <h1 className="font-display text-display-md font-black text-dark">
        Este partido fue cancelado
      </h1>
      <p className="mt-3 text-body-md text-body">
        Las predicciones quedaron sin efecto. No se descuentan ni suman puntos
        del ranking del mes.
      </p>
      <Link
        href="/liga"
        className="mt-5 inline-flex items-center justify-center rounded-md bg-brand-gold px-5 py-3 font-display text-label-md font-extrabold uppercase text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light"
      >
        Volver a la Liga
      </Link>
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
