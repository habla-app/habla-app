// /admin/auditoria — Lote O (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-auditoria (líneas 6747-6893).
//
// Trail completo de acciones admin destructivas. Compliance: Ley de
// Protección de Datos Perú exige retención mínima 2 años (5 años según
// el copy del mockup, decisión interna). 100% retention (no sample).

import Link from "next/link";
import { listarAuditoria } from "@/lib/services/auditoria.service";
import { prisma } from "@habla/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Auditoría · Admin Habla!" };

interface PageProps {
  searchParams?: {
    entidad?: string;
    accion?: string;
    actorId?: string;
    rango?: string;
    page?: string;
  };
}

const PAGE_SIZE = 50;

const TIMESTAMP_FMT = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const FECHA_DIA_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatTimestamp(d: Date): string {
  const ahora = new Date();
  const dHoy = FECHA_DIA_FMT.format(ahora);
  const dRow = FECHA_DIA_FMT.format(d);
  const dAyer = FECHA_DIA_FMT.format(new Date(ahora.getTime() - 86400000));

  if (dRow === dHoy) return `${TIMESTAMP_FMT.format(d)} hoy`;
  if (dRow === dAyer) return `ayer ${TIMESTAMP_FMT.format(d)}`;
  // Antes de ayer
  return `${dRow.slice(5)} ${TIMESTAMP_FMT.format(d)}`;
}

