// /comunidad/mes/[mes] — leaderboard cerrado mobile-first (Lote C v3.1,
// refactor del Lote 5). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/comunidad-mes.spec.md.
//
// Cambios vs Lote 5:
//   - Refactor visual mobile-first siguiendo el mismo patrón que /comunidad
//     (mes en curso) — hero gradient + stats + leaderboard mensual table
//     mobile-first.
//   - Tono "histórico" con emoji 🏁 y copy "Mes cerrado el…".
//   - Cero `<MisStatsMini>` (no aplica a histórico).
//   - Sin tabla de premios al pie (el monto del 1° aparece dentro del hero).

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { obtenerLeaderboardCerrado } from "@/lib/services/leaderboard.service";
import { LeaderboardMensualTable } from "@/components/comunidad/LeaderboardMensualTable";

export const dynamic = "force-dynamic";

interface Props {
  params: { mes: string };
}

export async function generateMetadata({ params }: Props) {
  return {
    title: `Comunidad · ${params.mes} · Habla!`,
    description: `Leaderboard cerrado del mes ${params.mes} en Habla!`,
  };
}

export default async function ComunidadMesCerradoPage({ params }: Props) {
  if (!/^\d{4}-\d{2}$/.test(params.mes)) {
    notFound();
  }

  const session = await auth();
  const usuarioIdActual = session?.user?.id ?? undefined;

  const vista = await obtenerLeaderboardCerrado({
    mes: params.mes,
    usuarioIdActual,
  });
  if (!vista) notFound();

  const nombreMesCap = capitalize(vista.nombreMes);
  const cerradoEnStr = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(vista.cerradoEn);

  return (
    <div className="space-y-2 pb-16">
      {/* Breadcrumb mobile-friendly */}
      <div className="bg-card px-4 pt-3">
        <Link
          href="/comunidad"
          className="text-label-md font-bold text-brand-blue-main hover:underline"
        >
          ← Comunidad
        </Link>
      </div>

      <Hero
        nombreMes={nombreMesCap}
        cerradoEnStr={cerradoEnStr}
        totalUsuarios={vista.totalUsuarios}
        ganadorPuntos={vista.filas[0]?.puntos ?? null}
      />

      {vista.miFila ? (
        <section className="mx-4 rounded-md border border-brand-blue-main bg-gradient-to-r from-brand-blue-main/[0.08] to-card p-3.5 shadow-sm">
          <p className="text-label-md font-bold uppercase tracking-[0.06em] text-brand-blue-main">
            Tu posición · {vista.nombreMes}
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-display text-display-md font-black leading-none text-dark">
              #{vista.miFila.posicion}
              <span className="ml-1 align-middle text-body-sm font-bold text-muted-d">
                de {vista.totalUsuarios}
              </span>
            </span>
            <span className="font-display text-display-sm font-extrabold text-brand-gold-dark">
              {vista.miFila.puntos} pts
            </span>
            {vista.miFila.posicion <= 10 ? (
              <span className="rounded-full bg-brand-gold px-2.5 py-1 text-label-md font-bold text-brand-blue-dark">
                🏆 Top 10
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="bg-card px-4 py-4">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark">
            <span aria-hidden>🏆</span>
            Top 100 · {nombreMesCap}
          </h2>
          <span className="text-label-sm uppercase tracking-[0.06em] text-muted-d">
            Read-only
          </span>
        </header>
        <LeaderboardMensualTable
          filas={vista.filas}
          miUserId={usuarioIdActual ?? null}
          mostrarPremios
        />
      </section>
    </div>
  );
}

function Hero({
  nombreMes,
  cerradoEnStr,
  totalUsuarios,
  ganadorPuntos,
}: {
  nombreMes: string;
  cerradoEnStr: string;
  totalUsuarios: number;
  ganadorPuntos: number | null;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-admin-sidebar-bg via-brand-blue-mid to-brand-blue-dark px-4 py-5 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold-soft-glow"
      />
      <div className="relative">
        <p className="text-label-md font-bold uppercase tracking-[0.08em] text-white/70">
          Mes cerrado · Liga Habla!
        </p>
        <h1 className="mt-1 font-display text-display-md font-black uppercase leading-none">
          {nombreMes}
        </h1>
        <p className="mt-2 text-body-sm text-white/75">
          Cerrado el{" "}
          <strong className="text-brand-gold-light">{cerradoEnStr}</strong>.
          Estos puntos son finales y los premios al Top 10 se coordinan por
          email.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <HeroStat
            value={totalUsuarios.toLocaleString("es-PE")}
            label="Tipsters"
          />
          <HeroStat
            value={ganadorPuntos !== null ? `${ganadorPuntos} pts` : "—"}
            label="Puntaje del 1°"
            accent
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
          ? "rounded-md border border-brand-gold bg-brand-gold/[0.12] px-3 py-2.5 text-center"
          : "rounded-md border border-white/15 bg-white/[0.06] px-3 py-2.5 text-center"
      }
    >
      <div
        className={`font-display text-[20px] font-extrabold leading-none ${
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
