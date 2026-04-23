// /live-match — Sub-Sprint 5 + hotfixes #1/#2/#3/#4/#5.
//
// Server Component delgado. Resuelve:
//   1. Partidos EN_VIVO con al menos un torneo no cancelado (Bug #8).
//   2. Partidos FINALIZADOS de las últimas 24h (Bug #10) — ahora con
//      datos enriquecidos del ganador (5 chips + premio) para las
//      cards de `<LiveFinalizedSection>` (Bug #16).
//   3. Filtro por liga (`?liga=<slug>`) aplicado solo al switcher en
//      vivo (Bug #11). La sección "Partidos finalizados" NO filtra.
//   4. "Próximo torneo" (el ABIERTO cuyo cierre es el siguiente) para
//      alimentar la banda motivacional `<LiveFinalizedBanner>` que
//      aparece al final del detalle post-partido (Bug #16).
//
// El switcher superior (LiveSwitcher) muestra SOLO partidos EN_VIVO
// que coincidan con el filtro de liga. Los finalizados van en una
// sección debajo con cards de resumen (LiveFinalizedSection).

import { auth } from "@/lib/auth";
import { listarRanking } from "@/lib/services/ranking.service";
import { listar as listarTorneos } from "@/lib/services/torneos.service";
import {
  elegirTorneoPrincipal,
  obtenerFinalizedMatches,
  obtenerLiveMatches,
  type PartidoLive,
} from "@/lib/services/live-matches.service";
import { getLiveStatus } from "@/lib/services/live-partido-status.cache";
import {
  LIGA_CHIP_LABELS,
  LIGA_SLUGS_ORDER,
  ligaToSlug,
  slugToLiga,
} from "@/lib/config/liga-slugs";
import {
  LiveMatchView,
  type LiveMatchTab,
} from "@/components/live/LiveMatchView";
import type { FinalizedMatchCard } from "@/components/live/LiveFinalizedSection";
import type { LigaChipInfo } from "@/components/live/LiveLeagueFilter";
import { buildFinalizedWinnerChips } from "@/components/live/finalized-winner-chips";

interface Props {
  searchParams?: { torneoId?: string; partidoId?: string; liga?: string };
}

export const dynamic = "force-dynamic";

async function buscarProximoTorneoId(): Promise<string | null> {
  try {
    const { torneos } = await listarTorneos({ estado: "ABIERTO", limit: 1 });
    return torneos[0]?.id ?? null;
  } catch {
    return null;
  }
}

