// /admin/leaderboard — herramienta interna (Lote 5).
//
// Tabla de leaderboards cerrados ordenada desc por mes, con totales de
// premios pagados / pendientes. Sirve como índice de inspección antes de
// abrir /admin/premios-mensuales.
//
// El cierre del mes en curso se dispara desde acá (POST /api/v1/admin/
// leaderboard/cerrar) — útil para forzar manualmente un cierre antes de
// la fecha o para crear un dummy de inspección post-deploy.

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  listarLeaderboardsCerrados,
  obtenerLeaderboardMesActual,
} from "@/lib/services/leaderboard.service";
import { CerrarLeaderboardPanel } from "@/components/admin/CerrarLeaderboardPanel";

export const dynamic = "force-dynamic";

export default async function AdminLeaderboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin?callbackUrl=/admin/leaderboard");
  if (session.user.rol !== "ADMIN") redirect("/");

  const [vistaActual, cerrados] = await Promise.all([
    obtenerLeaderboardMesActual({}),
    listarLeaderboardsCerrados(),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-6 md:px-6 md:pt-8 lg:pt-10">
      <header className="mb-5">
        <h1 className="font-display text-[32px] font-black uppercase tracking-[0.02em] text-dark md:text-[40px]">
          🏆 Leaderboards mensuales
        </h1>
        <p className="mt-1 text-sm text-muted-d">
          Cada mes calendario forma un leaderboard. Cierre automático el día
          1 ≥01:00 PET; podés forzarlo manualmente desde acá.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-[12px] font-semibold text-brand-blue-main">
          <Link href="/admin" className="hover:underline">
            ← Volver a Admin
          </Link>
          <Link href="/admin/premios-mensuales" className="hover:underline">
            Ir a premios-mensuales →
          </Link>
        </div>
      </header>

      {/* MES EN CURSO */}
      <section className="mb-6 rounded-md border border-light bg-card p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[20px] font-black uppercase tracking-[0.02em] text-dark">
            Mes en curso · {capitalize(vistaActual.nombreMes)}
          </h2>
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
            Sin cerrar · {vistaActual.totalUsuarios} tipsters · {vistaActual.mes}
          </span>
        </div>
        <p className="text-[13px] text-muted-d">
          Top 1 actual:{" "}
          {vistaActual.filas[0] ? (
            <strong className="text-dark">
              @{vistaActual.filas[0].username} · {vistaActual.filas[0].puntos} pts
            </strong>
          ) : (
            <em>sin actividad aún</em>
          )}
        </p>

        <CerrarLeaderboardPanel mesActual={vistaActual.mes} />
      </section>

      {/* MESES CERRADOS */}
      <section className="rounded-md border border-light bg-card p-5 shadow-sm">
        <h2 className="mb-3 font-display text-[20px] font-black uppercase tracking-[0.02em] text-dark">
          Meses cerrados
        </h2>
        {cerrados.length === 0 ? (
          <p className="text-[13px] text-muted-d">
            Todavía no hay meses cerrados. El cron mensual cerrará el primer
            mes el día 1 a las 01:00 PET (o usá el panel de arriba para
            forzarlo).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-light">
            <table className="w-full min-w-[600px] text-[13px]">
              <thead className="bg-subtle text-left font-body text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
                <tr>
                  <th className="px-3 py-2">Mes</th>
                  <th className="px-3 py-2">Cerrado el</th>
                  <th className="px-3 py-2 text-right">Tipsters</th>
                  <th className="px-3 py-2 text-right">Pagados</th>
                  <th className="px-3 py-2 text-right">Pend./Coord.</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light">
                {cerrados.map((c) => (
                  <tr key={c.mes} className="text-dark">
                    <td className="px-3 py-2 font-semibold">
                      {capitalize(c.nombreMes)}
                    </td>
                    <td className="px-3 py-2 text-muted-d">
                      {c.cerradoEn.toLocaleDateString("es-PE", {
                        timeZone: "America/Lima",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {c.totalUsuarios}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {c.totalPremiosPagados}
                    </td>
                    <td
                      className={`px-3 py-2 text-right ${
                        c.totalPremiosPendientes > 0
                          ? "font-bold text-brand-live"
                          : "text-muted-d"
                      }`}
                    >
                      {c.totalPremiosPendientes}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/comunidad/mes/${c.mes}`}
                        className="text-[12px] font-semibold text-brand-blue-main hover:underline"
                      >
                        Ver leaderboard →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
