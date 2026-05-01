// /mis-predicciones — Lote C v3.1, rename de /mis-combinadas. Spec:
// docs/ux-spec/03-pista-usuario-autenticada/mis-predicciones.spec.md.
//
// Cambios vs /mis-combinadas (Lote 5):
//   - URL renombrada (redirect 301 desde /mis-combinadas vive en
//     next.config.js).
//   - Reescritura visual mobile-first: hero stats + chart de evolución +
//     tabs horizontales + lista de cards con resultado.
//   - 5 tabs: Todas | Mes en curso | Ganadas | Pendientes | Falladas.
//   - Click en una predicción navega a /comunidad/torneo/[partidoId] (URL
//     nueva del Lote C).
//
// Servicios reutilizados:
//   - listarMisTickets (Lote 0/5, sin cambio)
//   - calcularStats (Lote 0/2)
//   - obtenerMisStatsMensuales (Lote 5)
//   - obtenerEvolucionMensual (NUEVO Lote C, en leaderboard.service)
//   - listarMisTicketsDelMesActual (Lote 5)

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  calcularStats,
  listarMisTickets,
  type TicketConTorneo,
} from "@/lib/services/tickets.service";
import {
  listarMisTicketsDelMesActual,
  obtenerEvolucionMensual,
  obtenerMisStatsMensuales,
} from "@/lib/services/leaderboard.service";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { StatsHero } from "@/components/mis-predicciones/StatsHero";
import { EvolucionChart } from "@/components/mis-predicciones/EvolucionChart";
import {
  FiltrosTabs,
  type MisPrediccionesTab,
} from "@/components/mis-predicciones/FiltrosTabs";
import { PrediccionListItem } from "@/components/mis-predicciones/PrediccionListItem";
import { EmptyState } from "@/components/mis-predicciones/EmptyState";

export const dynamic = "force-dynamic";

interface Props {
  searchParams?: { tab?: string };
}

function resolveTab(raw: string | undefined): MisPrediccionesTab {
  switch (raw) {
    case "mes-actual":
    case "ganadas":
    case "pendientes":
    case "falladas":
      return raw;
    default:
      return "todas";
  }
}

export default async function MisPrediccionesPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/mis-predicciones");
  }

  const tab = resolveTab(searchParams?.tab);
  const usuarioId = session.user.id;

  const [activasRes, historicoRes, mesActual, stats, statsMensuales, evolucion] =
    await Promise.all([
      listarMisTickets(usuarioId, { estado: "ACTIVOS", limit: 100 }),
      listarMisTickets(usuarioId, { estado: "HISTORIAL", limit: 100 }),
      listarMisTicketsDelMesActual(usuarioId),
      calcularStats(usuarioId),
      obtenerMisStatsMensuales(usuarioId),
      obtenerEvolucionMensual(usuarioId, { meses: 6 }),
    ]);

  // Counts derivados (sirven para el badge dentro de los tabs).
  const ganadas = historicoRes.tickets.filter(
    (t) => t.posicionFinal !== null && t.posicionFinal > 0 && t.posicionFinal <= 10,
  );
  const falladas = historicoRes.tickets.filter(
    (t) => t.posicionFinal === null || t.posicionFinal === 0 || t.posicionFinal > 10,
  );

  const counts: Partial<Record<MisPrediccionesTab, number>> = {
    todas: activasRes.total + historicoRes.total,
    "mes-actual": mesActual.length,
    ganadas: ganadas.length,
    pendientes: activasRes.total,
    falladas: falladas.length,
  };

  const lista: TicketConTorneo[] =
    tab === "mes-actual"
      ? mesActual
      : tab === "ganadas"
        ? ganadas
        : tab === "pendientes"
          ? activasRes.tickets
          : tab === "falladas"
            ? falladas
            : [...activasRes.tickets, ...historicoRes.tickets].sort(
                (a, b) => b.creadoEn.getTime() - a.creadoEn.getTime(),
              );

  const diasParaCierre = diasRestantesDelMes();

  return (
    <div className="pb-16">
      <TrackOnMount
        event="mis_predicciones_visto"
        props={{ tab, total: stats.jugadas }}
      />

      <StatsHero
        predicciones={stats.jugadas}
        aciertoPct={stats.aciertoPct}
        posicionMes={statsMensuales.posicionDelMes}
        totalUsuariosMes={statsMensuales.totalUsuariosMes}
        diasParaCierre={diasParaCierre}
        nombreMes={capitalize(statsMensuales.nombreMes)}
      />

      <EvolucionChart data={evolucion} />

      <FiltrosTabs active={tab} counts={counts} />

      <section className="space-y-2.5 px-4 py-4">
        {lista.length === 0 ? (
          <EmptyState
            tab={tab}
            nombreMes={capitalize(statsMensuales.nombreMes)}
          />
        ) : (
          lista.map((t) => <PrediccionListItem key={t.id} ticket={t} />)
        )}
      </section>
    </div>
  );
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function diasRestantesDelMes(): number {
  // Calcula los días que faltan para el cierre del mes en zona Lima (1°
  // del mes siguiente, 00:00). Coherente con el cron J del Lote 5.
  const ahora = new Date();
  const limaIso = ahora.toLocaleString("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [yStr, mStr, dStr] = limaIso.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const ultimoDia = new Date(y, m, 0).getDate();
  return Math.max(0, ultimoDia - d);
}
