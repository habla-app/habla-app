"use client";
// LiveMatchView — orquesta el /live-match. Client Component porque:
//   - Mantiene WebSocket vivo y escucha ranking:update / partido:evento
//   - Tab state (Ranking / Stats / Events)
//   - Switcher entre partidos (leave + join)
//   - Sincroniza URL (?torneoId=...) sin recarga completa
//
// Bug #8 (revert Hotfix #3): todo tab tiene torneoId no-nullable.
// Bug #10: el switcher solo muestra EN_VIVO; los finalizados viven en
//   LiveFinalizedSection abajo del contenido en vivo.
// Bug #11: liga filter chips arriba del switcher; se renderean solo si
//   hay ≥1 liga con partidos en vivo. Filtran el switcher (no la
//   sección de finalizados).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveSwitcher } from "./LiveSwitcher";
import { LiveLeagueFilter, type LigaChipInfo } from "./LiveLeagueFilter";
import {
  LiveFinalizedSection,
  type FinalizedMatchCard,
} from "./LiveFinalizedSection";
import { LiveFinalizedBanner } from "./LiveFinalizedBanner";
import { LiveHero } from "./LiveHero";
import { MiTicketCard } from "./MiTicketCard";
import { RankingTable } from "./RankingTable";
import { StatsView } from "./StatsView";
import { EventsView } from "./EventsView";
import { useRankingEnVivo } from "@/hooks/useRankingEnVivo";
import { useEventosPartido } from "@/hooks/useEventosPartido";
import type { RankingRowPayload } from "@/lib/realtime/events";
import { premioEstimadoSinEmpate } from "@/lib/utils/premios-distribucion";

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
  torneoEstado: "ABIERTO" | "EN_JUEGO" | "FINALIZADO" | "CERRADO";
  pozoBruto: number;
  pozoNeto: number;
  totalInscritos: number;
  /** Label del minuto listo para renderizar ("23'", "ENT", "FIN",
   *  "—"). Bug #9: SSR lo setea desde el cache del poller; WS lo
   *  sobrescribe en vivo (`live.minutoLabel` tiene preferencia). */
  minutoLabel: string | null;
  /** Hotfix #8 Bug #22: snapshot del server para el reloj local del
   *  LiveHero. Llegan del cache `live-partido-status`. Null hasta
   *  que el poller tenga datos. */
  statusShort: string | null;
  elapsed: number | null;
  snapshotUpdatedAt: number | null;
}

interface InitialSnapshot {
  totalInscritos: number;
  pozoNeto: number;
  /** Hotfix #6: posiciones pagadas (M). */
  pagados: number;
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
  /** Null si no hay tab activo (caso: filtro deja lista vacía o
   *  no hay partidos live). El hero/ranking/tabs no se renderean. */
  torneoIdActivo: string | null;
  rankingInicial: InitialSnapshot;
  hasSession: boolean;
  miUsuarioId: string | null;
  ligasChips: LigaChipInfo[];
  finalizedCards: FinalizedMatchCard[];
  /** True si `?liga=` está activo — usado para el copy del empty
   *  state del switcher (invita a volver a "Todas"). */
  filtroActivo: boolean;
  /** Próximo torneo ABIERTO más cercano a cerrar — alimenta el CTA
   *  de la banda motivacional cuando el tab activo es FINALIZADO
   *  (Bug #16). Null → CTA genérico a /matches. */
  proximoTorneoId?: string | null;
}

type TabKey = "ranking" | "stats" | "eventos";

