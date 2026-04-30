// /mis-combinadas — listado de tickets propios con tabs por estado.
//
// Lote 2 (Abr 2026): se demolió el sistema de Lukas. Las stats pasan de 5
// pills a 4 (Predicciones · Aciertos · % Acierto · Mejor puesto), sin
// "balance" ni "Lukas Premios". El banner de "ganaste X Lukas" ya no se
// renderiza — un ticket "ganado" pasa a significar quedar en top 10.
//
// Lote 5 (May 2026): el modelo deja atrás la métrica per-torneo y se
// orienta a la competencia mensual. Stat pills:
//   ⚽ Predicciones · 🏆 Aciertos · 📅 Posición del mes · ⭐ Mejor mes
// Tabs:
//   Activas · Mes en curso · Histórico
// El tab "Mes en curso" muestra los tickets de torneos finalizados del
// mes calendario en curso, con `puntosFinales` congelados.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  calcularStats,
  listarMisTickets,
  type TicketConTorneo,
} from "@/lib/services/tickets.service";
import {
  listarMisTicketsDelMesActual,
  obtenerMisStatsMensuales,
} from "@/lib/services/leaderboard.service";
import { StatsPill } from "@/components/tickets/StatsPill";
import { MisTicketsTabs, type TicketsTab } from "@/components/tickets/MisTicketsTabs";
import { MatchGroup } from "@/components/tickets/MatchGroup";
import { HistoryList } from "@/components/tickets/HistoryList";
import type { TicketConContexto } from "@/components/tickets/adapter";

export const dynamic = "force-dynamic";

interface Props {
  searchParams?: { tab?: string };
}

function resolveTab(raw: string | undefined): TicketsTab {
  if (raw === "mes-actual" || raw === "historico") return raw;
  return "activas";
}

export default async function MisCombinadasPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/mis-combinadas");
  }
  const tab = resolveTab(searchParams?.tab);
  const usuarioId = session.user.id;

  const [activasRes, historicoRes, mesActualTickets, stats, statsMensuales] =
    await Promise.all([
      listarMisTickets(usuarioId, { estado: "ACTIVOS", limit: 100 }),
      listarMisTickets(usuarioId, { estado: "HISTORIAL", limit: 100 }),
      listarMisTicketsDelMesActual(usuarioId),
      calcularStats(usuarioId),
      obtenerMisStatsMensuales(usuarioId),
    ]);

  const counts = {
    activas: activasRes.total,
    mesActual: mesActualTickets.length,
    historico: historicoRes.total,
  };

  const ticketsDeEstaTab: TicketConTorneo[] =
    tab === "mes-actual"
      ? mesActualTickets
      : tab === "historico"
        ? historicoRes.tickets
        : activasRes.tickets;

  const grupos = agruparPorTorneo(ticketsDeEstaTab);

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 pb-24 pt-6 md:px-6 md:pt-8">
      <header className="mb-5">
        <h1 className="font-display text-[40px] font-black uppercase leading-none tracking-[0.01em] text-dark">
          Mis combinadas
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-d">
          Cómo va con todas tus jugadas · Activas en vivo + tu performance
          en el leaderboard mensual
        </p>
      </header>

      <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatsPill
          icon="⚽"
          value={stats.jugadas.toString()}
          label="Predicciones"
        />
        <StatsPill
          icon="🏆"
          value={stats.ganadas.toString()}
          label="Aciertos"
          tone="gold"
        />
        <StatsPill
          icon="📅"
          value={
            statsMensuales.posicionDelMes !== null
              ? `#${statsMensuales.posicionDelMes}`
              : "—"
          }
          label={
            statsMensuales.posicionDelMes !== null
              ? `Pos. del mes · de ${statsMensuales.totalUsuariosMes}`
              : "Pos. del mes"
          }
          tone="green"
        />
        <StatsPill
          icon="⭐"
          value={
            statsMensuales.mejorMes !== null
              ? `Top ${statsMensuales.mejorMes.posicion}`
              : stats.mejorPuesto !== null
                ? `${stats.mejorPuesto}°`
                : "—"
          }
          label={
            statsMensuales.mejorMes !== null
              ? `Mejor mes · ${statsMensuales.mejorMes.nombreMes}`
              : "Mejor mes"
          }
          tone="purple"
        />
      </div>

      <MisTicketsTabs active={tab} counts={counts} />

      {grupos.length === 0 ? (
        <EmptyState tab={tab} mesNombre={statsMensuales.nombreMes} />
      ) : tab === "historico" ? (
        <HistoryList grupos={grupos} />
      ) : (
        <div>
          {grupos.map((grupo) => (
            <MatchGroup
              key={grupo.torneoId}
              tickets={grupo.tickets}
              hasSession={true}
            />
          ))}
        </div>
      )}

      <div className="mt-6 text-center">
        <Link
          href="/cuotas"
          className="inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-strong bg-transparent px-5 py-3 text-[14px] font-bold text-body transition-colors hover:border-brand-blue-main hover:text-brand-blue-main"
        >
          Ver más partidos para predecir →
        </Link>
      </div>
    </div>
  );
}

function agruparPorTorneo(
  tickets: TicketConTorneo[],
): Array<{ torneoId: string; tickets: TicketConContexto[] }> {
  const map = new Map<string, TicketConContexto[]>();
  for (const t of tickets) {
    const arr = map.get(t.torneoId) ?? [];
    arr.push(t);
    map.set(t.torneoId, arr);
  }
  const grupos = [...map.entries()].map(([torneoId, tickets]) => ({
    torneoId,
    tickets,
  }));
  grupos.sort((a, b) => {
    const pa = prioridad(a.tickets[0]!.torneo.estado);
    const pb = prioridad(b.tickets[0]!.torneo.estado);
    if (pa !== pb) return pa - pb;
    return (
      b.tickets[0]!.torneo.partido.fechaInicio.getTime() -
      a.tickets[0]!.torneo.partido.fechaInicio.getTime()
    );
  });
  return grupos;
}

function prioridad(estado: string): number {
  if (estado === "EN_JUEGO") return 0;
  if (estado === "ABIERTO") return 1;
  if (estado === "CERRADO") return 2;
  if (estado === "FINALIZADO") return 3;
  return 4;
}

function EmptyState({
  tab,
  mesNombre,
}: {
  tab: TicketsTab;
  mesNombre: string;
}) {
  const copy = {
    activas: {
      icon: "🎯",
      title: "No tenés combinadas activas",
      body: "Inscribite en un torneo abierto y armá tu combinada de 5 predicciones.",
    },
    "mes-actual": {
      icon: "📅",
      title: `Aún no tenés tickets finalizados en ${mesNombre}`,
      body: "Apenas se cierre el primer torneo del mes con tus predicciones, lo vas a ver acá con sus puntos finales.",
    },
    historico: {
      icon: "📜",
      title: "Sin historial todavía",
      body: "Tus combinadas de torneos finalizados y cancelados se guardan acá.",
    },
  }[tab];
  return (
    <div className="rounded-md border border-light bg-card px-6 py-12 text-center shadow-sm">
      <div aria-hidden className="mb-3 text-4xl">
        {copy.icon}
      </div>
      <p className="text-base font-semibold text-dark">{copy.title}</p>
      <p className="mt-1 text-[13px] text-muted-d">{copy.body}</p>
      <Link
        href="/cuotas"
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-3 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:bg-brand-gold-light"
      >
        Ir a partidos
      </Link>
    </div>
  );
}
