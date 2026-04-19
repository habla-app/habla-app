// /live-match — Sub-Sprint 5.
//
// Server Component delgado: resuelve qué partido mostrar y pasa los IDs
// al Client Component `LiveMatchView` que maneja la conexión WS, tabs,
// y refetch.
//
// Params:
//   - ?torneoId=<id>  → pantalla específica
//   - sin param       → primer partido EN_VIVO (prioriza por estado del
//                       torneo principal; partidos sin torneo activo van
//                       último pero igual aparecen)
//
// Hotfix post-Sub-Sprint 5 (Bug #2): la query original tenía un filtro
// existencial `where: { torneos: { some: { estado: { in: [...] } } } }`
// que descartaba partidos cuyos torneos no habían transicionado.
//
// Hotfix #3 post-Sub-Sprint 5 (re-fix Bug #2): el filtro se quitó pero
// la página seguía descartando partidos cuyo `elegirTorneoPrincipal`
// retornaba null (todos los torneos en CANCELADO por <2 inscritos), que
// es exactamente el caso de Manchester City vs Arsenal en producción
// (`/api/v1/live/matches` devolvía `torneos: []`). Ahora la página
// muestra esos partidos también, con un cartel "Este partido no tiene
// torneo activo" en lugar del ranking. El usuario sigue viendo el
// score + eventos del partido aunque no haya un torneo donde competir.

import { auth } from "@/lib/auth";
import { listarRanking } from "@/lib/services/ranking.service";
import {
  elegirTorneoPrincipal,
  obtenerLiveMatches,
} from "@/lib/services/live-matches.service";
import {
  LiveMatchView,
  type LiveMatchTab,
} from "@/components/live/LiveMatchView";

interface Props {
  searchParams?: { torneoId?: string; partidoId?: string };
}

export const dynamic = "force-dynamic";

export default async function LiveMatchPage({ searchParams }: Props) {
  const session = await auth();

  const liveMatchesRaw = await obtenerLiveMatches({ limit: 6 });

  if (liveMatchesRaw.length === 0) {
    return <EmptyLive />;
  }

  // Construimos los tabs primero, sin filtrar partidos sin torneo activo:
  // si Manchester vs Arsenal está EN_VIVO con todos sus torneos en
  // CANCELADO (caso real reportado en prod), igual debe aparecer.
  const tabs: LiveMatchTab[] = liveMatchesRaw.map((p) => {
    const main = elegirTorneoPrincipal(p.torneos);
    return {
      torneoId: main?.id ?? null,
      partidoId: p.id,
      liga: p.liga,
      equipoLocal: p.equipoLocal,
      equipoVisita: p.equipoVisita,
      golesLocal: p.golesLocal ?? 0,
      golesVisita: p.golesVisita ?? 0,
      round: p.round,
      venue: p.venue,
      estado: p.estado as "EN_VIVO" | "FINALIZADO",
      // `elegirTorneoPrincipal` ya excluye CANCELADO — el cast es seguro.
      torneoEstado:
        (main?.estado as "ABIERTO" | "EN_JUEGO" | "FINALIZADO" | "CERRADO") ??
        null,
      pozoBruto: main?.pozoBruto ?? 0,
      pozoNeto: main?.pozoNeto ?? 0,
      totalInscritos: main?.totalInscritos ?? 0,
    };
  });

  // Tab activo: del query (?torneoId o ?partidoId), o el primero con
  // torneo activo, o si no hay ninguno con torneo activo, el primero.
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
    activeIdx = tabs.findIndex((t) => t.torneoId !== null);
  }
  if (activeIdx === -1) {
    activeIdx = 0;
  }
  const activeTab = tabs[activeIdx]!;
  const torneoIdActivo = activeTab.torneoId;

  // Snapshot inicial del ranking solo si hay torneo activo. `listarRanking`
  // funciona aún con torneos ABIERTOS (devuelve tickets con puntos=0); si
  // no hay torneo, el frontend muestra "sin torneo activo" en lugar.
  const rankingInicial = torneoIdActivo
    ? await listarRanking(torneoIdActivo, {
        limit: 100,
        usuarioId: session?.user?.id,
      })
    : null;

  // Payload inicial: si hay torneo activo + ranking lo armamos; si no,
  // pasamos un snapshot vacío. El componente muestra "sin torneo activo"
  // cuando el tab activo tiene torneoId=null.
  const initialSnapshot = rankingInicial
    ? {
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
      }
    : { totalInscritos: 0, pozoNeto: 0, ranking: [], miPosicion: null };

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
