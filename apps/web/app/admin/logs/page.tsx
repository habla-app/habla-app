// /admin/logs — tabla paginada de errores persistidos (Lote 6).
//
// Reemplaza al viejo Sentry. Filtros: level (warn/error/critical), source
// (substring), rango de fechas, paginación. Click en row expande detalle
// con stack y metadata.
//
// Auth: layout admin valida ADMIN.

import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import {
  obtenerErroresRecientes,
  obtenerStatsErroresUltimas24h,
  type LogLevel,
} from "@/lib/services/logs.service";
import { LogsTable } from "@/components/admin/LogsTable";
import { LogsFiltros } from "@/components/admin/LogsFiltros";

export const dynamic = "force-dynamic";

const LEVELS_VALIDOS: ReadonlyArray<LogLevel> = ["warn", "error", "critical"];

interface PageProps {
  searchParams: {
    level?: string;
    source?: string;
    desde?: string;
    hasta?: string;
    page?: string;
  };
}

export default async function AdminLogsPage({ searchParams }: PageProps) {
  const level =
    searchParams.level && LEVELS_VALIDOS.includes(searchParams.level as LogLevel)
      ? (searchParams.level as LogLevel)
      : undefined;
  const source = searchParams.source?.trim() || undefined;
  const desde = searchParams.desde ? new Date(searchParams.desde) : undefined;
  const hasta = searchParams.hasta ? new Date(searchParams.hasta) : undefined;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const [logs, stats24h] = await Promise.all([
    obtenerErroresRecientes({ level, source, desde, hasta, page, pageSize: 50 }),
    obtenerStatsErroresUltimas24h(),
  ]);

  const counts24h = Object.fromEntries(
    stats24h.porLevel.map((p) => [p.level, p.count]),
  );

  // Source más frecuente
  const topSource = stats24h.porSource[0]?.source ?? "—";

  return (
    <>
      <AdminTopbar
        title="Logs"
        description="Errores persistidos por el logger Pino · El cron M alerta cuando hay críticos en la última hora"
        breadcrumbs={[{ label: "Sistema" }, { label: "Logs" }]}
      />

      {/* Stats 24h */}
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Críticos · 24h" value={counts24h.critical ?? 0} tone="alert" />
        <StatCard label="Errores · 24h" value={counts24h.error ?? 0} tone="warn" />
        <StatCard label="Warnings · 24h" value={counts24h.warn ?? 0} tone="muted" />
        <StatCardText label="Source más frecuente" value={topSource} />
      </section>

      {/* Filtros */}
      <section className="mb-5 rounded-md border border-admin-table-border bg-admin-card-bg p-4 shadow-sm">
        <LogsFiltros
          initialLevel={level ?? ""}
          initialSource={source ?? ""}
          initialDesde={searchParams.desde ?? ""}
          initialHasta={searchParams.hasta ?? ""}
        />
      </section>

      {/* Tabla */}
      <section className="rounded-md border border-admin-table-border bg-admin-card-bg p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-admin-card-title text-dark">Errores recientes</h2>
          <span className="text-admin-meta text-muted-d">
            {logs.total.toLocaleString("es-PE")} total · página {logs.page}/{logs.totalPages}
          </span>
        </div>
        {logs.rows.length === 0 ? (
          <p className="rounded-sm border border-dashed border-admin-table-border bg-subtle px-4 py-8 text-center text-admin-body text-muted-d">
            Sin errores que coincidan con los filtros. {logs.total === 0 && "Todo limpio 🎉"}
          </p>
        ) : (
          <>
            <LogsTable rows={logs.rows} />
            <Paginador page={logs.page} totalPages={logs.totalPages} searchParams={searchParams} />
          </>
        )}
      </section>
    </>
  );
}

function StatCardText({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-admin-table-border bg-admin-card-bg p-4 shadow-sm">
      <div className="text-admin-label text-muted-d">{label}</div>
      <div className="mt-2 truncate font-mono text-[14px] font-bold text-dark">
        {value}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "alert" | "warn" | "muted";
}) {
  const valueClass =
    tone === "alert"
      ? value > 0
        ? "text-brand-live"
        : "text-dark"
      : tone === "warn"
        ? value > 0
          ? "text-brand-gold-dark"
          : "text-dark"
        : "text-dark";
  return (
    <div className="rounded-md border border-light bg-card p-4 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-d">
        {label}
      </div>
      <div className={`mt-2 font-display text-[28px] font-black tabular-nums ${valueClass}`}>
        {value.toLocaleString("es-PE")}
      </div>
    </div>
  );
}

function Paginador({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: PageProps["searchParams"];
}) {
  if (totalPages <= 1) return null;

  function buildHref(p: number): string {
    const usp = new URLSearchParams();
    if (searchParams.level) usp.set("level", searchParams.level);
    if (searchParams.source) usp.set("source", searchParams.source);
    if (searchParams.desde) usp.set("desde", searchParams.desde);
    if (searchParams.hasta) usp.set("hasta", searchParams.hasta);
    usp.set("page", String(p));
    return `/admin/logs?${usp.toString()}`;
  }

  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-[12px]">
      <a
        aria-disabled={page <= 1}
        href={page > 1 ? buildHref(page - 1) : undefined}
        className={`rounded-sm border border-light px-3 py-1.5 font-semibold ${
          page <= 1 ? "cursor-not-allowed text-muted-d opacity-50" : "text-dark hover:bg-subtle"
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
          page >= totalPages ? "cursor-not-allowed text-muted-d opacity-50" : "text-dark hover:bg-subtle"
        }`}
      >
        Siguiente →
      </a>
    </nav>
  );
}
