// /comunidad/torneo/[slug] — Producto C v3.1 (Lote C, rewrite del legacy
// /torneo/[id]). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/comunidad-torneo-slug.spec.md.
//
// Vista crítica de la pista autenticada. El "torneo" en v3.1 es el evento
// de Liga Habla! sincronizado con un partido específico — la URL nueva usa
// el ID del partido como slug (no hay columna `slug` en la tabla `partidos`,
// decisión arquitectónica para evitar migración por una vista de SEO
// marginal). El redirect 301 desde /torneo/[id] vive en `middleware.ts`.
//
// Estructura mobile-first:
//   - <TorneoHero>         hero gradient navy → blue + cross-link a Producto B
//   - <PrediccionForm>     5 mercados + sticky CTA "Enviar mi predicción"
//   - <PremiumInline>      banner promo Premium (oculto si Premium)
//   - <AffiliateInline>    cuota mejor casa según predicción 1X2
//   - <LeaderboardTorneoPreview>  Top 5 + posición del viewer
//
// Servicios reutilizados:
//   - obtenerPorSlug (Lote C, wrapper sobre torneos.service)
//   - obtenerOddsCacheadas (Lote 9)
//   - obtenerLeaderboardMesActual (Lote 5)
//   - detectarEstadoUsuario (Lote B)
// Lote E reemplazará el `pickPremium = null` por la query real.

import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { obtenerPorSlug } from "@/lib/services/torneos.service";
import { obtenerLeaderboardMesActual } from "@/lib/services/leaderboard.service";
import { obtenerOddsCacheadas } from "@/lib/services/odds-cache.service";
import { detectarEstadoUsuario } from "@/lib/services/estado-usuario.service";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { TorneoHero } from "@/components/torneo/TorneoHero";
import { PrediccionForm } from "@/components/torneo/PrediccionForm";
import { PremiumInline } from "@/components/torneo/PremiumInline";
import { AffiliateInline } from "@/components/torneo/AffiliateInline";
import { LeaderboardTorneoPreview } from "@/components/torneo/LeaderboardTorneoPreview";

interface Props {
  params: { slug: string };
}

export const dynamic = "force-dynamic";

