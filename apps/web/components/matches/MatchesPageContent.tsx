// Contenido compartido entre `/` y `/matches`. Server Component async.
// Fetchea los torneos reales desde el servicio de torneos y los pinta con
// MatchCard (urgencia computada desde cierreAt). La sidebar sticky de los
// 3 widgets se comparte con ambas rutas.
//
// Filtros/paginación — Sub-Sprint 3 se enfoca en la vista por defecto
// (ABIERTO, futuros, ordenados por cierreAt). Las chips quedan visibles
// pero decorativas hasta que se wire el query-params filtering.
import { listar } from "@/lib/services/torneos.service";
import { Chip } from "@/components/ui";
import { MatchCard } from "@/components/matches/MatchCard";
import { torneoToCardData } from "@/components/matches/adapter";
import { MatchesSidebar } from "@/components/matches/MatchesSidebar";

const FILTROS_LIGA = [
  "Todas las ligas",
  "Liga 1 Perú",
  "Champions",
  "Libertadores",
  "Premier",
  "Mundial 2026",
];

interface Props {
  /** Filtro liga opcional — viene de ?liga=... en el futuro. */
  liga?: string;
}

export async function MatchesPageContent({ liga }: Props = {}) {
  const { torneos } = await listar({
    estado: "ABIERTO",
    liga,
    limit: 50,
  });

  const now = new Date();
  const cards = torneos
    .filter((t) => t.cierreAt.getTime() > now.getTime()) /* esconder vencidos */
    .map((t) => torneoToCardData(t, now));

  const { torneos: finalizados } = await listar({
    estado: "FINALIZADO",
    limit: 10,
  });

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 md:px-6 md:pt-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <header className="mb-5">
            <h1 className="font-display text-[40px] font-black uppercase leading-none tracking-[0.01em] text-dark">
              Partidos de hoy
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-d">
              Inscríbete al torneo, arma tu combinada de 5 predicciones y
              compite por el pozo.
            </p>
          </header>

          {/* FILTER STRIP — decorativo hasta que se wire ?liga=… */}
          <div className="scrollbar-none mb-5 flex gap-2 overflow-x-auto pb-1">
            {FILTROS_LIGA.map((filtro, idx) => (
              <Chip key={filtro} active={idx === 0}>
                {filtro}
              </Chip>
            ))}
          </div>

          {/* SECTION BAR — próximos torneos */}
          <div className="mb-5 flex items-center gap-4 rounded-r-sm border-l-4 border-brand-gold bg-section-subtle px-4 py-3">
            <span
              aria-hidden
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-sm bg-brand-gold text-[20px] text-black shadow-gold"
            >
              ⚡
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="mb-0.5 font-display text-[22px] font-black uppercase leading-none tracking-[0.02em] text-dark">
                Próximos torneos
              </h2>
              <p className="text-[13px] leading-tight text-muted-d">
                Los partidos que están a punto de arrancar
              </p>
            </div>
            <span className="flex-shrink-0 rounded-full bg-brand-gold px-3.5 py-1 font-display text-[15px] font-extrabold text-black">
              {cards.length} abierto{cards.length === 1 ? "" : "s"}
            </span>
          </div>

          {cards.length === 0 ? (
            <div className="mb-10 rounded-md border border-light bg-card px-6 py-12 text-center shadow-sm">
              <div aria-hidden className="mb-3 text-4xl">
                📅
              </div>
              <p className="text-sm font-semibold text-dark">
                No hay torneos abiertos ahora mismo
              </p>
              <p className="mt-1 text-[13px] text-muted-d">
                Los administradores importan partidos de api-football y crean
                los torneos desde <code>/admin</code>.
              </p>
            </div>
          ) : (
            <div className="mb-10 flex flex-col gap-3.5">
              {cards.map((torneo) => (
                <MatchCard key={torneo.id} torneo={torneo} />
              ))}
            </div>
          )}

          {/* SECTION BAR — finalizados */}
          <div className="mb-4 flex items-center gap-4 rounded-r-sm border-l-4 border-brand-green bg-section-finalized px-4 py-3">
            <span
              aria-hidden
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-sm bg-brand-green text-[20px] text-black shadow-green-glow"
            >
              🏆
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="mb-0.5 font-display text-[22px] font-black uppercase leading-none tracking-[0.02em] text-dark">
                Ya ganaron hoy
              </h2>
              <p className="text-[13px] leading-tight text-muted-d">
                Resultados de los torneos que cerraron hoy
              </p>
            </div>
          </div>

          {finalizados.length === 0 ? (
            <div className="rounded-md border border-light bg-card px-6 py-10 text-center shadow-sm">
              <div aria-hidden className="mb-3 text-4xl">
                🕓
              </div>
              <p className="text-sm font-semibold text-dark">
                Aún no hay resultados hoy
              </p>
              <p className="mt-1 text-[13px] text-muted-d">
                Los torneos que cierren durante el día aparecerán aquí.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-light overflow-hidden rounded-md border border-light bg-card shadow-sm">
              {finalizados.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-subtle"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
                      {t.partido.liga}
                    </div>
                    <div className="truncate font-display text-[16px] font-extrabold uppercase text-dark">
                      {t.partido.equipoLocal} vs {t.partido.equipoVisita}
                    </div>
                  </div>
                  <div className="flex-shrink-0 rounded-sm bg-brand-gold-dim px-3 py-1.5 font-display text-[14px] font-black text-brand-gold-dark">
                    {t.pozoNeto.toLocaleString("es-PE")} 🪙
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* STICKY SIDEBAR */}
        <div className="lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-108px)] lg:self-start lg:overflow-y-auto">
          <MatchesSidebar />
        </div>
      </div>
    </div>
  );
}
