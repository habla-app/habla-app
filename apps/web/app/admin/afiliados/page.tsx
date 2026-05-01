// /admin/afiliados — listing de afiliados (refactor Lote F sobre Lote 7).
//
// Mantiene queries del Lote 7 (`listarTodos`, `obtenerStatsResumenTodos`).
// Lote F refactoriza el shell visual al patrón admin desktop: <AdminTopbar>
// + <AdminCard> + grid de stats agregados arriba de la tabla.

import Link from "next/link";
import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import {
  listarTodos,
  obtenerStatsResumenTodos,
  type AfiliadoVista,
} from "@/lib/services/afiliacion.service";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

export default async function AdminAfiliadosPage() {
  const [afiliados, statsResumen] = await Promise.all([
    listarTodos(),
    obtenerStatsResumenTodos(),
  ]);

  // Stats agregados a partir de la map (no requiere query extra).
  const totalActivos = afiliados.filter((a) => a.activo).length;
  let clicks7dGlobal = 0;
  let clicks30dGlobal = 0;
  let convsMesGlobal = 0;
  for (const stat of statsResumen.values()) {
    clicks7dGlobal += stat.clicks7d;
    clicks30dGlobal += stat.clicks30d;
    convsMesGlobal += stat.conversionesMes;
  }
  const conversionRate =
    clicks30dGlobal > 0
      ? Math.round((convsMesGlobal / clicks30dGlobal) * 1000) / 10
      : 0;

  return (
    <>
      <AdminTopbar
        title="Afiliados"
        description="Operadores autorizados por MINCETUR. Catálogo lo lee /go/[slug] y los componentes MDX."
        breadcrumbs={[{ label: "Operación" }, { label: "Afiliados" }]}
        actions={
          <Link href="/admin/afiliados/nuevo">
            <Button variant="primary" size="md" type="button">
              + Nuevo afiliado
            </Button>
          </Link>
        }
      />

      <section className="mb-6 grid grid-cols-4 gap-3">
        <StatCard label="Activos" value={totalActivos.toString()} tone="brand" />
        <StatCard
          label="Clicks 7d"
          value={clicks7dGlobal.toLocaleString("es-PE")}
          tone="neutral"
        />
        <StatCard
          label="Clicks 30d"
          value={clicks30dGlobal.toLocaleString("es-PE")}
          tone="neutral"
        />
        <StatCard
          label="Conv. rate (mes)"
          value={`${conversionRate}%`}
          tone={conversionRate >= 25 ? "good" : conversionRate >= 10 ? "amber" : "neutral"}
        />
      </section>

      <AdminCard title="Catálogo de afiliados" bodyPadding="none">
        {afiliados.length === 0 ? (
          <p className="px-4 py-10 text-center text-admin-body text-muted-d">
            Todavía no hay afiliados cargados. Tocá <strong>+ Nuevo afiliado</strong> arriba.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-admin-table-border bg-admin-table-row-stripe">
                  <th className="text-admin-table-header text-muted-d px-3 py-2.5 text-left">Casa</th>
                  <th className="text-admin-table-header text-muted-d px-3 py-2.5 text-left">Modelo</th>
                  <th className="text-admin-table-header text-muted-d px-3 py-2.5 text-left">Estado</th>
                  <th className="text-admin-table-header text-muted-d px-3 py-2.5 text-right">Clicks 7d</th>
                  <th className="text-admin-table-header text-muted-d px-3 py-2.5 text-right">Clicks 30d</th>
                  <th className="text-admin-table-header text-muted-d px-3 py-2.5 text-right">Conv. mes</th>
                  <th className="text-admin-table-header text-muted-d px-3 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {afiliados.map((a) => {
                  const stats = statsResumen.get(a.id) ?? {
                    clicks7d: 0,
                    clicks30d: 0,
                    conversionesMes: 0,
                  };
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-admin-table-border text-admin-table-cell text-dark transition-colors hover:bg-admin-table-row-hover"
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <LogoCell afiliado={a} />
                          <div className="min-w-0">
                            <div className="font-bold">{a.nombre}</div>
                            <div className="text-admin-meta text-muted-d font-mono">
                              /go/{a.slug}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded-sm border border-admin-table-border bg-subtle px-2 py-0.5 font-mono text-[11px] font-bold text-dark">
                          {a.modeloComision}
                        </span>
                        {a.modeloComision !== "REVSHARE" && a.montoCpa != null && (
                          <div className="mt-0.5 text-admin-meta text-muted-d">
                            S/ {a.montoCpa} CPA
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <EstadoBadge afiliado={a} />
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {stats.clicks7d.toLocaleString("es-PE")}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {stats.clicks30d.toLocaleString("es-PE")}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className={cn(
                            "tabular-nums",
                            stats.conversionesMes > 0
                              ? "font-bold text-status-green-text"
                              : "text-muted-d",
                          )}
                        >
                          {stats.conversionesMes}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          href={`/admin/afiliados/${a.id}`}
                          className="text-admin-meta font-bold text-brand-blue-main hover:underline"
                        >
                          Editar →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </>
  );
}

function LogoCell({ afiliado }: { afiliado: AfiliadoVista }) {
  if (afiliado.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={afiliado.logoUrl}
        alt=""
        className="h-8 w-8 flex-shrink-0 rounded-sm bg-card object-contain"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-sm bg-brand-gold font-display text-[14px] font-black text-black"
    >
      {afiliado.nombre.charAt(0).toUpperCase() || "?"}
    </div>
  );
}

function EstadoBadge({ afiliado }: { afiliado: AfiliadoVista }) {
  if (!afiliado.activo) {
    return (
      <span className="rounded-sm bg-status-neutral-bg px-2 py-0.5 text-[11px] font-bold uppercase text-status-neutral-text">
        Inactivo
      </span>
    );
  }
  if (!afiliado.autorizadoMincetur) {
    return (
      <span className="rounded-sm bg-status-red-bg px-2 py-0.5 text-[11px] font-bold uppercase text-status-red-text">
        Sin MINCETUR
      </span>
    );
  }
  return (
    <span className="rounded-sm bg-status-green-bg px-2 py-0.5 text-[11px] font-bold uppercase text-status-green-text">
      Activo
    </span>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "brand" | "good" | "amber" | "neutral";
}) {
  const cls = {
    brand: "text-brand-blue-main",
    good: "text-status-green-text",
    amber: "text-status-amber-text",
    neutral: "text-dark",
  }[tone];
  return (
    <div className="rounded-md border border-admin-table-border bg-admin-card-bg p-4">
      <div className="text-admin-label text-muted-d">{label}</div>
      <div className={cn("mt-2 text-kpi-value-md tabular-nums", cls)}>{value}</div>
    </div>
  );
}