export function LiveMatchView({
  tabs,
  torneoIdActivo: torneoIdInicial,
  rankingInicial,
  hasSession,
  miUsuarioId,
  ligasChips,
  finalizedCards,
  filtroActivo,
  proximoTorneoId = null,
}: LiveMatchViewProps) {
  const router = useRouter();
  // Cuando el filtro deja tabs vacíos, torneoIdActivo es null y no
  // se renderea hero/tabs. `activeTorneoId` arranca con el valor del
  // server y solo se cambia via setActiveTorneoId (switcher).
  const [activeTorneoId, setActiveTorneoId] = useState<string>(
    torneoIdInicial ?? "",
  );
  const [activeTab, setActiveTab] = useState<TabKey>("ranking");
  const [miPosLocal, setMiPosLocal] = useState(rankingInicial.miPosicion);
  const didFirstMount = useRef(false);

  const active = torneoIdInicial
    ? (tabs.find((t) => t.torneoId === activeTorneoId) ?? tabs[0] ?? null)
    : null;

  const live = useRankingEnVivo(active?.torneoId ?? null, {
    initialLimit: 100,
  });

  const ranking: RankingRowPayload[] =
    live.ranking.length > 0 ? live.ranking : rankingInicial.ranking;
  const totalInscritos = live.ranking.length > 0
    ? live.totalInscritos
    : rankingInicial.totalInscritos;
  const pozoNeto = live.pozoNeto > 0 ? live.pozoNeto : rankingInicial.pozoNeto;

  const eventos = useEventosPartido(
    active?.torneoId ?? null,
    active?.partidoId ?? null,
  );

  const scoreLocal = eventos.marcadorLive?.local ?? active?.golesLocal ?? 0;
  const scoreVisita = eventos.marcadorLive?.visita ?? active?.golesVisita ?? 0;

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
      active?.torneoId === torneoIdInicial
    ) {
      setMiPosLocal(rankingInicial.miPosicion);
    } else {
      setMiPosLocal(null);
    }
  }, [ranking, miUsuarioId, rankingInicial, active, torneoIdInicial]);

  // Sync URL cuando cambia el tab activo (sin recarga).
  useEffect(() => {
    if (!didFirstMount.current) {
      didFirstMount.current = true;
      return;
    }
    if (!active) return;
    // Preservar el ?liga= si existe; para eso leemos la URL actual.
    const url = new URL(window.location.href);
    url.searchParams.set("torneoId", active.torneoId);
    router.replace(
      `${url.pathname}?${url.searchParams.toString()}`,
      { scroll: false },
    );
  }, [active, router]);

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

      {/* Filter chips de liga (Bug #11) — solo si hay ≥1 liga live */}
      <LiveLeagueFilter ligas={ligasChips} />

      {/* Switcher de partidos EN_VIVO (Bug #10) */}
      {tabs.length > 0 && active ? (
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
      ) : (
        <LiveSwitcherEmpty filtroActivo={filtroActivo} />
      )}

      {active && (
        <>
          <LiveHero
            liga={active.liga}
            round={active.round}
            estado={active.estado}
            equipoLocal={active.equipoLocal}
            equipoVisita={active.equipoVisita}
            golesLocal={scoreLocal}
            golesVisita={scoreVisita}
            minutoLabel={live.minutoLabel ?? active.minutoLabel}
            statusShort={live.statusShort ?? active.statusShort}
            elapsed={live.minutoPartido ?? active.elapsed}
            snapshotUpdatedAt={
              live.snapshotUpdatedAt ?? active.snapshotUpdatedAt
            }
            totalInscritos={totalInscritos}
            pozoNeto={pozoNeto}
            primerPremio={premioEstimadoSinEmpate(1, totalInscritos, pozoNeto)}
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
              pagados={live.pagados > 0 ? live.pagados : rankingInicial.pagados}
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

          {/* Bug #16: banda motivacional cuando el tab activo es un
              torneo FINALIZADO — "el próximo te espera". Para tabs en
              vivo, dejamos el espacio limpio para no competir con el
              ranking en vivo. */}
          {active.estado === "FINALIZADO" && (
            <LiveFinalizedBanner proximoTorneoId={proximoTorneoId} />
          )}
        </>
      )}

      {/* Sección separada: partidos finalizados (Bug #10) */}
      <LiveFinalizedSection matches={finalizedCards} />
    </div>
  );
}

function LiveSwitcherEmpty({ filtroActivo }: { filtroActivo: boolean }) {
  return (
    <div
      className="mb-5 rounded-md border border-light bg-card px-5 py-8 text-center shadow-sm"
      data-testid="live-switcher-empty"
    >
      <div aria-hidden className="mb-2 text-3xl">
        🌙
      </div>
      <p className="font-display text-[18px] font-extrabold uppercase tracking-[0.02em] text-dark">
        No hay partidos en vivo ahora mismo
      </p>
      <p className="mt-1 text-[13px] text-muted-d">
        {filtroActivo
          ? "No hay partidos de esta liga en vivo. Probá quitar el filtro."
          : "Cuando arranque el próximo torneo, aparece acá."}
      </p>
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
