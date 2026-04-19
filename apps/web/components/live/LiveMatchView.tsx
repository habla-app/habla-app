"use client";
// LiveMatchView — orquesta el /live-match. Client Component porque:
//   - Mantiene WebSocket vivo y escucha ranking:update / partido:evento
//   - Tab state (Ranking / Stats / Events)
//   - Switcher entre partidos (leave + join)
//   - Sincroniza URL (?torneoId=...) sin recarga completa
//
// Bug #8: todo partido que aparezca acá tiene al menos un torneo
// no-cancelado (garantizado por `obtenerLiveMatches`). Por eso
// `LiveMatchTab.torneoId` es siempre `string` (nunca null) y removimos
// el componente `<SinTorneoActivo>` que existía en Hotfix #3.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveSwitcher } from "./LiveSwitcher";
import { LiveHero } from "./LiveHero";
import { MiTicketCard } from "./MiTicketCard";
import { RankingTable } from "./RankingTable";
import { StatsView } from "./StatsView";
import { EventsView } from "./EventsView";
import { useRankingEnVivo } from "@/hooks/useRankingEnVivo";
import { useEventosPartido } from "@/hooks/useEventosPartido";
import type { RankingRowPayload } from "@/lib/realtime/events";

export interface LiveMatchTab {
  torneoId: string;
  partidoId: string;
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  golesLocal: number;
  golesVisita: number;
  round: string | null;
  venue: string | null;
  estado: "EN_VIVO" | "FINALIZADO";
  // ABIERTO incluido por hotfix Bug #2: el cron de cierre puede tardar
  // hasta 1 minuto en transicionar el torneo, así que un partido EN_VIVO
  // puede tener torneos asociados aún en ABIERTO. Se renderea igual.
  torneoEstado: "ABIERTO" | "EN_JUEGO" | "FINALIZADO" | "CERRADO";
  pozoBruto: number;
  pozoNeto: number;
  totalInscritos: number;
}

interface InitialSnapshot {
  totalInscritos: number;
  pozoNeto: number;
  ranking: RankingRowPayload[];
  miPosicion: {
    posicion: number;
    ticketId: string;
    puntosTotal: number;
    premioEstimado: number;
  } | null;
}

interface LiveMatchViewProps {
  tabs: LiveMatchTab[];
  torneoIdActivo: string;
  rankingInicial: InitialSnapshot;
  hasSession: boolean;
  miUsuarioId: string | null;
}

type TabKey = "ranking" | "stats" | "eventos";

