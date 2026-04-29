// /admin/dashboard — métricas in-house (Lote 6).
//
// Reemplaza al viejo PostHog dashboard. Muestra:
//   - Cards: visitas/día (último día), registros/día (último día),
//     errores 24h (alerta si críticos > 0).
//   - Top eventos del periodo.
//   - Funnel pipe: $pageview → signup_completed → prediccion_enviada
//     → casa_click_afiliado.
//   - Selector de rango (último día / 7d / 30d). Default: 30d.
//
// Auth: el layout admin (admin/layout.tsx) ya valida ADMIN. Estructura
// visual replica los paneles de /admin/leaderboard (cards bordered con
// header en font-display + uppercase + tracking-[0.02em]).

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  obtenerEventosTopPeriodo,
  obtenerFunnelConversion,
  obtenerRegistrosPorDia,
  obtenerVisitasPorDia,
} from "@/lib/services/analytics.service";
import { obtenerStatsErroresUltimas24h } from "@/lib/services/logs.service";
import { DashboardRangoSelector } from "@/components/admin/DashboardRangoSelector";

export const dynamic = "force-dynamic";

const FUNNEL_EVENTOS = [
  "$pageview",
  "signup_completed",
  "prediccion_enviada",
  "casa_click_afiliado",
];

interface PageProps {
  searchParams: { rango?: string };
}

