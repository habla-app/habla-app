// /liga — Lote M v3.2 (May 2026).
// Spec: docs/habla-mockup-v3.2.html § page-liga-list.
//
// La vista central del Producto C (La Liga Habla!). Reescritura del Lote
// C con la estructura del mockup v3.2:
//
//   1. Hero Liga (mes en curso + countdown + 3 stats + CTA primario)
//   2. PremiosMensualesCard (1°-10° con S/ por puesto)
//   3. Top 10 + sección "Top 100 colapsable"
//   4. Sección "Próximos partidos elegibles" (Filtro 2 + regla 7d)
//   5. Sección "En vivo ahora"
//   6. Sección "Terminados últimos 7 días"
//
// Las 3 secciones de partidos consumen `obtenerListaLiga()` con
// `usuarioId` para personalizar el estado de "Mi combinada" por fila.

import { auth } from "@/lib/auth";
import {
  PREMIO_PRIMER_PUESTO,
  TOTAL_PREMIO_MENSUAL,
  obtenerLeaderboardMesActual,
} from "@/lib/services/leaderboard.service";
import { obtenerListaLiga } from "@/lib/services/liga.service";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { LeaderboardMensualTable } from "@/components/comunidad/LeaderboardMensualTable";
import { PremiosMensualesCard } from "@/components/comunidad/PremiosMensualesCard";
import { MisStatsMini } from "@/components/comunidad/MisStatsMini";
import { LigaSeccion } from "@/components/liga/LigaSeccion";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "La Liga Habla! · Compite por S/ 1,250 al mes · Habla!",
  description:
    "Predicí gratis por cada partido elegible. Editá tu combinada hasta el kickoff. El Top 10 del mes cobra en efectivo por Yape.",
};

export default async function LigaPage() {
  const session = await auth();
  const usuarioIdActual = session?.user?.id ?? undefined;

  const [vista, listaLiga] = await Promise.all([
    obtenerLeaderboardMesActual({ usuarioIdActual }),
    obtenerListaLiga(usuarioIdActual),
  ]);

  const nombreMesCap = capitalize(vista.nombreMes);
  const top10 = vista.filas.slice(0, 10);
  const top100 = vista.filas.slice(0, 100);

  return (
    <div className="space-y-3 pb-20">
      <TrackOnMount
        event="liga_lista_vista"
        props={{
          mes: vista.mes,
          totalUsuarios: vista.totalUsuarios,
          proximos: listaLiga.proximos.length,
          enVivo: listaLiga.enVivo.length,
          terminados: listaLiga.terminados.length,
        }}
      />

      <Hero nombreMes={nombreMesCap} totalUsuarios={vista.totalUsuarios} />

      <div className="mx-auto w-full max-w-[1200px] space-y-3 md:px-6">
        <PremiosMensualesCard />

        {session?.user ? (
          <MisStatsMini
            miPuntos={vista.miFila?.puntos ?? null}
            miPosicion={vista.miFila?.posicion ?? null}
            totalUsuarios={vista.totalUsuarios}
          />
        ) : null}

        {/* Sección 1 — Próximos partidos elegibles */}
        <LigaSeccion
          titulo={`🔜 Próximos partidos`}
          subtitulo="Editá hasta el kickoff. Una combinada por jugador por partido."
          partidos={listaLiga.proximos}
          variante="proximo"
          vacio="No hay partidos elegibles próximos. El admin va eligiendo de los próximos 7 días."
        />

        {/* Sección 2 — En vivo ahora */}
        <LigaSeccion
          titulo="En vivo ahora"
          subtitulo={
            listaLiga.enVivo.length > 0
              ? `${listaLiga.enVivo.length} partido${listaLiga.enVivo.length === 1 ? "" : "s"} en curso · ranking en tiempo real`
              : undefined
          }
          partidos={listaLiga.enVivo}
          variante="vivo"
          vacio={undefined}
        />

        {/* Sección 3 — Terminados últimos 7 días */}
        <LigaSeccion
          titulo={`✓ Terminados · últimos 7 días`}
          partidos={listaLiga.terminados}
          variante="terminado"
          vacio={undefined}
        />

        {/* Top 10 del mes */}
        <section className="bg-card px-4 py-4 md:rounded-md md:border md:border-light md:shadow-sm">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark md:text-display-sm">
              <span aria-hidden>🏅</span>
              Top 10 · {nombreMesCap}
            </h2>
            <span className="text-label-sm uppercase tracking-[0.06em] text-muted-d">
              Cobran en efectivo
            </span>
          </header>
          <LeaderboardMensualTable
            filas={top10}
            miUserId={usuarioIdActual ?? null}
            mostrarPremios
          />
        </section>

        {/* Top 100 */}
        {top100.length > 10 ? (
          <section className="bg-card px-4 py-4 md:rounded-md md:border md:border-light md:shadow-sm">
            <header className="mb-3 flex items-baseline justify-between">
              <h2 className="flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark md:text-display-sm">
                <span aria-hidden>🏆</span>
                Top 100
              </h2>
              <span className="text-label-sm uppercase tracking-[0.06em] text-muted-d">
                Cierre 1° del mes
              </span>
            </header>
            <LeaderboardMensualTable
              filas={top100}
              miUserId={usuarioIdActual ?? null}
              mostrarPremios={false}
            />
          </section>
        ) : null}
      </div>

      <p className="mx-auto max-w-[1200px] px-4 pt-4 text-center text-body-xs text-muted-d md:px-6">
        🎲 Apostar es entretenimiento, no una fuente de ingresos. Si sentís que
        perdiste el control, contactá la Línea Tugar al{" "}
        <a href="tel:0800-19009" className="underline hover:text-brand-blue-main">
          0800-19009
        </a>.
      </p>
    </div>
  );
}

