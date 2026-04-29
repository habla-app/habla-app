// /comunidad — leaderboard mensual con premios en efectivo (Lote 5).
//
// Reemplaza al placeholder "Próximamente" del Lote 3. Muestra:
//   - Hero con el mes en curso, total de tipsters y premio del 1° lugar.
//   - Tabla Top 100 (server-rendered; los puntos están congelados al FT
//     del torneo, no necesita updates en vivo).
//   - "Mi posición" destacada cuando el usuario está logueado.
//   - Tarjeta del Top 10 con premios visibles (corte tras puesto 10).
//   - Link al footer con meses cerrados.
//
// La feature de comentarios y suscripción a categorías que mencionaba el
// Lote 7 sigue por construirse — quedará en otra ruta o como sección
// adicional acá. Por ahora "Comunidad" = competencia mensual.

import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  listarLeaderboardsCerrados,
  obtenerLeaderboardMesActual,
  PREMIO_PRIMER_PUESTO,
  TABLA_PREMIOS_MENSUAL,
  TOTAL_PREMIO_MENSUAL,
} from "@/lib/services/leaderboard.service";
import { LeaderboardMensualTable } from "@/components/comunidad/LeaderboardMensualTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Comunidad · Habla!",
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

  const nombreMesCapitalizado = capitalize(vista.nombreMes);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-6 md:px-6 md:pt-8">
      {/* HERO */}
      <section className="relative mb-6 overflow-hidden rounded-md border border-strong bg-gradient-to-br from-dark to-[#000530] px-5 py-7 text-white shadow-md md:px-8 md:py-10">
        <div className="absolute right-[-30px] top-[-30px] text-[180px] leading-none opacity-[0.07]">
          🏆
        </div>
        <div className="relative">
          <div className="font-display text-[12px] font-bold uppercase tracking-[0.08em] text-white/70">
            Leaderboard mensual · Habla!
          </div>
          <h1 className="mt-1 font-display text-[36px] font-black uppercase leading-none tracking-[0.01em] text-white md:text-[52px]">
            {nombreMesCapitalizado}
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-white/80 md:text-[15px]">
            Predicí gratis. Acumulá puntos en cada torneo finalizado del mes.
            El día 1° del mes siguiente cerramos el ranking y el Top 10 gana{" "}
            <strong className="text-brand-gold-light">en efectivo</strong>.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            <HeroStat
              icon="👥"
              value={vista.totalUsuarios.toLocaleString("es-PE")}
              label="Tipsters compitiendo"
            />
            <HeroStat
              icon="🥇"
              value={`S/ ${PREMIO_PRIMER_PUESTO}`}
              label="Premio 1° lugar"
              accent
            />
            <HeroStat
              icon="💰"
              value={`S/ ${TOTAL_PREMIO_MENSUAL.toLocaleString("es-PE")}`}
              label="Total al Top 10"
              className="col-span-2 md:col-span-1"
            />
          </div>
        </div>
      </section>

      {/* MI POSICIÓN — sólo logueado y con tickets del mes */}
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
                🏆 En zona de premio
              </div>
            ) : (
              <div className="text-[13px] text-muted-d">
                Te faltan{" "}
                <strong className="text-dark">
                  {puntosParaTopDiez(vista.filas, vista.miFila.puntos)} pts
                </strong>{" "}
                para entrar al Top 10
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* SECCIÓN PRINCIPAL — tabla del leaderboard */}
      <section className="mb-6">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-[20px] font-black uppercase tracking-[0.02em] text-dark md:text-[24px]">
            Top 100 · {nombreMesCapitalizado}
          </h2>
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
            Mes en curso · cierre el 1° del mes siguiente
          </span>
        </header>
        <LeaderboardMensualTable
          filas={vista.filas}
          miUserId={usuarioIdActual ?? null}
          mostrarPremios
        />
      </section>

      {/* TARJETA REPARTO DE PREMIOS */}
      <section className="mb-6 rounded-md border border-light bg-card p-5 shadow-sm">
        <h3 className="mb-3 font-display text-[16px] font-black uppercase tracking-[0.04em] text-dark">
          💰 Reparto del Top 10
        </h3>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {TABLA_PREMIOS_MENSUAL.map((p) => (
            <div
              key={p.posicion}
              className={`rounded-md border px-3 py-2.5 text-center ${
                p.posicion === 1
                  ? "border-brand-gold bg-gradient-to-br from-brand-gold/[0.15] to-white"
                  : p.posicion <= 3
                    ? "border-light bg-subtle"
                    : "border-light bg-card"
              }`}
            >
              <div className="font-display text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
                {p.posicion}° puesto
              </div>
              <div className="mt-1 font-display text-[18px] font-black leading-none text-brand-gold-dark md:text-[20px]">
                S/ {p.montoSoles}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-d">
          Total mensual: <strong>S/ {TOTAL_PREMIO_MENSUAL.toLocaleString("es-PE")}</strong>.
          El pago se coordina por email dentro de los 3 días hábiles
          posteriores al cierre del mes.
        </p>
      </section>

      {/* MESES CERRADOS */}
      {cerrados.length > 0 ? (
        <section className="mb-6 rounded-md border border-light bg-card p-5 shadow-sm">
          <h3 className="mb-3 font-display text-[16px] font-black uppercase tracking-[0.04em] text-dark">
            📜 Meses cerrados
          </h3>
          <ul className="divide-y divide-light">
            {cerrados.map((c) => (
              <li
                key={c.mes}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <div className="font-display text-[14px] font-extrabold uppercase tracking-[0.02em] text-dark">
                    {capitalize(c.nombreMes)}
                  </div>
                  <div className="text-[12px] text-muted-d">
                    {c.totalUsuarios.toLocaleString("es-PE")} tipsters · cerrado el{" "}
                    {c.cerradoEn.toLocaleDateString("es-PE", {
                      timeZone: "America/Lima",
                      day: "2-digit",
                      month: "short",
                    })}
                  </div>
                </div>
                <Link
                  href={`/comunidad/mes/${c.mes}`}
                  className="text-[13px] font-bold text-brand-blue-main hover:underline"
                >
                  Ver leaderboard →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!session?.user ? (
        <section className="rounded-md border-[1.5px] border-brand-gold bg-gradient-to-br from-brand-gold/[0.12] to-white p-5 text-center shadow-sm">
          <p className="font-display text-[16px] font-black uppercase tracking-[0.02em] text-dark">
            ¿Querés competir?
          </p>
          <p className="mt-1 text-[13px] text-muted-d">
            Crea tu cuenta gratis y empezá a sumar puntos en cada partido.
          </p>
          <Link
            href="/auth/signin?callbackUrl=/matches"
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-3 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:bg-brand-gold-light"
          >
            Crear cuenta gratis
          </Link>
        </section>
      ) : (
        <section className="rounded-md border border-light bg-card p-5 text-center shadow-sm">
          <Link
            href="/matches"
            className="inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-strong bg-transparent px-5 py-3 text-[14px] font-bold text-body transition-colors hover:border-brand-blue-main hover:text-brand-blue-main"
          >
            Ver partidos para predecir →
          </Link>
        </section>
      )}
    </div>
  );
}

function HeroStat({
  icon,
  value,
  label,
  accent,
  className,
}: {
  icon: string;
  value: string;
  label: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border px-3 py-3 ${
        accent
          ? "border-brand-gold bg-brand-gold/[0.12]"
          : "border-white/15 bg-white/[0.06]"
      } ${className ?? ""}`}
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

function puntosParaTopDiez(
  filas: ReadonlyArray<{ posicion: number; puntos: number }>,
  miPuntos: number,
): number {
  const corte = filas.find((f) => f.posicion === 10);
  if (!corte) return 0;
  return Math.max(0, corte.puntos - miPuntos + 1);
}
