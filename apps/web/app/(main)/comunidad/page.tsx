// /comunidad — leaderboard mensual mobile-first (Lote C v3.1, refactor del
// Lote 5/11). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/comunidad.spec.md.
//
// Estructura:
//   1. Hero gradient navy → blue (mes en curso, premio 1°, total tipsters)
//   2. PremiosMensualesCard (1°-10° con S/ por puesto)
//   3. MisStatsMini (3 stats personales + CTA, oculto si no auth)
//   4. Top 10 con podio destacado (LeaderboardMensualTable, slice 0-10)
//   5. Top 100 colapsable (LeaderboardMensualTable, slice 0-100)
//   6. MesesCerradosLink (últimos 6)
//
// La tabla usa `LeaderboardMensualTable` mobile-first refactorada en Lote
// C — cada fila es card stacked en lugar de tabla densa.

import { auth } from "@/lib/auth";
import {
  PREMIO_PRIMER_PUESTO,
  TOTAL_PREMIO_MENSUAL,
  listarLeaderboardsCerrados,
  obtenerLeaderboardMesActual,
} from "@/lib/services/leaderboard.service";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { LeaderboardMensualTable } from "@/components/comunidad/LeaderboardMensualTable";
import { PremiosMensualesCard } from "@/components/comunidad/PremiosMensualesCard";
import { MisStatsMini } from "@/components/comunidad/MisStatsMini";
import { MesesCerradosLink } from "@/components/comunidad/MesesCerradosLink";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Liga Habla! · Comunidad · Habla!",
  description:
    "Leaderboard mensual de Habla! · Top 100 tipsters · Premios en efectivo para el Top 10.",
};

export default async function ComunidadPage() {
  const session = await auth();
  const usuarioIdActual = session?.user?.id ?? undefined;

  const [vista, cerrados] = await Promise.all([
    obtenerLeaderboardMesActual({ usuarioIdActual }),
    listarLeaderboardsCerrados(),
  ]);

  const nombreMesCap = capitalize(vista.nombreMes);
  const top10 = vista.filas.slice(0, 10);
  const top100 = vista.filas.slice(0, 100);

  return (
    <div className="space-y-2 pb-16">
      <TrackOnMount
        event="comunidad_leaderboard_visto"
        props={{ mes: vista.mes, totalUsuarios: vista.totalUsuarios }}
      />

      <Hero
        nombreMes={nombreMesCap}
        totalUsuarios={vista.totalUsuarios}
      />

      <PremiosMensualesCard />

      {session?.user ? (
        <MisStatsMini
          miPuntos={vista.miFila?.puntos ?? null}
          miPosicion={vista.miFila?.posicion ?? null}
          totalUsuarios={vista.totalUsuarios}
        />
      ) : null}

      <section className="bg-card px-4 py-4">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark">
            <span aria-hidden>🏅</span>
            Top 10 · {nombreMesCap}
          </h2>
        </header>
        <LeaderboardMensualTable
          filas={top10}
          miUserId={usuarioIdActual ?? null}
          mostrarPremios
        />
      </section>

      {top100.length > 10 ? (
        <section className="bg-card px-4 py-4">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark">
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

      <MesesCerradosLink
        meses={cerrados.slice(0, 6).map((c) => ({
          mes: c.mes,
          nombreMes: c.nombreMes,
          cerradoEn: c.cerradoEn,
          totalUsuarios: c.totalUsuarios,
        }))}
      />
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
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-blue-mid via-brand-blue-main to-brand-blue-dark px-4 py-5 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold-soft-glow"
      />
      <div className="relative">
        <p className="text-label-md font-bold uppercase tracking-[0.08em] text-white/70">
          Liga Habla! · Mes en curso
        </p>
        <h1 className="mt-1 font-display text-[40px] font-black uppercase leading-none">
          {nombreMes}
        </h1>
        <p className="mt-2 max-w-md text-body-sm text-white/75">
          Predicí gratis. El día 1° del mes que viene cerramos el ranking y el{" "}
          <strong className="text-brand-gold-light">Top 10 cobra en efectivo</strong>.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <HeroStat
            value={totalUsuarios.toLocaleString("es-PE")}
            label="Tipsters"
          />
          <HeroStat
            value={`S/ ${PREMIO_PRIMER_PUESTO}`}
            label="1° lugar"
            accent
          />
          <HeroStat
            value={`S/ ${TOTAL_PREMIO_MENSUAL.toLocaleString("es-PE")}`}
            label="Total Top 10"
          />
        </div>
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
        className={`font-display text-[18px] font-extrabold leading-none ${
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
