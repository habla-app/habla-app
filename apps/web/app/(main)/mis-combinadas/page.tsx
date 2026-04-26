// /mis-combinadas — Sub-Sprint 4.
//
// Server Component: trae tickets del usuario (con torneo + partido
// embebidos) y stats. Agrupa por torneoId para renderizar MatchGroup.
// El tab activo viene en ?tab=activas|ganadas|historial (default activas).
//
// Hotfix Bug #3: `force-dynamic` evita que Next.js cachee el RSC entre
// requests con sesión distinta. Sin esto, el primer render anónimo
// quedaba cacheado y futuras navegaciones autenticadas redirigían a
// login aunque el cookie fuera válido.
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { obtenerBalanceGanadas } from "@/lib/usuarios";
import {
  calcularStats,
  listarMisTickets,
  type TicketConTorneo,
} from "@/lib/services/tickets.service";
import { StatsPill } from "@/components/tickets/StatsPill";
import { LukasPremiosPill } from "@/components/tickets/LukasPremiosPill";
import { MisTicketsTabs, type TicketsTab } from "@/components/tickets/MisTicketsTabs";
import { MatchGroup } from "@/components/tickets/MatchGroup";
import { HistoryList } from "@/components/tickets/HistoryList";
import { PremioGanadoTracker } from "@/components/analytics/PremioGanadoTracker";
import type { TicketConContexto } from "@/components/tickets/adapter";

export const dynamic = "force-dynamic";

interface Props {
  searchParams?: { tab?: string };
}

function resolveTab(raw: string | undefined): TicketsTab {
  if (raw === "ganadas" || raw === "historial") return raw;
  return "activas";
}

function estadoToQuery(
  tab: TicketsTab,
): "ACTIVOS" | "GANADOS" | "HISTORIAL" {
  if (tab === "ganadas") return "GANADOS";
  if (tab === "historial") return "HISTORIAL";
  return "ACTIVOS";
}

export default async function MisCombinadasPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/mis-combinadas");
  }
  const tab = resolveTab(searchParams?.tab);
  const [activasRes, ganadasRes, historialRes, stats, balanceGanadas] =
    await Promise.all([
      listarMisTickets(session.user.id, { estado: "ACTIVOS", limit: 100 }),
      listarMisTickets(session.user.id, { estado: "GANADOS", limit: 100 }),
      listarMisTickets(session.user.id, { estado: "HISTORIAL", limit: 100 }),
      calcularStats(session.user.id),
      obtenerBalanceGanadas(session.user.id),
    ]);

  const counts = {
    activas: activasRes.total,
    ganadas: ganadasRes.total,
    historial: historialRes.total,
  };

  const ticketsDeEstaTab =
    tab === "ganadas"
      ? ganadasRes.tickets
      : tab === "historial"
        ? historialRes.tickets
        : activasRes.tickets;

  const grupos = agruparPorTorneo(ticketsDeEstaTab);

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 pb-24 pt-6 md:px-6 md:pt-8">
      <header className="mb-5">
        <h1 className="font-display text-[40px] font-black uppercase leading-none tracking-[0.01em] text-dark">
          Mis combinadas
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-d">
          Cómo va con todas tus jugadas · Activas en vivo + resumen del historial
        </p>
      </header>

      <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatsPill
          icon="⚽"
          value={stats.jugadas.toString()}
          label="Combinadas jugadas"
        />
        <StatsPill
          icon="🏆"
          value={stats.ganadas.toString()}
          label="Ganadas con premio"
          tone="gold"
        />
        <StatsPill
          icon="🎯"
          value={`${stats.aciertoPct}%`}
          label="Tasa de acierto"
          tone="green"
        />
        {/* Lote 6C: muestra Lukas Premios (ganadas, canjeables en /tienda)
            en lugar del balance total. Dato SSR via obtenerBalanceGanadas. */}
        <LukasPremiosPill lukasPremios={balanceGanadas} />
        <StatsPill
          icon="⭐"
          value={stats.mejorPuesto !== null ? `${stats.mejorPuesto}°` : "—"}
          label="Mejor puesto"
          tone="purple"
        />
      </div>

      <PremioGanadoTracker
        tickets={ganadasRes.tickets
          .filter((t) => t.premioLukas > 0 && t.posicionFinal !== null)
          .map((t) => ({
            ticketId: t.id,
            torneoId: t.torneoId,
            posicion: t.posicionFinal as number,
            lukasGanados: t.premioLukas,
          }))}
      />

      <MisTicketsTabs active={tab} counts={counts} />

      {/* Sub-Sprint 6: cuando el usuario está en "Ganadas" y tiene premios
          acreditados, mostramos una banda motivacional que empuja a /tienda.
          La suma del premio total ya acreditado en la vista actual se muestra
          como incentivo. Cuando el tab es otro, o no hay premios, no rendereamos. */}
      {tab === "ganadas" && ganadasRes.tickets.length > 0 && (
        <WinnerPrompt tickets={ganadasRes.tickets} />
      )}

      {grupos.length === 0 ? (
        <EmptyState tab={tab} />
      ) : tab === "historial" ? (
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
          href="/matches"
          className="inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-strong bg-transparent px-5 py-3 text-[14px] font-bold text-body transition-colors hover:border-brand-blue-main hover:text-brand-blue-main"
        >
          Ver más partidos para inscribirte →
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
  // Orden de grupos: EN_JUEGO primero, luego ABIERTO/CERRADO por fecha,
  // luego FINALIZADOS por fecha descendente.
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

function WinnerPrompt({ tickets }: { tickets: TicketConTorneo[] }) {
  const totalGanado = tickets.reduce((s, t) => s + t.premioLukas, 0);
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg bg-hero-blue px-5 py-4 text-white shadow-md md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>
            🏆
          </span>
          <div className="font-display text-[18px] font-extrabold">
            ¡Ganaste {totalGanado} 🪙 en tus torneos!
          </div>
        </div>
        <p className="mt-1 text-[13px] text-white/80">
          Canjealos por premios reales en la tienda.
        </p>
      </div>
      <Link
        href="/tienda"
        className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-2.5 font-bold text-dark shadow-gold-btn transition-colors hover:bg-brand-gold-light"
      >
        🎁 Ir a la tienda →
      </Link>
    </div>
  );
}

function EmptyState({ tab }: { tab: TicketsTab }) {
  const copy = {
    activas: {
      icon: "🎯",
      title: "No tienes combinadas activas",
      body: "Inscribite en un torneo abierto y armá tu combinada de 5 predicciones.",
    },
    ganadas: {
      icon: "🏆",
      title: "Aún no ganaste premios",
      body: "Cuando quedes top 10 en un torneo finalizado, aparecerán acá tus ganadores.",
    },
    historial: {
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
        href="/matches"
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-3 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:bg-brand-gold-light"
      >
        Ir a partidos
      </Link>
    </div>
  );
}
