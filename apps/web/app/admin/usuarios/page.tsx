// /admin/usuarios — listing + filtros + drill-down. Lote G.

import Link from "next/link";

import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import { UsuariosTabla } from "@/components/admin/usuarios/UsuariosTabla";
import { UsuariosFiltros } from "@/components/admin/usuarios/UsuariosFiltros";
import {
  listarUsuariosAdmin,
  type UsuarioEstado,
} from "@/lib/services/usuarios.service";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: {
    q?: string;
    rol?: string;
    estado?: string;
    page?: string;
  };
}

const ROLES_VALIDOS = ["JUGADOR", "ADMIN"] as const;
const ESTADOS_VALIDOS: ReadonlyArray<UsuarioEstado> = [
  "activo",
  "soft_deleted",
];

export default async function AdminUsuariosPage({ searchParams }: PageProps) {
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const rol = ROLES_VALIDOS.includes(searchParams?.rol as "JUGADOR" | "ADMIN")
    ? (searchParams!.rol as "JUGADOR" | "ADMIN")
    : undefined;
  const estado = ESTADOS_VALIDOS.includes(searchParams?.estado as UsuarioEstado)
    ? (searchParams!.estado as UsuarioEstado)
    : undefined;
  const query = searchParams?.q?.trim() || undefined;

  const result = await listarUsuariosAdmin({
    query,
    rol,
    estado,
    page,
    pageSize: 50,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <>
      <AdminTopbar
        title="Usuarios"
        description="Gestión de usuarios · Búsqueda, filtros, acciones admin"
        breadcrumbs={[{ label: "Sistema" }, { label: "Usuarios" }]}
      />

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total" value={result.stats.total} />
        <Stat label="Activos" value={result.stats.activos} />
        <Stat label="Admins" value={result.stats.admins} tone="brand" />
        <Stat
          label="Eliminados"
          value={result.stats.softDeleted}
          tone="red"
        />
      </section>

      <AdminCard title="Filtros" bodyPadding="md" className="mb-4">
        <UsuariosFiltros
          initialQuery={query ?? ""}
          initialRol={rol ?? ""}
          initialEstado={estado ?? ""}
        />
      </AdminCard>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-admin-section text-dark">Usuarios</h2>
          <span className="text-admin-meta text-muted-d">
            {result.total.toLocaleString("es-PE")} totales · página {page} de{" "}
            {totalPages}
          </span>
        </div>
        <UsuariosTabla rows={result.rows} />
        <Paginador
          page={page}
          totalPages={totalPages}
          searchParams={searchParams ?? {}}
        />
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "brand" | "red";
}) {
  return (
    <div className="rounded-md border border-admin-table-border bg-admin-card-bg p-4">
      <div className="text-admin-label text-muted-d">{label}</div>
      <div
        className={cn(
          "mt-2 text-kpi-value-md tabular-nums",
          tone === "red"
            ? "text-status-red-text"
            : tone === "brand"
              ? "text-brand-blue-main"
              : "text-dark",
        )}
      >
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
  searchParams: NonNullable<PageProps["searchParams"]>;
}) {
  if (totalPages <= 1) return null;

  function buildHref(p: number): string {
    const usp = new URLSearchParams();
    if (searchParams.q) usp.set("q", searchParams.q);
    if (searchParams.rol) usp.set("rol", searchParams.rol);
    if (searchParams.estado) usp.set("estado", searchParams.estado);
    usp.set("page", String(p));
    return `/admin/usuarios?${usp.toString()}`;
  }

  return (
    <nav
      aria-label="Paginación"
      className="mt-4 flex items-center justify-between text-admin-meta"
    >
      {page > 1 ? (
        <Link
          href={buildHref(page - 1)}
          className="rounded-sm border border-admin-table-border px-3 py-1.5 font-bold text-dark hover:bg-subtle"
        >
          ← Anterior
        </Link>
      ) : (
        <span className="rounded-sm border border-admin-table-border px-3 py-1.5 font-bold text-soft">
          ← Anterior
        </span>
      )}
      <span className="text-muted-d">
        Página {page} de {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={buildHref(page + 1)}
          className="rounded-sm border border-admin-table-border px-3 py-1.5 font-bold text-dark hover:bg-subtle"
        >
          Siguiente →
        </Link>
      ) : (
        <span className="rounded-sm border border-admin-table-border px-3 py-1.5 font-bold text-soft">
          Siguiente →
        </span>
      )}
    </nav>
  );
}