export default async function TorneoPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/comunidad/torneo/${params.slug}`);
  }

  const data = await obtenerPorSlug(params.slug, session.user.id);
  if (!data) notFound();

  const { torneo, miTicket } = data;
  const { partido } = torneo;

  // Cargas paralelas no críticas — si fallan, la vista renderiza sin esa
  // sección.
  const [cuotas, leaderboardMes, estadoUsuario] = await Promise.all([
    obtenerOddsCacheadas(partido.id).catch(() => null),
    obtenerLeaderboardMesActual({ usuarioIdActual: session.user.id }).catch(
      () => null,
    ),
    detectarEstadoUsuario(session.user.id),
  ]);

  const esPremium = estadoUsuario === "premium";
  const tienePred = miTicket !== null && !esPlaceholder(miTicket);
  const partidoEnVivo = partido.estado === "EN_VIVO";
  const partidoFinalizado = partido.estado === "FINALIZADO";
  const cierreYaPaso = torneo.cierreAt.getTime() <= Date.now();
  const formDisabled = cierreYaPaso || partidoEnVivo || partidoFinalizado;

  // Mejor cuota según predicción del usuario (sincroniza el affiliate inline).
  const mejorCuota = cuotas
    ? resolverMejorCuotaSegunPred(cuotas, miTicket?.predResultado ?? "LOCAL")
    : null;

  // Top 5 del leaderboard mensual + posición del viewer.
  const top5 = (leaderboardMes?.filas ?? []).slice(0, 5).map((f) => ({
    posicion: f.posicion,
    userId: f.userId,
    username: f.username,
    puntos: f.puntos,
    esPremium: false,
    premioSoles:
      f.posicion === 1
        ? 500
        : f.posicion <= 3
          ? 200
          : f.posicion <= 10
            ? 50
            : undefined,
  }));
  const miFila = leaderboardMes?.miFila
    ? {
        posicion: leaderboardMes.miFila.posicion,
        userId: leaderboardMes.miFila.userId,
        username: leaderboardMes.miFila.username,
        puntos: leaderboardMes.miFila.puntos,
        esViewer: true,
      }
    : null;

  return (
    <div data-testid="comunidad-torneo-slug" className="pb-24">
      <TrackOnMount
        event="torneo_visto"
        props={{
          torneoId: torneo.id,
          partidoId: partido.id,
          slug: params.slug,
          partido: `${partido.equipoLocal} vs ${partido.equipoVisita}`,
          inscritos: torneo.totalInscritos,
        }}
      />

      <TorneoHero
        partidoSlug={params.slug}
        equipoLocal={partido.equipoLocal}
        equipoVisita={partido.equipoVisita}
        totalInscritos={torneo.totalInscritos}
        cierreAt={torneo.cierreAt}
        estado={
          partidoEnVivo
            ? "EN_VIVO"
            : partidoFinalizado
              ? "FINALIZADO"
              : (torneo.estado as
                  | "ABIERTO"
                  | "EN_JUEGO"
                  | "CERRADO"
                  | "FINALIZADO"
                  | "CANCELADO")
        }
        marcadorLocal={partido.golesLocal}
        marcadorVisita={partido.golesVisita}
      />

      <section className="bg-card px-4 py-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-display-sm font-bold uppercase tracking-[0.04em] text-dark">
          <span aria-hidden>🎯</span>
          Tu predicción
        </h2>
        <PrediccionForm
          torneoId={torneo.id}
          partidoSlug={params.slug}
          equipoLocal={partido.equipoLocal}
          equipoVisita={partido.equipoVisita}
          prediccionInicial={
            miTicket
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
          disabled={formDisabled}
          yaEnviada={tienePred}
        />
      </section>

      {!esPremium ? (
        <div className="py-2">
          <PremiumInline />
        </div>
      ) : null}

      {mejorCuota ? (
        <div className="py-3">
          <AffiliateInline
            casaSlug={mejorCuota.casa}
            casaNombre={mejorCuota.casaNombre}
            cuotaValor={mejorCuota.odd}
            outcomeLabel={mejorCuota.label}
            partidoId={partido.id}
            outcome={mejorCuota.outcomeKey}
          />
        </div>
      ) : null}

      <section className="bg-card px-4 py-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-display-sm font-bold uppercase tracking-[0.04em] text-dark">
          <span aria-hidden>🏅</span>
          Leaderboard del mes
        </h2>
        <LeaderboardTorneoPreview
          filas={top5}
          miFila={miFila}
          showPremioLineAfter={3}
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers locales
// ---------------------------------------------------------------------------

function esPlaceholder(t: {
  predResultado: string;
  predBtts: boolean;
  predMas25: boolean;
  predTarjetaRoja: boolean;
  predMarcadorLocal: number;
  predMarcadorVisita: number;
}): boolean {
  return (
    t.predResultado === "LOCAL" &&
    t.predBtts === false &&
    t.predMas25 === false &&
    t.predTarjetaRoja === false &&
    t.predMarcadorLocal === 0 &&
    t.predMarcadorVisita === 0
  );
}

interface MejorCuotaResolved {
  casa: string;
  casaNombre: string;
  odd: number;
  label: string;
  outcomeKey: "1" | "X" | "2";
}

function resolverMejorCuotaSegunPred(
  cuotas: Awaited<ReturnType<typeof obtenerOddsCacheadas>>,
  pred: "LOCAL" | "EMPATE" | "VISITA",
): MejorCuotaResolved | null {
  if (!cuotas) return null;
  const m = cuotas.mercados["1X2"];
  if (pred === "LOCAL" && m.local) {
    return {
      casa: m.local.casa,
      casaNombre: m.local.casaNombre,
      odd: m.local.odd,
      label: "Local gana",
      outcomeKey: "1",
    };
  }
  if (pred === "EMPATE" && m.empate) {
    return {
      casa: m.empate.casa,
      casaNombre: m.empate.casaNombre,
      odd: m.empate.odd,
      label: "Empate",
      outcomeKey: "X",
    };
  }
  if (pred === "VISITA" && m.visita) {
    return {
      casa: m.visita.casa,
      casaNombre: m.visita.casaNombre,
      odd: m.visita.odd,
      label: "Visita gana",
      outcomeKey: "2",
    };
  }
  return null;
}
