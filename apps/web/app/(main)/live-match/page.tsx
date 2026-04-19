// /live-match — Sub-Sprint 5.
//
// Server Component delgado: resuelve qué torneo mostrar y pasa los IDs
// al Client Component `LiveMatchView` que maneja la conexión WS, tabs,
// y refetch.
//
// Params:
//   - ?torneoId=<id>  → pantalla específica
//   - sin param       → primer partido EN_VIVO (prioriza torneo EN_JUEGO,
//                       cae a CERRADO/FINALIZADO/ABIERTO según prioridad)
//
// Hotfix post-Sub-Sprint 5 (Bug #2): la query original tenía un filtro
// existencial `where: { torneos: { some: { estado: { in: [...] } } } }`
// que descartaba partidos cuyos torneos no habían transicionado. Ahora el
// query vive en `lib/services/live-matches.service.ts` y filtra solo por
// `partido.estado`, aceptando torneos en ABIERTO (el cron in-process
// puede tardar hasta 1 min en transicionar).

import { auth } from "@/lib/auth";
import { listarRanking } from "@/lib/services/ranking.service";
import {
  elegirTorneoPrincipal,
  obtenerLiveMatches,
} from "@/lib/services/live-matches.service";
import { LiveMatchView } from "@/components/live/LiveMatchView";

interface Props {
  searchParams?: { torneoId?: string };
}

export default async function LiveMatchPage({ searchParams }: Props) {
  const session = await auth();

  const liveMatchesRaw = await obtenerLiveMatches({ limit: 6 });

  // Filtramos partidos sin torneos no-cancelados (defensive — no debería
  // pasar por el flow normal, pero un partido importado sin torneo aún
  // técnicamente puede llegar acá).
  const partidosConTorneos = liveMatchesRaw.filter(
    (p) => elegirTorneoPrincipal(p.torneos) !== null,
  );

  if (partidosConTorneos.length === 0) {
    return <EmptyLive />;
  }

  // Torneo seleccionado: del query o el principal del primer partido.
  const torneoIdQuery = searchParams?.torneoId;
  let torneoIdActivo: string | null = null;
  if (torneoIdQuery) {
    const match = partidosConTorneos.find((p) =>
      p.torneos.some((t) => t.id === torneoIdQuery),
    );
    if (match) torneoIdActivo = torneoIdQuery;
  }
  if (!torneoIdActivo) {
    const first = elegirTorneoPrincipal(partidosConTorneos[0]!.torneos);
    torneoIdActivo = first?.id ?? null;
  }
  if (!torneoIdActivo) {
    return <EmptyLive />;
  }

  // Snapshot inicial del torneo activo (server-rendered). `listarRanking`
  // funciona aún con torneos ABIERTOS (devuelve tickets con puntos=0).
  const rankingInicial = await listarRanking(torneoIdActivo, {
    limit: 100,
    usuarioId: session?.user?.id,
  });

  // Tabs del switcher — todos los partidos con sus torneos principales.
  // `elegirTorneoPrincipal` siempre devuelve algo aquí porque ya filtramos
  // arriba, pero TypeScript no lo infiere — defensive default.
  const tabs = partidosConTorneos.map((p) => {
    const main = elegirTorneoPrincipal(p.torneos) ?? p.torneos[0]!;
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
      torneoEstado: main.estado as
        | "ABIERTO"
        | "EN_JUEGO"
        | "FINALIZADO"
        | "CERRADO",
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