export function LiveMatchView({
  tabs,
  torneoIdActivo: torneoIdInicial,
  rankingInicial,
  hasSession,
  miUsuarioId,
}: LiveMatchViewProps) {
  const router = useRouter();
  const [activeTorneoId, setActiveTorneoId] = useState<string>(torneoIdInicial);
  const [activeTab, setActiveTab] = useState<TabKey>("ranking");
  const [miPosLocal, setMiPosLocal] = useState(rankingInicial.miPosicion);
  const didFirstMount = useRef(false);

  const active = tabs.find((t) => t.torneoId === activeTorneoId) ?? tabs[0]!;

  // Ranking en vivo para el torneo activo.
  const live = useRankingEnVivo(activeTorneoId, { initialLimit: 100 });

  // Inicial del servidor si el hook aún no trajo nada
  const ranking: RankingRowPayload[] =
    live.ranking.length > 0 ? live.ranking : rankingInicial.ranking;
  const totalInscritos = live.ranking.length > 0
    ? live.totalInscritos
    : rankingInicial.totalInscritos;
  const pozoNeto = live.pozoNeto > 0 ? live.pozoNeto : rankingInicial.pozoNeto;

  // Eventos en vivo (al partido, no al torneo — funciona aunque no haya torneo)
  const eventos = useEventosPartido(activeTorneoId, active.partidoId);

  // Score actual (live si el hook lo tiene, sino el del server)
  const scoreLocal = eventos.marcadorLive?.local ?? active.golesLocal;
  const scoreVisita = eventos.marcadorLive?.visita ?? active.golesVisita;

  // Mi posición — si hay ranking en vivo, recalcular buscando mi usuario
  useEffect(() => {
    if (!miUsuarioId) {
      setMiPosLocal(null);
      return;
    }
    const miFila = ranking.find((r) => r.usuarioId === miUsuarioId);
    if (miFila) {
      setMiPosLocal({
        posicion: miFila.rank,
        ticketId: miFila.ticketId,
        puntosTotal: miFila.puntosTotal,
        premioEstimado: miFila.premioEstimado,
      });
    } else if (
      rankingInicial.miPosicion &&
      activeTorneoId === torneoIdInicial
    ) {
      setMiPosLocal(rankingInicial.miPosicion);
    } else {
      setMiPosLocal(null);
    }
  }, [ranking, miUsuarioId, rankingInicial, activeTorneoId, torneoIdInicial]);

  // Sync URL cuando el tab activo cambia (sin recarga).
  useEffect(() => {
    if (!didFirstMount.current) {
      didFirstMount.current = true;
      return;
    }
    router.replace(`/live-match?torneoId=${activeTorneoId}`, { scroll: false });
  }, [activeTorneoId, router]);

  const miFilaRow: RankingRowPayload | null = miUsuarioId
    ? ranking.find((r) => r.usuarioId === miUsuarioId) ?? null
    : null;

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 pb-20 pt-6 md:px-6 md:pt-8">
      <header className="mb-4">
        <h1 className="font-display text-[38px] font-black uppercase leading-none tracking-[0.01em] text-dark">
          🔴 Partidos en vivo
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-d">
          Ranking en tiempo real · Se actualiza solo cuando hay un evento
        </p>
      </header>

      <LiveSwitcher
        tabs={tabs.map((t) => {
          const isActive = t.torneoId === activeTorneoId;
          return {
            torneoId: t.torneoId,
            liga: t.liga,
            equipoLocal: t.equipoLocal,
            equipoVisita: t.equipoVisita,
            golesLocal: isActive ? scoreLocal : t.golesLocal,
            golesVisita: isActive ? scoreVisita : t.golesVisita,
            round: t.round,
            estado: t.estado,
          };
        })}
        active={activeTorneoId}
        onChange={setActiveTorneoId}
      />

      <LiveHero
        liga={active.liga}
        round={active.round}
        estado={active.estado}
        equipoLocal={active.equipoLocal}
        equipoVisita={active.equipoVisita}
        golesLocal={scoreLocal}
        golesVisita={scoreVisita}
        minuto={live.minutoPartido}
        totalInscritos={totalInscritos}
        pozoNeto={pozoNeto}
        primerPremio={Math.floor(pozoNeto * 0.35)}
        ultimosEventos={eventos.eventos.slice(-5).reverse()}
      />

      {hasSession && miPosLocal && (
        <MiTicketCard
          miPosicion={miPosLocal}
          totalInscritos={totalInscritos}
          row={miFilaRow}
          equipoLocal={active.equipoLocal}
          equipoVisita={active.equipoVisita}
          partidoEstado={active.estado}
        />
      )}

      <div
        role="tablist"
        aria-label="Vista del partido"
        className="mb-4 flex gap-2 overflow-x-auto border-b border-light"
      >
        <TabBtn
          label="🏆 Ranking en vivo"
          active={activeTab === "ranking"}
          onClick={() => setActiveTab("ranking")}
        />
        <TabBtn
          label="📊 Estadísticas"
          active={activeTab === "stats"}
          onClick={() => setActiveTab("stats")}
        />
        <TabBtn
          label="⚽ Eventos"
          active={activeTab === "eventos"}
          onClick={() => setActiveTab("eventos")}
        />
      </div>

      {activeTab === "ranking" && (
        <RankingTable
          ranking={ranking}
          miUsuarioId={miUsuarioId}
          equipoLocal={active.equipoLocal}
          equipoVisita={active.equipoVisita}
          totalInscritos={totalInscritos}
        />
      )}
      {activeTab === "stats" && (
        <StatsView
          partidoId={active.partidoId}
          equipoLocal={active.equipoLocal}
          equipoVisita={active.equipoVisita}
        />
      )}
      {activeTab === "eventos" && (
        <EventsView
          eventos={eventos.eventos}
          isLoading={eventos.isLoading}
          equipoLocal={active.equipoLocal}
          equipoVisita={active.equipoVisita}
        />
      )}

      <div className="mt-3 text-right text-[11px] text-soft">
        {live.isConnected ? "🟢 Conectado en vivo" : "🟠 Reconectando…"}
      </div>
    </div>
  );
}

function TabBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-shrink-0 border-b-[3px] px-4 py-2.5 font-display text-[14px] font-bold uppercase tracking-[0.03em] transition-colors ${
        active
          ? "border-brand-gold text-dark"
          : "border-transparent text-muted-d hover:text-brand-blue-main"
      }`}
    >
      {label}
    </button>
  );
}
