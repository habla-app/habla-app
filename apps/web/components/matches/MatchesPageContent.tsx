// Contenido compartido entre `/` y `/matches`. Server Component async.
//
// Fase 3 — filtros funcionales:
//   - ?liga=<slug> → filtra por Partido.liga usando el mapper de
//     liga-slugs.ts.
//   - ?dia=YYYY-MM-DD (en hora Perú) → filtra por Partido.fechaInicio
//     dentro del rango UTC correspondiente. Si falta, aplica "hoy" por
//     default en memoria (no redirige; la URL queda limpia).
//
// El bloque de chips (LeagueFilterChips / DayFilterChips) es client
// component; consume la URL con useMatchesFilters. El server hace el
// fetch real y pinta la lista — la navegación por chips disparará
// re-render server cuando Next.js re-matchee con los nuevos params.

import Link from "next/link";
import { listar } from "@/lib/services/torneos.service";
import { MatchCard } from "@/components/matches/MatchCard";
import { torneoToCardData } from "@/components/matches/adapter";
import { MatchesSidebar } from "@/components/matches/MatchesSidebar";
import { LeagueFilterChips } from "@/components/matches/LeagueFilterChips";
import { DayFilterChips } from "@/components/matches/DayFilterChips";
import { EmptyFilteredState } from "@/components/matches/EmptyFilteredState";
import { slugToLiga } from "@/lib/config/liga-slugs";
import { DEFAULT_TZ, getDayBounds, getDayKey } from "@/lib/utils/datetime";

interface Props {
  /** ?liga=<slug> — slug de la URL, se traduce a Partido.liga. */
  ligaSlug?: string;
  /** ?dia=YYYY-MM-DD (hora Perú). */
  dia?: string;
}

const DIAS_LOOKAHEAD = 7;

export async function MatchesPageContent({ ligaSlug, dia }: Props = {}) {
  const liga = slugToLiga(ligaSlug ?? null) ?? undefined;

  // Default day = hoy en Perú cuando no llega ?dia= en la URL. No
  // redirigimos — el chip "Hoy" se marca activo igual y la URL queda
  // sin parámetro.
  const now = new Date();
  const todayKey = getDayKey(now, DEFAULT_TZ);
  const activeDia = dia ?? todayKey;
  const { desde, hasta } = getDayBounds(activeDia, DEFAULT_TZ);

  // Fetch principal: torneos abiertos del día filtrado (+liga si aplica).
  const { torneos } = await listar({
    estado: "ABIERTO",
    liga,
    desde,
    hasta,
    limit: 50,
  });

  const cards = torneos
    .filter((t) => t.cierreAt.getTime() > now.getTime())
    .map(torneoToCardData);

  // Fetch auxiliar para contadores de chips de día: misma liga pero
  // ventana amplia hoy → hoy+7d. No filtra por día. Se usa solo para
  // el count en cada chip; la lista real está arriba.
  const { desde: countDesde } = getDayBounds(todayKey, DEFAULT_TZ);
  const countHasta = new Date(
    countDesde.getTime() + DIAS_LOOKAHEAD * 86_400_000 - 1,
  );
  const { torneos: torneosVentana } = await listar({
    estado: "ABIERTO",
    liga,
    desde: countDesde,
    hasta: countHasta,
    limit: 200,
  });
  const dayCounts: Record<string, number> = {};
  for (const t of torneosVentana) {
    const key = getDayKey(t.partido.fechaInicio, DEFAULT_TZ);
    dayCounts[key] = (dayCounts[key] ?? 0) + 1;
  }

  const { torneos: finalizados } = await listar({
    estado: "FINALIZADO",
    limit: 10,
  });

  const filtrosActivos = Boolean(liga || dia);

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

          {/* FILTROS — liga + día */}
          <div className="mb-4 flex flex-col gap-2.5">
            <LeagueFilterChips />
            <DayFilterChips dayCounts={dayCounts} />
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
            filtrosActivos ? (
              <EmptyFilteredState ligaSlug={ligaSlug} dia={dia} />
            ) : (
              <div className="mb-10 rounded-md border border-light bg-card px-6 py-12 text-center shadow-sm">
                <div aria-hidden className="mb-3 text-4xl">
                  📅
                </div>
                <p className="text-sm font-semibold text-dark">
                  No hay torneos abiertos ahora mismo
                </p>
                <p className="mt-1 text-[13px] text-muted-d">
                  El auto-import trae partidos nuevos cada 6h desde
                  api-football. Pasa de nuevo en un rato.
                </p>
              </div>
            )
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