export default async function AdminAuditoriaPage({ searchParams }: PageProps) {
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const entidadFiltro = searchParams?.entidad?.trim() || undefined;
  const accionFiltro = searchParams?.accion?.trim() || undefined;
  const actorIdFiltro = searchParams?.actorId?.trim() || undefined;
  const rango = searchParams?.rango ?? "7d";

  const ahora = new Date();
  let desde: Date | undefined;
  if (rango === "7d") desde = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
  else if (rango === "mes_actual") desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  else if (rango === "mes_anterior") {
    desde = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
  }
  let hasta: Date | undefined;
  if (rango === "mes_anterior") hasta = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  const result = await listarAuditoria({
    entidad: entidadFiltro,
    actorId: actorIdFiltro,
    desde,
    hasta,
    page,
    pageSize: PAGE_SIZE,
  });

  // Stats KPI: acciones hoy + picks aprobados mes + cambios paywall mes + premios pagados mes
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const [accionesHoy, picksAprobMes, paywallMes, premiosMes, adminsActivos] = await Promise.all([
    prisma.auditoriaAdmin.count({ where: { creadoEn: { gte: inicioHoy } } }),
    prisma.auditoriaAdmin.count({
      where: { creadoEn: { gte: inicioMes }, accion: { contains: "pick", mode: "insensitive" } },
    }),
    prisma.auditoriaAdmin.count({
      where: { creadoEn: { gte: inicioMes }, accion: { contains: "paywall", mode: "insensitive" } },
    }),
    prisma.auditoriaAdmin.count({
      where: { creadoEn: { gte: inicioMes }, accion: { contains: "premio", mode: "insensitive" } },
    }),
    prisma.auditoriaAdmin
      .findMany({
        where: { creadoEn: { gte: inicioHoy } },
        distinct: ["actorId"],
        select: { actorId: true },
      })
      .then((rs) => rs.filter((r) => r.actorId !== null).length),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function buildHref(p: number): string {
    const usp = new URLSearchParams();
    if (entidadFiltro) usp.set("entidad", entidadFiltro);
    if (accionFiltro) usp.set("accion", accionFiltro);
    if (actorIdFiltro) usp.set("actorId", actorIdFiltro);
    usp.set("rango", rango);
    usp.set("page", String(p));
    return `/admin/auditoria?${usp.toString()}`;
  }

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-breadcrumbs">
          <span>Inicio</span>
          <span>Sistema</span>
          <span>Auditoría</span>
        </div>
        <div className="admin-topbar-row">
          <div>
            <h1 className="admin-page-title">Auditoría · acciones admin</h1>
            <p className="admin-page-subtitle">Trazabilidad de cambios sensibles · quién hizo qué y cuándo · cumplimiento ANPD</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" disabled>📥 Exportar planilla</button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Acciones hoy</span>
          </div>
          <div className="admin-kpi-card-value">{accionesHoy}</div>
          <div className="admin-kpi-card-target">{adminsActivos} admins activos</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Picks aprobados (mes)</span>
          </div>
          <div className="admin-kpi-card-value">{picksAprobMes}</div>
          <div className="admin-kpi-card-target">incluye rechazos</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Cambios paywall (mes)</span>
          </div>
          <div className="admin-kpi-card-value">{paywallMes}</div>
          <div className="admin-kpi-card-target">por admins</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Premios procesados (mes)</span>
          </div>
          <div className="admin-kpi-card-value">{premiosMes}</div>
          <div className="admin-kpi-card-target">acciones sobre PremioMensual</div>
        </div>
      </div>

      <form action="/admin/auditoria" method="get" className="admin-filtros">
        <input className="admin-filter-input" name="entidad" placeholder="🔎 Acción, entidad, admin..." defaultValue={entidadFiltro ?? ""} />
        <select className="admin-filter-select" name="accion" defaultValue={accionFiltro ?? ""}>
          <option value="">Acción: todas</option>
          <option value="pick.aprobar">Aprobación pick</option>
          <option value="paywall">Cambio paywall</option>
          <option value="premio">Pago premio</option>
          <option value="usuario.verificar">Verificación usuario</option>
          <option value="usuario.eliminar">Eliminación cuenta</option>
        </select>
        <input className="admin-filter-input" name="actorId" placeholder="Admin (userId o email)..." defaultValue={actorIdFiltro ?? ""} />
        <select className="admin-filter-select" name="rango" defaultValue={rango}>
          <option value="7d">Últimos 7 días</option>
          <option value="mes_actual">Mes actual</option>
          <option value="mes_anterior">Mes anterior</option>
        </select>
        <button type="submit" className="btn btn-ghost btn-xs">Aplicar</button>
      </form>

      <table className="admin-table">
        <thead>
          <tr>
            <th style={{ width: 140 }}>Timestamp</th>
            <th style={{ width: 160 }}>Admin</th>
            <th style={{ width: 200 }}>Acción</th>
            <th style={{ width: 140 }}>Entidad</th>
            <th>Cambio</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {result.rows.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "rgba(0,16,80,.42)" }}>
                Sin entradas que coincidan con los filtros.
              </td>
            </tr>
          )}
          {result.rows.map((r) => {
            const filaBg = r.accion.includes("eliminar") ? "rgba(255,61,61,.04)" : r.accion.includes("paywall") ? "rgba(255,184,0,.04)" : undefined;
            const accionPill = pillForAccion(r.accion);
            return (
              <tr key={r.id} style={{ background: filaBg }}>
                <td style={{ fontFamily: "monospace", fontSize: 11 }}>{formatTimestamp(r.creadoEn)}</td>
                <td>{r.actorEmail ?? r.actorId ?? "—"}</td>
                <td>{accionPill}</td>
                <td>{r.entidad}</td>
                <td style={{ fontSize: 12 }}>{r.resumen ?? "—"}</td>
                <td>
                  <Link href={`/admin/auditoria/${r.id}`} className="btn btn-ghost btn-xs">Detalle</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 12, color: "rgba(0,16,80,.58)" }}>
        <div>
          Mostrando <strong>{(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, result.total)}</strong> de <strong>{result.total.toLocaleString("es-PE")}</strong>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {page > 1 ? (
            <Link href={buildHref(page - 1)} className="btn btn-ghost btn-xs">← Anterior</Link>
          ) : (
            <button type="button" className="btn btn-ghost btn-xs" disabled>← Anterior</button>
          )}
          {page < totalPages ? (
            <Link href={buildHref(page + 1)} className="btn btn-ghost btn-xs">Siguiente →</Link>
          ) : (
            <button type="button" className="btn btn-ghost btn-xs" disabled>Siguiente →</button>
          )}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid rgba(0,16,80,.06)", borderRadius: 8, padding: 14, marginTop: 14, fontSize: 12, color: "rgba(0,16,80,.58)", lineHeight: 1.6 }}>
        <strong style={{ color: "#001050" }}>Política de retención:</strong> los logs de auditoría se conservan por 5 años (cumplimiento ANPD). Las acciones sobre datos personales se registran sin contenido sensible.
      </div>
    </>
  );
}

function pillForAccion(accion: string): JSX.Element {
  const a = accion.toLowerCase();
  if (a.includes("aprobar") || a.includes("pago"))
    return <span className="adm-pill adm-pill-green">{accion.toUpperCase()}</span>;
  if (a.includes("rechazar"))
    return <span className="adm-pill adm-pill-amber">{accion.toUpperCase()}</span>;
  if (a.includes("eliminar") || a.includes("delete"))
    return <span className="adm-pill adm-pill-red">{accion.toUpperCase()}</span>;
  if (a.includes("paywall") || a.includes("config"))
    return <span className="adm-pill adm-pill-amber">{accion.toUpperCase()}</span>;
  return <span className="adm-pill adm-pill-blue">{accion.toUpperCase()}</span>;
}