function Hero({
  nombreMes,
  totalUsuarios,
}: {
  nombreMes: string;
  totalUsuarios: number;
}) {
  const ahora = new Date();
  const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  const diasAlCierre = Math.max(
    0,
    Math.ceil((finMes.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)),
  );
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-blue-mid via-brand-blue-main to-brand-blue-dark px-4 py-6 text-white md:py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold-soft-glow"
      />
      <div className="relative mx-auto max-w-[1200px] md:px-6">
        <p className="text-label-md font-bold uppercase tracking-[0.08em] text-white/70">
          🏆 Liga Habla! · {nombreMes}
        </p>
        <h1 className="mt-1 font-display text-[36px] font-black uppercase leading-none md:text-[48px]">
          Compite gratis<br className="md:hidden" /> por S/ 1,250
        </h1>
        <p className="mt-3 max-w-[640px] text-body-sm text-white/80 md:text-body-md">
          Armá tu combinada de 5 predicciones por cada partido elegible.
          Editala cuantas veces quieras hasta el kickoff. El Top 10 del mes
          cobra en efectivo por Yape.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2 md:max-w-[520px]">
          <HeroStat
            value={totalUsuarios.toLocaleString("es-PE")}
            label="Tipsters"
          />
          <HeroStat value={`S/ ${PREMIO_PRIMER_PUESTO}`} label="1° lugar" accent />
          <HeroStat value={`${diasAlCierre} días`} label="Al cierre" />
        </div>

        <p className="mt-4 text-body-xs text-white/60">
          Total Top 10: S/ {TOTAL_PREMIO_MENSUAL.toLocaleString("es-PE")} ·
          Cierre 1° del mes que viene.
        </p>
      </div>
    </section>
  );
}

function HeroStat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "rounded-md border border-brand-gold bg-brand-gold/[0.12] px-2.5 py-2.5 text-center"
          : "rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-2.5 text-center"
      }
    >
      <div
        className={`font-display text-[18px] font-extrabold leading-none md:text-[22px] ${
          accent ? "text-brand-gold-light" : "text-white"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-label-sm font-bold uppercase tracking-[0.04em] text-white/70">
        {label}
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
