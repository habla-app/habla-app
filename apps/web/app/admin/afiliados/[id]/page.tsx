// /admin/afiliados/[id] — detalle de afiliado (Lote 7).
//
// Sections:
//   1. Stats del afiliado (clicks, conversiones, revenue) en el periodo
//      seleccionado (default 30d).
//   2. Form de edición (AfiliadoForm modo="editar").
//   3. Histórico de clicks paginado (lista vertical compacta).
//   4. Histórico de conversiones reportadas.
//
// Selector de periodo afecta sólo la sección 1. Para clicks/conversiones
// mostramos siempre el histórico completo (paginado por su propio query).

import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AfiliadoForm } from "@/components/admin/AfiliadoForm";
import {
  listarClicksDeAfiliado,
  listarConversiones,
  obtenerAfiliadoPorId,
  obtenerStatsAfiliado,
  type PeriodoStats,
} from "@/lib/services/afiliacion.service";

export const dynamic = "force-dynamic";

const PERIODOS_VALIDOS: ReadonlyArray<PeriodoStats> = ["7d", "30d", "90d"];

interface PageProps {
  params: { id: string };
  searchParams: { periodo?: string; page?: string };
}

export default async function AdminAfiliadoDetallePage({
  params,
  searchParams,
}: PageProps) {
  const afiliado = await obtenerAfiliadoPorId(params.id);
  if (!afiliado) notFound();

  const periodo: PeriodoStats = PERIODOS_VALIDOS.includes(
    searchParams.periodo as PeriodoStats,
  )
    ? (searchParams.periodo as PeriodoStats)
    : "30d";
  const pageClicks = Math.max(1, Number(searchParams.page) || 1);

  const [stats, clicks, conversiones] = await Promise.all([
    obtenerStatsAfiliado({ afiliadoId: afiliado.id, periodo }),
    listarClicksDeAfiliado({
      afiliadoId: afiliado.id,
      page: pageClicks,
      pageSize: 20,
    }),
    listarConversiones({ afiliadoId: afiliado.id, limit: 50 }),
  ]);

  return (
    <>
      <AdminPageHeader
        icon={afiliado.activo ? "🤝" : "🚫"}
        title={afiliado.nombre}
        description={
          <>
            <code className="rounded-sm bg-subtle px-1.5 py-0.5 font-mono">
              /go/{afiliado.slug}
            </code>{" "}
            · <strong>{afiliado.modeloComision}</strong>
            {afiliado.activo ? "" : " · INACTIVO"}
          </>
        }
        actions={
          <Link
            href="/admin/afiliados"
            className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted-d hover:text-dark"
          >
            ← Volver a la lista
          </Link>
        }
      />

      {/* Stats del periodo */}
      <section className="mb-6 rounded-md border border-light bg-card p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[18px] font-black uppercase tracking-[0.02em] text-dark">
            Stats · {periodo}
          </h2>
          <PeriodoSelector idAfiliado={afiliado.id} actual={periodo} />
        </div>
        {stats ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Clicks totales" value={stats.clicksTotales} />
            <StatCard label="Clicks únicos (≈)" value={stats.clicksUnicos} />
            <StatCard
              label="Conversiones"
              value={stats.conversionesTotales}
              tone={stats.conversionesTotales > 0 ? "ok" : "muted"}
            />
            <StatCard
              label="Revenue acumulado"
              value={`S/ ${stats.revenueAcumuladoSoles.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`}
              tone="ok"
            />
          </div>
        ) : (
          <p className="text-[13px] text-muted-d">Sin stats todavía.</p>
        )}
      </section>

      {/* Form de edición */}
      <section className="mb-6">
        <h2 className="mb-3 font-display text-[18px] font-black uppercase tracking-[0.02em] text-dark">
          Editar
        </h2>
        <AfiliadoForm modo="editar" inicial={afiliado} />
      </section>

      {/* Histórico de clicks */}
      <section className="mb-6 rounded-md border border-light bg-card p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[18px] font-black uppercase tracking-[0.02em] text-dark">
            Clicks recientes
          </h2>
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
            {clicks.total.toLocaleString("es-PE")} total · página {clicks.page}/
            {clicks.totalPages}
          </span>
        </div>
        {clicks.rows.length === 0 ? (
          <p className="rounded-sm border border-dashed border-light bg-subtle px-4 py-8 text-center text-[13px] text-muted-d">
            Aún no hay clicks. Visitá <code className="font-mono">/go/{afiliado.slug}</code>{" "}
            en una pestaña nueva para probar.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-sm border border-light">
              <table className="w-full min-w-[640px] text-[12px]">
                <thead className="bg-subtle text-left font-body text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
                  <tr>
                    <th className="px-3 py-2">Cuándo</th>
                    <th className="px-3 py-2">Página origen</th>
                    <th className="px-3 py-2">País</th>
                    <th className="px-3 py-2">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light">
                  {clicks.rows.map((c) => (
                    <tr key={c.id} className="text-dark hover:bg-subtle/60">
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-d">
                        {c.creadoEn.toLocaleString("es-PE", {
                          timeZone: "America/Lima",
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {c.pagina || <span className="text-muted-d">—</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {c.pais ?? <span className="text-muted-d">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {c.username ? (
                          <span className="text-[12px]">@{c.username}</span>
                        ) : (
                          <span className="text-[12px] text-muted-d">anónimo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginadorClicks
              page={clicks.page}
              totalPages={clicks.totalPages}
              afiliadoId={afiliado.id}
              periodo={periodo}
            />
          </>
        )}
      </section>

      {/* Histórico de conversiones */}
      <section className="rounded-md border border-light bg-card p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[18px] font-black uppercase tracking-[0.02em] text-dark">
            Conversiones reportadas
          </h2>
          <Link
            href={`/admin/conversiones?afiliadoId=${afiliado.id}`}
            className="text-[12px] font-semibold text-brand-blue-main hover:underline"
          >
            Ver / cargar más en /admin/conversiones →
          </Link>
        </div>
        {conversiones.length === 0 ? (
          <p className="rounded-sm border border-dashed border-light bg-subtle px-4 py-8 text-center text-[13px] text-muted-d">
            Sin conversiones registradas. Cargá manualmente desde{" "}
            <Link
              href={`/admin/conversiones?afiliadoId=${afiliado.id}`}
              className="font-semibold text-brand-blue-main hover:underline"
            >
              /admin/conversiones
            </Link>{" "}
            cuando la casa te las reporte.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-light">
            <table className="w-full min-w-[600px] text-[12px]">
              <thead className="bg-subtle text-left font-body text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
                <tr>
                  <th className="px-3 py-2">Reportada</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2 text-right">Comisión</th>
                  <th className="px-3 py-2">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light">
                {conversiones.map((c) => (
                  <tr key={c.id} className="text-dark hover:bg-subtle/60">
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-d">
                      {c.reportadoEn.toLocaleDateString("es-PE", {
                        timeZone: "America/Lima",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-block rounded-sm border border-light bg-subtle px-2 py-0.5 font-mono text-[10px] font-bold text-dark">
                        {c.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.montoComision != null
                        ? `S/ ${c.montoComision.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-d">
                      {c.notas ?? "—"}
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

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "ok" | "muted";
}) {
  const valueClass =
    tone === "muted"
      ? "text-muted-d"
      : tone === "ok"
        ? "text-dark"
        : "text-dark";
  return (
    <div className="rounded-md border border-light bg-card p-4 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-d">
        {label}
      </div>
      <div
        className={`mt-2 font-display text-[24px] font-black tabular-nums ${valueClass}`}
      >
        {typeof value === "number" ? value.toLocaleString("es-PE") : value}
      </div>
    </div>
  );
}

function PeriodoSelector({
  idAfiliado,
  actual,
}: {
  idAfiliado: string;
  actual: PeriodoStats;
}) {
  return (
    <div className="flex gap-1">
      {PERIODOS_VALIDOS.map((p) => {
        const active = p === actual;
        return (
          <Link
            key={p}
            href={`/admin/afiliados/${idAfiliado}?periodo=${p}`}
            className={`rounded-sm px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] transition-colors ${
              active
                ? "bg-brand-blue-main text-white"
                : "border border-light bg-card text-muted-d hover:border-strong hover:text-dark"
            }`}
          >
            {p}
          </Link>
        );
      })}
    </div>
  );
}

function PaginadorClicks({
  page,
  totalPages,
  afiliadoId,
  periodo,
}: {
  page: number;
  totalPages: number;
  afiliadoId: string;
  periodo: PeriodoStats;
}) {
  if (totalPages <= 1) return null;

  function buildHref(p: number) {
    return `/admin/afiliados/${afiliadoId}?periodo=${periodo}&page=${p}`;
  }

  return (
    <nav
      aria-label="Paginación clicks"
      className="mt-4 flex items-center justify-between text-[12px]"
    >
      <a
        aria-disabled={page <= 1}
        href={page > 1 ? buildHref(page - 1) : undefined}
        className={`rounded-sm border border-light px-3 py-1.5 font-semibold ${
          page <= 1
            ? "cursor-not-allowed text-muted-d opacity-50"
            : "text-dark hover:bg-subtle"
        }`}
      >
        ← Anterior
      </a>
      <span className="text-muted-d">
        Página {page} de {totalPages}
      </span>
      <a
        aria-disabled={page >= totalPages}
        href={page < totalPages ? buildHref(page + 1) : undefined}
        className={`rounded-sm border border-light px-3 py-1.5 font-semibold ${
          page >= totalPages
            ? "cursor-not-allowed text-muted-d opacity-50"
            : "text-dark hover:bg-subtle"
        }`}
      >
        Siguiente →
      </a>
    </nav>
  );
}
