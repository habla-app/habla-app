// /live-match — Sub-Sprint 5.
//
// Server Component delgado: resuelve qué partido mostrar y pasa los IDs
// al Client Component `LiveMatchView` que maneja la conexión WS, tabs,
// y refetch.
//
// Params:
//   - ?torneoId=<id>  → pantalla específica
//   - sin param       → primer partido EN_VIVO (prioriza por estado del
//                       torneo principal y pozoBruto del mismo)
//
// Bug #8 post-Hotfix #3: a diferencia de versiones previas, la página
// ya no tolera partidos sin torneo activo. `obtenerLiveMatches` exige
// que cada partido tenga al menos un torneo no-cancelado — el cartel
// "sin torneo activo" del Hotfix #3 fue removido tras revisión del PO.

import { auth } from "@/lib/auth";
import { listarRanking } from "@/lib/services/ranking.service";
import {
  elegirTorneoPrincipal,
  obtenerLiveMatches,
} from "@/lib/services/live-matches.service";
import { getLiveStatus } from "@/lib/services/live-partido-status.cache";
import {
  LiveMatchView,
  type LiveMatchTab,
} from "@/components/live/LiveMatchView";

interface Props {
  /** `partidoId` se redirige a `torneoId` del principal (compat Hotfix #3). */
  searchParams?: { torneoId?: string; partidoId?: string };
}

export const dynamic = "force-dynamic";

export default async function LiveMatchPage({ searchParams }: Props) {
  const session = await auth();

  // Bug #8: `obtenerLiveMatches` filtra out partidos cuyos torneos estén
  // todos CANCELADO. Cada partido que llegue acá tiene al menos un
  // torneo navegable, así que `elegirTorneoPrincipal` nunca devuelve null.
  const liveMatchesRaw = await obtenerLiveMatches({ limit: 6 });

  if (liveMatchesRaw.length === 0) {
    return <EmptyLive />;
  }

  const tabs: LiveMatchTab[] = [];
  for (const p of liveMatchesRaw) {
    const main = elegirTorneoPrincipal(p.torneos);
    if (!main) continue; // defensive: no debería pasar post-Bug #8
    // Bug #9: leer label del cache del poller para mostrar el minuto
    // en el primer render (antes de que llegue el primer WS).
    const snap = getLiveStatus(p.id);
    tabs.push({
      torneoId: main.id,
      partidoId: p.id,
      liga: p.liga,
      equipoLocal: p.equipoLocal,
      equipoVisita: p.equipoVisita,
      golesLocal: p.golesLocal ?? 0,
      golesVisita: p.golesVisita ?? 0,
      round: p.round,
      venue: p.venue,
      estado: p.estado as "EN_VIVO" | "FINALIZADO",
      torneoEstado: main.estado as
        | "ABIERTO"
        | "EN_JUEGO"
        | "FINALIZADO"
        | "CERRADO",
      pozoBruto: main.pozoBruto,
      pozoNeto: main.pozoNeto,
      totalInscritos: main.totalInscritos,
      minutoLabel: snap?.label ?? null,
    });
  }

  if (tabs.length === 0) {
    return <EmptyLive />;
  }

  // Resolver el tab activo. Prioridad:
  //   1. ?torneoId=<id> coincide con un tab
  //   2. ?partidoId=<id> coincide con un tab (backward compat Hotfix #3)
  //   3. primer tab de la lista
  const torneoIdQuery = searchParams?.torneoId;
  const partidoIdQuery = searchParams?.partidoId;
  let activeIdx = -1;
  if (torneoIdQuery) {
    activeIdx = tabs.findIndex((t) => t.torneoId === torneoIdQuery);
  }
  if (activeIdx === -1 && partidoIdQuery) {
    activeIdx = tabs.findIndex((t) => t.partidoId === partidoIdQuery);
  }
  if (activeIdx === -1) {
    activeIdx = 0;
  }
  const activeTab = tabs[activeIdx]!;
  const torneoIdActivo = activeTab.torneoId;

  // Snapshot inicial del ranking del torneo activo. `listarRanking`
  // funciona aún con torneos ABIERTOS (devuelve tickets con puntos=0).
  const rankingInicial = await listarRanking(torneoIdActivo, {
    limit: 100,
    usuarioId: session?.user?.id,
  });

  const initialSnapshot = {
    totalInscritos: rankingInicial.totalInscritos,
    pozoNeto: rankingInicial.pozoNeto,
    ranking: rankingInicial.ranking.map((r) => ({
      rank: r.rank,
      ticketId: r.ticketId,
      usuarioId: r.usuarioId,
      nombre: r.nombre,
      puntosTotal: r.puntosTotal,
      puntosDetalle: r.puntosDetalle,
      predicciones: r.predicciones,
      premioEstimado: r.premioEstimado,
    })),
    miPosicion: rankingInicial.miPosicion
      ? {
          posicion: rankingInicial.miPosicion.posicion,
          ticketId: rankingInicial.miPosicion.ticketId,
          puntosTotal: rankingInicial.miPosicion.puntosTotal,
          premioEstimado: rankingInicial.miPosicion.premioEstimado,
        }
      : null,
  };

  return (
    <LiveMatchView
      tabs={tabs}
      torneoIdActivo={torneoIdActivo}
      rankingInicial={initialSnapshot}
      hasSession={!!session?.user?.id}
      miUsuarioId={session?.user?.id ?? null}
    />
  );
}

function EmptyLive() {
  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pt-10 md:px-6 md:pt-16">
      <div className="rounded-lg border border-light bg-card px-6 py-16 text-center shadow-sm">
        <div aria-hidden className="mb-3 text-5xl">
          🌙
        </div>
        <h1 className="font-display text-[26px] font-black uppercase text-dark">
          No hay partidos en vivo
        </h1>
        <p className="mt-2 text-[14px] text-muted-d">
          Cuando arranque algún torneo, el ranking en tiempo real aparece acá.
        </p>
        <a
          href="/matches"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-3 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-colors hover:bg-brand-gold-light"
        >
          Ver partidos próximos
        </a>
      </div>
    </div>
  );
}
