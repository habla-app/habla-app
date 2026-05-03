// /admin/usuarios — Lote O (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-usuarios (líneas 7110-7281).
//
// Listing con filtros + pagination. Las columnas siguen el mockup:
// Usuario / Email / Rol / Estado / Socios / FTD / Predicc. / Pos liga /
// Registro / acción.

import Link from "next/link";
import { prisma } from "@habla/db";
import type { Prisma } from "@habla/db";
import { obtenerLeaderboardMesActual } from "@/lib/services/leaderboard.service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usuarios · Admin Habla!" };

interface PageProps {
  searchParams?: {
    q?: string;
    rol?: string;
    estado?: string;
    socios?: string;
    page?: string;
  };
}

const PAGE_SIZE = 50;
const MES_FECHA = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatFechaCorta(d: Date): string {
  return MES_FECHA.format(d).replace(/\./g, "");
}

export default async function AdminUsuariosPage({ searchParams }: PageProps) {
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const q = searchParams?.q?.trim() || null;
  const rol = (searchParams?.rol as "JUGADOR" | "ADMIN" | undefined) ?? null;
  const estado = (searchParams?.estado as "activos" | "deleted" | "todos" | undefined) ?? "activos";
  const socios = (searchParams?.socios as "todos" | "activos" | "cancelados" | "free" | undefined) ?? "todos";

  const where: Prisma.UsuarioWhereInput = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { nombre: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
    ];
  }
  if (rol) where.rol = rol;
  if (estado === "activos") where.deletedAt = null;
  if (estado === "deleted") where.deletedAt = { not: null };

  if (socios === "activos") {
    where.suscripciones = { some: { activa: true } };
  } else if (socios === "cancelados") {
    where.suscripciones = { some: { cancelada: true } };
  } else if (socios === "free") {
    where.suscripciones = { none: {} };
  }

  const [total, usuarios, totalActivos, lb] = await Promise.all([
    prisma.usuario.count({ where }),
    prisma.usuario.findMany({
      where,
      orderBy: { creadoEn: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        nombre: true,
        username: true,
        email: true,
        rol: true,
        deletedAt: true,
        creadoEn: true,
        suscripciones: {
          select: { plan: true, activa: true, cancelada: true },
          orderBy: { iniciada: "desc" },
          take: 1,
        },
        conversionesAfiliados: {
          select: { afiliado: { select: { nombre: true } } },
          orderBy: { creadoEn: "desc" },
          take: 1,
        },
        _count: { select: { tickets: true } },
      },
    }),
    prisma.usuario.count(),
    obtenerLeaderboardMesActual({}).catch(() => null),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const posByUser = new Map<string, number>();
  if (lb) {
    for (const f of lb.filas) posByUser.set(f.userId, f.posicion);
  }

  function buildHref(targetPage: number): string {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (rol) usp.set("rol", rol);
    if (estado && estado !== "activos") usp.set("estado", estado);
    if (socios && socios !== "todos") usp.set("socios", socios);
    usp.set("page", String(targetPage));
    return `/admin/usuarios?${usp.toString()}`;
  }

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-breadcrumbs">
          <span>Inicio</span>
          <span>Sistema</span>
          <span>Usuarios</span>
        </div>
        <div className="admin-topbar-row">
          <div>
            <h1 className="admin-page-title">Usuarios</h1>
            <p className="admin-page-subtitle">
              {totalActivos.toLocaleString("es-PE")} usuarios registrados
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" disabled>Exportar CSV</button>
            <button type="button" className="btn btn-secondary btn-sm" disabled>+ Crear admin</button>
          </div>
        </div>
      </div>

      <form action="/admin/usuarios" method="get" className="admin-filtros">
        <input className="admin-filter-input" name="q" placeholder="🔎 Email, username o nombre..." defaultValue={q ?? ""} />
        <select className="admin-filter-select" name="rol" defaultValue={rol ?? ""}>
          <option value="">Todos los roles</option>
          <option value="JUGADOR">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select className="admin-filter-select" name="estado" defaultValue={estado}>
          <option value="activos">Estado: activos</option>
          <option value="deleted">Estado: deleted</option>
          <option value="todos">Estado: todos</option>
        </select>
        <select className="admin-filter-select" name="socios" defaultValue={socios}>
          <option value="todos">Suscripción: todos</option>
          <option value="activos">Socios activos</option>
          <option value="cancelados">Socios cancelados</option>
          <option value="free">Free</option>
        </select>
        <button type="submit" className="btn btn-ghost btn-xs">Aplicar</button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(0,16,80,.58)" }}>
          Mostrando <strong>{(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)}</strong> de <strong>{total.toLocaleString("es-PE")}</strong>
        </span>
      </form>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Socios</th>
            <th>FTD</th>
            <th>Predicc.</th>
            <th>Pos liga</th>
            <th>Registro</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {usuarios.length === 0 && (
            <tr>
              <td colSpan={10} style={{ textAlign: "center", padding: 24, color: "rgba(0,16,80,.42)" }}>
                Sin usuarios que coincidan con los filtros.
              </td>
            </tr>
          )}
          {usuarios.map((u) => {
            const sus = u.suscripciones[0] ?? null;
            const conv = u.conversionesAfiliados[0] ?? null;
            const pos = posByUser.get(u.id) ?? null;

            const sociosCell = sus
              ? sus.cancelada
                ? <span className="adm-pill adm-pill-red">💎 Cancelado</span>
                : sus.activa
                  ? <span className="adm-pill adm-pill-amber">💎 {labelPlan(sus.plan)}</span>
                  : <span className="adm-pill adm-pill-gray">💎 {labelPlan(sus.plan)}</span>
              : <span style={{ color: "rgba(0,16,80,.42)" }}>—</span>;

            const ftdCell = conv
              ? <span className="adm-pill adm-pill-green">Sí · {conv.afiliado.nombre}</span>
              : <span style={{ color: "rgba(0,16,80,.42)" }}>—</span>;

            const estadoCell = u.deletedAt
              ? <span className="adm-pill adm-pill-red">Soft delete</span>
              : <span className="adm-pill adm-pill-green">Activo</span>;

            const rolCell = u.rol === "ADMIN"
              ? <span className="adm-pill adm-pill-blue">ADMIN</span>
              : <span className="adm-pill adm-pill-gray">USER</span>;

            const emailDisplay = u.deletedAt
              ? <span style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(0,16,80,.58)" }}>(eliminado)</span>
              : <span style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(0,16,80,.58)" }}>{u.email}</span>;

            return (
              <tr key={u.id}>
                <td>
                  <div style={{ fontWeight: 600, color: "#001050" }}>{u.nombre}</div>
                  <div style={{ fontSize: 11, color: "rgba(0,16,80,.58)" }}>@{u.username}</div>
                </td>
                <td>{emailDisplay}</td>
                <td>{rolCell}</td>
                <td>{estadoCell}</td>
                <td>{sociosCell}</td>
                <td>{ftdCell}</td>
                <td>{u._count.tickets}</td>
                <td>
                  {pos
                    ? <strong style={{ color: pos <= 10 ? "#0052CC" : "#001050" }}>#{pos}</strong>
                    : <span style={{ color: "rgba(0,16,80,.42)" }}>—</span>}
                </td>
                <td style={{ fontSize: 11, color: "rgba(0,16,80,.58)" }}>{formatFechaCorta(u.creadoEn)}</td>
                <td>
                  <Link href={`/admin/usuarios/${u.id}`} style={{ fontSize: 11, color: "#0052CC", fontWeight: 700 }}>
                    Ver →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 12, color: "rgba(0,16,80,.58)" }}>
        <div>Página <strong>{page}</strong> de {totalPages}</div>
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
    </>
  );
}

function labelPlan(plan: "MENSUAL" | "TRIMESTRAL" | "ANUAL"): string {
  if (plan === "MENSUAL") return "Mensual";
  if (plan === "TRIMESTRAL") return "Trimestral";
  return "Anual";
}
