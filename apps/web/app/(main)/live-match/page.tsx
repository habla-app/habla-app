// /live-match — Sub-Sprint 5.
//
// Server Component delgado: resuelve qué torneo mostrar y pasa los IDs
// al Client Component `LiveMatchView` que maneja la conexión WS, tabs,
// y refetch.
//
// Params:
//   - ?torneoId=<id>  → pantalla específica
//   - sin param       → primer partido EN_VIVO con torneo EN_JUEGO (o CERRADO)

import { redirect } from "next/navigation";
import { prisma } from "@habla/db";
import { auth } from "@/lib/auth";
import { listarRanking } from "@/lib/services/ranking.service";
import { LiveMatchView } from "@/components/live/LiveMatchView";

interface Props {
  searchParams?: { torneoId?: string };
}

export default async function LiveMatchPage({ searchParams }: Props) {
  const session = await auth();

  const liveMatchesRaw = await prisma.partido.findMany({
    where: {
      OR: [{ estado: "EN_VIVO" }, { estado: "FINALIZADO" }],
      torneos: {
        some: {
          estado: { in: ["EN_JUEGO", "FINALIZADO", "CERRADO"] },
        },
      },
    },
    include: {
      torneos: {
        where: { estado: { in: ["EN_JUEGO", "FINALIZADO", "CERRADO"] } },
        orderBy: { pozoBruto: "desc" },
      },
    },
    orderBy: { fechaInicio: "desc" },
    take: 6,
  });

  if (liveMatchesRaw.length === 0) {
    return <EmptyLive />;
  }

  // Torneo seleccionado: del query o el primero
  const torneoIdQuery = searchParams?.torneoId;
  let torneoIdActivo: string | null = null;
  if (torneoIdQuery) {
    const match = liveMatchesRaw.find((p) =>
      p.torneos.some((t) => t.id === torneoIdQuery),
    );
    if (match) torneoIdActivo = torneoIdQuery;
  }
  if (!torneoIdActivo) {
    torneoIdActivo = liveMatchesRaw[0]!.torneos[0]?.id ?? null;
  }
  if (!torneoIdActivo) {
    // No debería pasar por el where de arriba, pero defensive
    return <EmptyLive />;
  }

  // Snapshot inicial del torneo activo (server-rendered)
  const rankingInicial = await listarRanking(torneoIdActivo, {
    limit: 100,
    usuarioId: session?.user?.id,
  });

  // Tabs del switcher — todos los partidos con sus torneos principales
  const tabs = liveMatchesRaw.map((p) => {
    const main = p.torneos[0]!;
    return {
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
      torneoEstado: main.estado as "EN_JUEGO" | "FINALIZADO" | "CERRADO",
      pozoBruto: main.pozoBruto,
      pozoNeto: main.pozoNeto,
      totalInscritos: main.totalInscritos,
    };
  });

  return (
    <LiveMatchView
      tabs={tabs}
      torneoIdActivo={torneoIdActivo}
      rankingInicial={{
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
      }}
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

export const dynamic = "force-dynamic";
