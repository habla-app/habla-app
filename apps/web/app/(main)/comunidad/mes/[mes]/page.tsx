// /comunidad/mes/[mes] — leaderboard cerrado de un mes específico (Lote 5).
//
// Lee desde `Leaderboard.posiciones` (JSONB snapshot tomado al cierre).
// Mismo layout que el mes en curso, pero read-only y con nota "Mes
// cerrado el [fecha]". Si el mes pedido no existe o no está cerrado,
// devolvemos notFound() para que Next muestre el 404 estándar.

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
  // Validación mínima del param para no spamear la BD con paths tipo
  // /comunidad/mes/asdf. El service ya hace lookup por unique así que
  // no es estrictamente necesario, pero mejor cortar early.
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

  const nombreMesCapitalizado = capitalize(vista.nombreMes);
  const cerradoEnStr = vista.cerradoEn.toLocaleDateString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-6 md:px-6 md:pt-8">
      <div className="mb-3">
        <Link
          href="/comunidad"
          className="text-[12px] font-semibold text-brand-blue-main hover:underline"
        >
          ← Volver a Comunidad
        </Link>
      </div>

      {/* HERO — variante mes cerrado. Mismo patrón que /comunidad
          (replica `.balance-hero-v2` del mockup) pero con emoji 🏁. */}
      <section className="relative mb-6 overflow-hidden rounded-lg bg-gradient-to-br from-brand-blue-main to-brand-blue-dark px-5 py-7 text-white shadow-lg md:px-8 md:py-10">
        <span
          aria-hidden
          className="absolute left-0 right-0 top-0 block h-[5px] animate-shimmer bg-gold-shimmer bg-[length:400px_100%]"
        />
        <div className="pointer-events-none absolute right-[-30px] top-[-30px] -rotate-[15deg] select-none text-[220px] leading-none opacity-[0.06]">
          🏁
        </div>
        <div className="relative">
          <div className="font-display text-[12px] font-bold uppercase tracking-[0.08em] text-white/70">
            Mes cerrado · Habla!
          </div>
          <h1 className="mt-1 font-display text-[36px] font-black uppercase leading-none tracking-[0.01em] text-white md:text-[52px]">
            {nombreMesCapitalizado}
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-white/80 md:text-[15px]">
            Cerrado el <strong className="text-brand-gold-light">{cerradoEnStr}</strong>.
            Estos puntos son finales y los premios al Top 10 se coordinan
            por email.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 md:max-w-md">
            <HeroStat
              icon="👥"
              value={vista.totalUsuarios.toLocaleString("es-PE")}
              label="Tipsters"
            />
            <HeroStat
              icon="🥇"
              value={
                vista.filas[0]
                  ? `${vista.filas[0].puntos} pts`
                  : "—"
              }
              label="Puntaje del 1°"
              accent
            />
          </div>
        </div>
      </section>

      {/* MI POSICIÓN HISTÓRICA */}
      {vista.miFila ? (
        <section className="mb-5 rounded-md border-[1.5px] border-brand-blue-main bg-gradient-to-r from-brand-blue-main/[0.08] to-transparent p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-blue-main">
              Tu posición · {vista.nombreMes}
            </div>
            <div className="font-display text-[28px] font-black leading-none text-dark md:text-[36px]">
              #{vista.miFila.posicion}
              <span className="ml-1 align-middle text-[14px] font-bold text-muted-d md:text-[16px]">
                de {vista.totalUsuarios}
              </span>
            </div>
            <div className="font-display text-[20px] font-black text-brand-gold-dark md:text-[24px]">
              {vista.miFila.puntos} pts
            </div>
            {vista.miFila.posicion <= 10 ? (
              <div className="rounded-full bg-brand-gold px-3 py-1 font-display text-[12px] font-extrabold uppercase tracking-[0.04em] text-black">
                🏆 Top 10 — premio coordinado por email
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="mb-6">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-[20px] font-black uppercase tracking-[0.02em] text-dark md:text-[24px]">
            Top 100 · {nombreMesCapitalizado}
          </h2>
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
            Read-only · cerrado el {cerradoEnStr}
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

function HeroStat({
  icon,
  value,
  label,
  accent,
}: {
  icon: string;
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-3 py-3 ${
        accent
          ? "border-brand-gold bg-brand-gold/[0.12]"
          : "border-white/15 bg-white/[0.06]"
      }`}
    >
      <div className="flex items-baseline gap-2">
        <span aria-hidden className="text-[20px]">
          {icon}
        </span>
        <span
          className={`font-display text-[22px] font-black leading-none md:text-[26px] ${
            accent ? "text-brand-gold-light" : "text-white"
          }`}
        >
          {value}
        </span>
      </div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.06em] text-white/70">
        {label}
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
