// /admin/logs — Lote O (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-logs (líneas 6592-6742).
//
// Reemplaza al render del Lote 6 con HTML literal del mockup. La fuente
// de datos es `log_errores` (Pino) — el mockup contempla CRITICAL/ERROR/
// WARN/INFO; el repo solo persiste WARN/ERROR/CRITICAL (los INFO se
// loggean a stdout y no a BD), así que la fila INFO del mockup queda con
// "—".

import Link from "next/link";
import {
  obtenerErroresRecientes,
  obtenerStatsErroresUltimas24h,
  type LogLevel,
} from "@/lib/services/logs.service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Logs · Admin Habla!" };

const LEVELS_VALIDOS: ReadonlyArray<LogLevel> = ["warn", "error", "critical"];

interface PageProps {
  searchParams?: {
    level?: string;
    source?: string;
    rango?: string;
    page?: string;
    q?: string;
  };
}

const HORA_LIMA = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function formatTimestamp(d: Date): string {
  return `${HORA_LIMA.format(d)} PET`;
}

export default async function AdminLogsPage({ searchParams }: PageProps) {
  const level = searchParams?.level && LEVELS_VALIDOS.includes(searchParams.level.toLowerCase() as LogLevel)
    ? (searchParams.level.toLowerCase() as LogLevel)
    : undefined;
  const source = searchParams?.source?.trim() || undefined;
  const q = searchParams?.q?.trim() || undefined;
  const rango = searchParams?.rango ?? "24h";
  const page = Math.max(1, Number(searchParams?.page) || 1);

  // Resolver rango → desde
  const ahora = new Date();
  let desde: Date | undefined;
  if (rango === "1h") desde = new Date(ahora.getTime() - 60 * 60 * 1000);
  else if (rango === "24h") desde = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
  else if (rango === "7d") desde = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [logs, stats24h] = await Promise.all([
    obtenerErroresRecientes({ level, source: source ?? q, desde, page, pageSize: 50 }),
    obtenerStatsErroresUltimas24h(),
  ]);

  const counts24h = Object.fromEntries(stats24h.porLevel.map((p) => [p.level, p.count]));

  function buildHref(p: number): string {
    const usp = new URLSearchParams();
    if (level) usp.set("level", level);
    if (source) usp.set("source", source);
    if (q) usp.set("q", q);
    usp.set("rango", rango);
    usp.set("page", String(p));
    return `/admin/logs?${usp.toString()}`;
  }

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-breadcrumbs">
          <span>Inicio</span>
          <span>Sistema</span>
          <span>Logs</span>
        </div>
        <div className="admin-topbar-row">
          <div>
            <h1 className="admin-page-title">Logs del sistema</h1>
            <p className="admin-page-subtitle">Errores · advertencias · eventos críticos · últimas 24h</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" disabled>📥 Exportar</button>
            <button type="button" className="btn btn-secondary btn-sm" disabled>🗑 Limpiar resueltos</button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">CRITICAL</span>
            <span className={`admin-kpi-card-status admin-kpi-status-${(counts24h.critical ?? 0) > 0 ? "red" : "good"}`} />
          </div>
          <div className="admin-kpi-card-value">{counts24h.critical ?? 0}</div>
          <div className="admin-kpi-card-target">últimas 24h</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">ERROR</span>
            <span className={`admin-kpi-card-status admin-kpi-status-${(counts24h.error ?? 0) > 0 ? "amber" : "good"}`} />
          </div>
          <div className="admin-kpi-card-value">{counts24h.error ?? 0}</div>
          <div className="admin-kpi-card-target">últimas 24h</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">WARN</span>
          </div>
          <div className="admin-kpi-card-value">{counts24h.warn ?? 0}</div>
          <div className="admin-kpi-card-target">últimas 24h</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">INFO</span>
          </div>
          <div className="admin-kpi-card-value">—</div>
          <div className="admin-kpi-card-target">no persistido en BD</div>
        </div>
      </div>

      <form action="/admin/logs" method="get" className="admin-filtros">
        <input className="admin-filter-input" name="q" placeholder="🔎 Mensaje, request ID..." defaultValue={q ?? ""} />
        <select className="admin-filter-select" name="level" defaultValue={level ?? ""}>
          <option value="">Severidad: todas</option>
          <option value="critical">CRITICAL</option>
          <option value="error">ERROR</option>
          <option value="warn">WARN</option>
        </select>
        <select className="admin-filter-select" name="source" defaultValue={source ?? ""}>
          <option value="">Fuente: todas</option>
          <option value="api">API</option>
          <option value="cron">Cron</option>
          <option value="webhook">Webhook</option>
          <option value="frontend">Frontend</option>
        </select>
        <select className="admin-filter-select" name="rango" defaultValue={rango}>
          <option value="1h">Última hora</option>
          <option value="24h">Últimas 24h</option>
          <option value="7d">Últimos 7d</option>
        </select>
        <button type="submit" className="btn btn-ghost btn-xs">Aplicar</button>
      </form>

      <table className="admin-table">
        <thead>
          <tr>
            <th style={{ width: 140 }}>Timestamp</th>
            <th style={{ width: 80 }}>Sev</th>
            <th style={{ width: 120 }}>Fuente</th>
            <th>Mensaje</th>
            <th style={{ width: 120 }}>Request ID</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {logs.rows.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "rgba(0,16,80,.42)" }}>
                Sin logs que coincidan con los filtros. {logs.total === 0 && "Todo limpio 🎉"}
              </td>
            </tr>
          )}
          {logs.rows.map((r) => {
            const reqId = (r.metadata && typeof r.metadata === "object" && r.metadata !== null && "requestId" in r.metadata)
              ? String((r.metadata as Record<string, unknown>).requestId ?? "—")
              : "—";
            const filaBg = r.level === "critical" ? "rgba(255,61,61,.05)" : undefined;
            const sevPill = r.level === "critical"
              ? <span className="adm-pill adm-pill-red">CRITICAL</span>
              : r.level === "error"
                ? <span className="adm-pill adm-pill-amber">ERROR</span>
                : <span className="adm-pill adm-pill-gray">WARN</span>;
            return (
              <tr key={r.id} style={{ background: filaBg }}>
                <td style={{ fontFamily: "monospace", fontSize: 11 }}>{formatTimestamp(r.creadoEn)}</td>
                <td>{sevPill}</td>
                <td style={{ fontSize: 11 }}>{r.source}</td>
                <td style={{ fontSize: 12 }}>{r.message}</td>
                <td style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(0,16,80,.58)" }}>{reqId}</td>
                <td>
                  <Link href={`/admin/logs/${r.id}`} className="btn btn-ghost btn-xs">
                    Ver{r.stack ? " stack" : ""}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 12, color: "rgba(0,16,80,.58)" }}>
        <div>
          Mostrando <strong>{(page - 1) * 50 + 1}-{Math.min(page * 50, logs.total)}</strong> de <strong>{logs.total.toLocaleString("es-PE")}</strong>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {page > 1 ? (
            <Link href={buildHref(page - 1)} className="btn btn-ghost btn-xs">← Anterior</Link>
          ) : (
            <button type="button" className="btn btn-ghost btn-xs" disabled>← Anterior</button>
          )}
          {page < logs.totalPages ? (
            <Link href={buildHref(page + 1)} className="btn btn-ghost btn-xs">Siguiente →</Link>
          ) : (
            <button type="button" className="btn btn-ghost btn-xs" disabled>Siguiente →</button>
          )}
        </div>
      </div>
    </>
  );
}