export default async function LiveMatchPage({ searchParams }: Props) {
  const session = await auth();

  const [liveRaw, finalizadosRaw, proximoTorneoId] = await Promise.all([
    // Live-only: el switcher solo muestra EN_VIVO (Bug #10).
    obtenerLiveMatches({ limit: 20, incluirFinalizados: false }),
    obtenerFinalizedMatches({ sinceHours: 24, limit: 10 }),
    // Próximo torneo abierto más cercano a cerrar — alimenta la banda
    // motivacional del detalle post-partido (Bug #16).
    buscarProximoTorneoId(),
  ]);

  // Derivamos la lista de ligas presentes EN_VIVO ahora — las chips
  // son dinámicas (Bug #11). Solo ligas con ≥1 partido.
  const ligasChips = derivarLigasPresentes(liveRaw);

  // Filtrar liveRaw por ?liga= si aplica (Bug #11).
  const ligaSlug = searchParams?.liga ?? null;
  const ligaName = ligaSlug ? slugToLiga(ligaSlug) : null;
  const liveFiltered = ligaName
    ? liveRaw.filter((p) => p.liga === ligaName)
    : liveRaw;

  // Tabs del switcher — solo los live-filtered. Cuando el filtro
  // deja la lista vacía pero había live-raw, LiveMatchView muestra
  // un empty state dentro del switcher.
  const liveTabs = buildLiveTabs(liveFiltered);

  // Cards finalizadas (sin filtrar por liga por decisión del PO).
  // Bug #16: enriquecidas con las 5 chips del ganador + premio real.
  const finalizedCards: FinalizedMatchCard[] = await Promise.all(
    finalizadosRaw.map(async (p) => {
      const main = elegirTorneoPrincipal(p.torneos);
      let ganador: FinalizedMatchCard["ganador"] = null;
      if (main) {
        try {
          const r = await listarRanking(main.id, { limit: 1 });
          const top = r.ranking[0];
          if (top) {
            ganador = {
              nombre: top.nombre,
              puntos: top.puntosTotal,
              premioLukas: top.premioEstimado,
              chips: buildFinalizedWinnerChips(
                top,
                p.equipoLocal,
                p.equipoVisita,
              ),
            };
          }
        } catch {
          // Ignorar: card se renderiza sin ganador (ver fallback en
          // LiveFinalizedSection).
        }
      }
      return {
        partidoId: p.id,
        torneoId: main?.id ?? p.id,
        liga: p.liga,
        round: p.round,
        equipoLocal: p.equipoLocal,
        equipoVisita: p.equipoVisita,
        golesLocal: p.golesLocal ?? 0,
        golesVisita: p.golesVisita ?? 0,
        fechaInicio: p.fechaInicio,
        totalInscritos: main?.totalInscritos ?? 0,
        pozoBruto: main?.pozoBruto ?? 0,
        ganador,
      };
    }),
  );

  // Resolver el tab activo. Orden de prioridad:
  //   1. ?torneoId matches algún tab del switcher
  //   2. ?torneoId matches un partido finalizado (fuera del switcher)
  //      → lo incluimos como tab "virtual" al principio
  //   3. ?partidoId matches algún tab del switcher (backward compat)
  //   4. primer tab del switcher
  const torneoIdQuery = searchParams?.torneoId;
  const partidoIdQuery = searchParams?.partidoId;

  let activeTabs: LiveMatchTab[] = liveTabs;
  let activeIdx = -1;

  if (torneoIdQuery) {
    activeIdx = activeTabs.findIndex((t) => t.torneoId === torneoIdQuery);
    if (activeIdx === -1) {
      // Buscar en finalizados: si el usuario viene de un email de
      // premios a un torneo FINALIZADO, lo mostramos con el hero post-
      // partido y sacamos el switcher.
      const finTab = await tryBuildFinalizedTab(torneoIdQuery, finalizadosRaw);
      if (finTab) {
        activeTabs = [finTab];
        activeIdx = 0;
      }
    }
  }
  if (activeIdx === -1 && partidoIdQuery) {
    activeIdx = activeTabs.findIndex((t) => t.partidoId === partidoIdQuery);
  }
  if (activeIdx === -1) activeIdx = 0;

  if (activeTabs.length === 0) {
    // No hay partidos en vivo (filtrados o no) ni finalizados:
    // empty state global. Finalizados igual se muestran debajo si
    // los hay — pero el switcher + hero están ocultos.
    if (finalizedCards.length === 0) {
      return <EmptyLive />;
    }
    // Hay finalizados pero no live: mostrar empty con la sección
    // finalizada debajo.
    return (
      <EmptyLiveWithFinalized
        finalizedCards={finalizedCards}
        ligasChips={ligasChips}
        proximoTorneoId={proximoTorneoId}
      />
    );
  }

  const activeTab = activeTabs[activeIdx]!;
  const torneoIdActivo = activeTab.torneoId;

  const rankingInicial = await listarRanking(torneoIdActivo, {
    limit: 100,
    usuarioId: session?.user?.id,
  });

  const initialSnapshot = {
    totalInscritos: rankingInicial.totalInscritos,
    pozoNeto: rankingInicial.pozoNeto,
    pagados: rankingInicial.pagados,
    ranking: rankingInicial.ranking.map((r) => ({
      rank: r.rank,
      ticketId: r.ticketId,
      usuarioId: r.usuarioId,
      nombre: r.nombre,
      puntosTotal: r.puntosTotal,
      puntosDetalle: r.puntosDetalle,
      predicciones: r.predicciones,
      premioEstimado: r.premioEstimado,
      username: r.username,
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
      tabs={activeTabs}
      torneoIdActivo={torneoIdActivo}
      rankingInicial={initialSnapshot}
      hasSession={!!session?.user?.id}
      miUsuarioId={session?.user?.id ?? null}
      ligasChips={ligasChips}
      finalizedCards={finalizedCards}
      filtroActivo={ligaSlug !== null}
      proximoTorneoId={proximoTorneoId}
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers locales
// ---------------------------------------------------------------------------

function buildLiveTabs(partidos: PartidoLive[]): LiveMatchTab[] {
  const tabs: LiveMatchTab[] = [];
  const nowMs = Date.now();
  for (const p of partidos) {
    const main = elegirTorneoPrincipal(p.torneos);
    if (!main) continue;
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
      fechaInicio: p.fechaInicio.toISOString(),
      // Hotfix #8 Ítem 4: el reloj local se ancla al momento REAL en que
      // el server capturó `elapsed`. Sin `elapsedAgeMs` el cliente asumía
      // "lo recibí ahora" aunque el cache tuviera un snap de hace 5 min,
      // causando el desfase que el PO reportó cada vez que abría la pestaña.
      statusShort: snap?.statusShort ?? null,
      elapsed: snap?.minuto ?? null,
      extra: snap?.extra ?? null,
      elapsedAgeMs: snap ? nowMs - snap.updatedAt : null,
    });
  }
  return tabs;
}

/** Si `torneoId` viene apuntando a un torneo finalizado, armamos un
 *  tab aislado para renderizar el hero post-partido. */
async function tryBuildFinalizedTab(
  torneoId: string,
  finalizadosRaw: PartidoLive[],
): Promise<LiveMatchTab | null> {
  const nowMs = Date.now();
  for (const p of finalizadosRaw) {
    const match = p.torneos.find((t) => t.id === torneoId);
    if (!match) continue;
    const snap = getLiveStatus(p.id);
    return {
      torneoId: match.id,
      partidoId: p.id,
      liga: p.liga,
      equipoLocal: p.equipoLocal,
      equipoVisita: p.equipoVisita,
      golesLocal: p.golesLocal ?? 0,
      golesVisita: p.golesVisita ?? 0,
      round: p.round,
      venue: p.venue,
      estado: "FINALIZADO",
      torneoEstado: match.estado as
        | "ABIERTO"
        | "EN_JUEGO"
        | "FINALIZADO"
        | "CERRADO",
      pozoBruto: match.pozoBruto,
      pozoNeto: match.pozoNeto,
      totalInscritos: match.totalInscritos,
      minutoLabel: snap?.label ?? "Final",
      // Hotfix #8 Bug #22: partido FINALIZADO — el hook `useMinutoEnVivo`
      // verá statusShort no-avanzable (FT/AET/PEN) y no correrá reloj.
      fechaInicio: p.fechaInicio.toISOString(),
      statusShort: snap?.statusShort ?? null,
      elapsed: snap?.minuto ?? null,
      extra: snap?.extra ?? null,
      elapsedAgeMs: snap ? nowMs - snap.updatedAt : null,
    };
  }
  return null;
}

/** Ligas presentes en el set EN_VIVO, mapeadas a (slug, label) y
 *  ordenadas por el LIGA_SLUGS_ORDER canónico. */
function derivarLigasPresentes(partidos: PartidoLive[]): LigaChipInfo[] {
  const ligasSet = new Set<string>();
  for (const p of partidos) {
    const slug = ligaToSlug(p.liga);
    if (slug) ligasSet.add(slug);
  }
  const chips: LigaChipInfo[] = [];
  for (const slug of LIGA_SLUGS_ORDER) {
    if (ligasSet.has(slug)) {
      chips.push({ slug, label: LIGA_CHIP_LABELS[slug] ?? slug });
    }
  }
  return chips;
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

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

/** Empty state del switcher + sección de finalizados visible debajo. */
function EmptyLiveWithFinalized({
  finalizedCards,
  ligasChips,
  proximoTorneoId,
}: {
  finalizedCards: FinalizedMatchCard[];
  ligasChips: LigaChipInfo[];
  proximoTorneoId: string | null;
}) {
  // Re-usamos el LiveMatchView con tabs vacío para que rendere el
  // header + section de finalizados debajo. Evita duplicar el diseño.
  return (
    <LiveMatchView
      tabs={[]}
      torneoIdActivo={null}
      rankingInicial={{
        totalInscritos: 0,
        pozoNeto: 0,
        pagados: 0,
        ranking: [],
        miPosicion: null,
      }}
      hasSession={false}
      miUsuarioId={null}
      ligasChips={ligasChips}
      finalizedCards={finalizedCards}
      filtroActivo={false}
      proximoTorneoId={proximoTorneoId}
    />
  );
}
