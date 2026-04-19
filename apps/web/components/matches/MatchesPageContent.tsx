// Contenido compartido entre `/` y `/matches`. Server Component async.
//
// Fase 3 — filtros funcionales:
//   - ?liga=<slug> → filtra por Partido.liga usando el mapper de
//     liga-slugs.ts.
//   - ?dia=YYYY-MM-DD (hora Perú) → filtra por Partido.fechaInicio
//     dentro del rango UTC correspondiente.
//
// Default (sin ?dia=): se muestran TODOS los torneos abiertos en orden
// `partido.fechaInicio ASC`. Permite que un usuario que entra por
// primera vez siempre vea partidos disponibles aunque no haya nada
// programado para hoy en particular. El chip "Todos" queda activo.
//
// El bloque de chips (LeagueFilterChips / DayFilterChips) es client
// component; consume la URL con useMatchesFilters. El server hace el
// fetch real y pinta la lista — la navegación por chips dispara
// re-render server cuando Next.js re-matchee con los nuevos params.

import { auth } from "@/lib/auth";
import { listar } from "@/lib/services/torneos.service";
import { MatchCard } from "@/components/matches/MatchCard";
import { torneoToCardData } from "@/components/matches/adapter";
import { MatchesSidebar } from "@/components/matches/MatchesSidebar";
import { LeagueFilterChips } from "@/components/matches/LeagueFilterChips";
import { DayFilterChips } from "@/components/matches/DayFilterChips";
import { EmptyFilteredState } from "@/components/matches/EmptyFilteredState";
import { AutoOpenComboFromQuery } from "@/components/combo/AutoOpenComboFromQuery";
import { slugToLiga } from "@/lib/config/liga-slugs";
import { DEFAULT_TZ, getDayBounds, getDayKey } from "@/lib/utils/datetime";
import { buildMatchesPageTitle } from "@/lib/utils/matches-page-title";

interface Props {
  /** ?liga=<slug> — slug de la URL, se traduce a Partido.liga. */
  ligaSlug?: string;
  /** ?dia=YYYY-MM-DD (hora Perú). null/undefined → "Todos". */
  dia?: string;
  /** Path base de la página (`/` o `/matches`). Usado para armar el
   *  callbackUrl del CTA sin sesión — post-login el usuario vuelve al
   *  mismo path con `?openCombo=<torneoId>` y el modal se auto-abre. */
  basePath?: string;
}

export async function MatchesPageContent({
  ligaSlug,
  dia,
  basePath = "/matches",
}: Props = {}) {
  const session = await auth();
  const hasSession = !!session?.user;
  const liga = slugToLiga(ligaSlug ?? null) ?? undefined;

  // Fetch de la ventana completa (estado=ABIERTO, limit grande). Sirve
  // como lista principal cuando no hay filtro de día y como fuente de
  // counts para los chips siempre.
  const { torneos: torneosVentana } = await listar({
    estado: "ABIERTO",
    liga,
    limit: 200,
  });

  // Lista principal — depende del filtro de día:
  //   - sin ?dia=: todos los torneos de la ventana (ordenados por
  //     fechaInicio ASC por el backend).
  //   - con ?dia=: fetch filtrado por rango UTC del día local.
  let torneosLista = torneosVentana;
  if (dia) {
    const { desde, hasta } = getDayBounds(dia, DEFAULT_TZ);
    const res = await listar({
      estado: "ABIERTO",
      liga,
      desde,
      hasta,
      limit: 50,
    });
    torneosLista = res.torneos;
  }

  const now = new Date();
  const cards = torneosLista
    .filter((t) => t.cierreAt.getTime() > now.getTime())
    .map(torneoToCardData);

  // Counts por día para DayFilterChips. Siempre derivados de la
  // ventana (sin filtro de día). Respetan el filtro de liga.
  const dayCounts: Record<string, number> = {};
  for (const t of torneosVentana) {
    const key = getDayKey(t.partido.fechaInicio, DEFAULT_TZ);
    dayCounts[key] = (dayCounts[key] ?? 0) + 1;
  }
  const totalCount = torneosVentana.length;

  const { torneos: finalizados } = await listar({
    estado: "FINALIZADO",
    limit: 10,
  });

  // Bug #15: el h1 antes decía literal "Partidos de hoy" siempre. Ahora
  // lo derivamos de los filtros activos (liga + día) vía helper puro.
  const { title: pageTitle } = buildMatchesPageTitle({
    liga: ligaSlug ?? null,
    dia: dia ?? null,
  });

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 md:px-6 md:pt-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <header className="mb-5">
            <h1
              className="font-display text-[40px] font-black uppercase leading-none tracking-[0.01em] text-dark"
              data-testid="matches-page-title"
            >
              {pageTitle}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-d">
              Inscríbete al torneo, arma tu combinada de 5 predicciones y
              compite por el pozo.
            </p>
          </header>

          {/* FILTROS — liga + día */}
          <div className="mb-4 flex flex-col gap-2.5">
            <LeagueFilterChips />
            <DayFilterChips dayCounts={dayCounts} totalCount={totalCount} />
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
            <EmptyFilteredState ligaSlug={ligaSlug} dia={dia} />
          ) : (
            <div className="mb-10 flex flex-col gap-3.5">
              {cards.map((torneo) => {
                // callbackUrl preserva los filtros actuales (liga/dia) +
                // inyecta openCombo=<id> para el auto-disparo post-login.
                const qs = new URLSearchParams();
                if (ligaSlug) qs.set("liga", ligaSlug);
                if (dia) qs.set("dia", dia);
                qs.set("openCombo", torneo.id);
                const ctaCallbackUrl = `${basePath}?${qs.toString()}`;
                return (
                  <MatchCard
                    key={torneo.id}
                    torneo={torneo}
                    hasSession={hasSession}
                    ctaCallbackUrl={ctaCallbackUrl}
                  />
                );
              })}
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

      {/* Post-login auto-open: si venimos con ?openCombo=<id>, abre el
          ComboModal sin que el usuario tenga que volver a clickear. */}
      <AutoOpenComboFromQuery hasSession={hasSession} />
    </div>
  );
}