export default async function AdminDashboardMetricasPage({ searchParams }: PageProps) {
  const rangoKey: "1d" | "7d" | "30d" =
    searchParams.rango === "1d" || searchParams.rango === "7d" ? searchParams.rango : "30d";
  const dias = rangoKey === "1d" ? 1 : rangoKey === "7d" ? 7 : 30;
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - dias * 24 * 60 * 60 * 1000);

  const [visitas, registros, topEventos, funnel, statsErrores] = await Promise.all([
    obtenerVisitasPorDia({ desde, hasta }),
    obtenerRegistrosPorDia({ desde, hasta }),
    obtenerEventosTopPeriodo({ desde, hasta }),
    obtenerFunnelConversion({ desde, hasta }, FUNNEL_EVENTOS),
    obtenerStatsErroresUltimas24h(),
  ]);

  const visitasUltDia = visitas[visitas.length - 1]?.visitas ?? 0;
  const visitasTotales = visitas.reduce((acc, v) => acc + v.visitas, 0);
  const registrosTotales = registros.reduce((acc, r) => acc + r.registros, 0);
  const criticos =
    statsErrores.porLevel.find((p) => p.level === "critical")?.count ?? 0;

  return (
    <>
      <AdminPageHeader
        icon="📊"
        title="Métricas"
        description="Analytics in-house · Lote 6. Visitas, registros, funnel y top eventos del periodo."
        actions={<DashboardRangoSelector rangoActual={rangoKey} />}
      />

      {/* Cards superiores */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card
          label={`Visitas · último día`}
          value={visitasUltDia.toLocaleString("es-PE")}
          tone={visitasUltDia > 0 ? "ok" : "muted"}
        />
        <Card
          label={`Visitas · ${dias}d`}
          value={visitasTotales.toLocaleString("es-PE")}
          tone="ok"
        />
        <Card
          label={`Registros · ${dias}d`}
          value={registrosTotales.toLocaleString("es-PE")}
          tone="ok"
        />
        <Card
          label="Errores críticos · 24h"
          value={criticos.toLocaleString("es-PE")}
          tone={criticos > 0 ? "alert" : "ok"}
        />
      </section>

      {/* Funnel */}
      <section className="mb-6 rounded-md border border-light bg-card p-5 shadow-sm">
        <h2 className="mb-1 font-display text-[20px] font-black uppercase tracking-[0.02em] text-dark">
          Funnel de conversión
        </h2>
        <p className="mb-4 text-[12px] text-muted-d">
          Usuarios únicos por sessionId que dispararon cada paso (cualquier orden, en el rango).
        </p>
        <FunnelStrip filas={funnel} />
      </section>

      {/* Visitas + Registros series */}
      <section className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        <SerieDiariaCard titulo="Visitas por día" filas={visitas.map((v) => ({ dia: v.dia, valor: v.visitas }))} />
        <SerieDiariaCard
          titulo="Registros por día"
          filas={registros.map((r) => ({ dia: r.dia, valor: r.registros }))}
        />
      </section>

      {/* Top eventos */}
      <section className="mb-6 rounded-md border border-light bg-card p-5 shadow-sm">
        <h2 className="mb-3 font-display text-[20px] font-black uppercase tracking-[0.02em] text-dark">
          Top eventos · {dias}d
        </h2>
        {topEventos.length === 0 ? (
          <p className="rounded-sm border border-dashed border-light bg-subtle px-4 py-8 text-center text-[13px] text-muted-d">
            Todavía no hay eventos en este rango. Visitá páginas, hacé un signup, predicí gratis — los eventos aparecerán acá.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-light">
            <table className="w-full text-[13px]">
              <thead className="bg-subtle text-left font-body text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
                <tr>
                  <th className="px-3 py-2">Evento</th>
                  <th className="px-3 py-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light">
                {topEventos.map((e) => (
                  <tr key={e.evento} className="text-dark hover:bg-subtle/60">
                    <td className="px-3 py-2 font-mono text-[12px]">{e.evento}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">
                      {e.count.toLocaleString("es-PE")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function Card({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "muted" | "alert";
}) {
  const valueClass =
    tone === "alert"
      ? "text-brand-live"
      : tone === "muted"
        ? "text-muted-d"
        : "text-dark";
  return (
    <div className="rounded-md border border-light bg-card p-4 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-d">
        {label}
      </div>
      <div className={`mt-2 font-display text-[32px] font-black tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function FunnelStrip({
  filas,
}: {
  filas: Array<{ evento: string; usuarios: number }>;
}) {
  const max = Math.max(1, ...filas.map((f) => f.usuarios));
  return (
    <div className="space-y-2">
      {filas.map((f, i) => {
        const prev = i > 0 ? filas[i - 1] : null;
        const dropPct = prev && prev.usuarios > 0
          ? Math.round((f.usuarios / prev.usuarios) * 100)
          : null;
        const widthPct = (f.usuarios / max) * 100;
        return (
          <div key={f.evento}>
            <div className="mb-1 flex items-baseline justify-between text-[12px]">
              <span className="font-mono text-dark">{f.evento}</span>
              <span className="font-bold text-dark tabular-nums">
                {f.usuarios.toLocaleString("es-PE")}
                {dropPct !== null && (
                  <span className="ml-2 text-[11px] text-muted-d">
                    ({dropPct}%)
                  </span>
                )}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-sm bg-subtle">
              <div
                className="h-full rounded-sm bg-brand-blue-main"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SerieDiariaCard({
  titulo,
  filas,
}: {
  titulo: string;
  filas: Array<{ dia: string; valor: number }>;
}) {
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <div className="rounded-md border border-light bg-card p-5 shadow-sm">
      <h3 className="mb-3 font-display text-[15px] font-black uppercase tracking-[0.04em] text-dark">
        {titulo}
      </h3>
      {filas.length === 0 ? (
        <p className="rounded-sm border border-dashed border-light bg-subtle px-4 py-6 text-center text-[12px] text-muted-d">
          Sin datos en el rango.
        </p>
      ) : (
        <div className="flex h-32 items-end gap-0.5">
          {filas.map((f) => {
            const heightPct = (f.valor / max) * 100;
            return (
              <div
                key={f.dia}
                className="group relative flex flex-1 flex-col items-center justify-end"
                title={`${f.dia} · ${f.valor}`}
              >
                <div
                  className="w-full bg-brand-blue-main transition-colors group-hover:bg-brand-blue-mid"
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
