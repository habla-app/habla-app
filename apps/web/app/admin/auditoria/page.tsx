// /admin/auditoria — trail de acciones admin. Lote G.
//
// Compliance: Ley de Protección de Datos Perú exige retención mínima 2 años.
// 100% retention (no sample). Filtros: entidad, actor, rango.

import Link from "next/link";

import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import { AuditoriaTabla } from "@/components/admin/auditoria/AuditoriaTabla";
import { AuditoriaFiltros } from "@/components/admin/auditoria/AuditoriaFiltros";
import { listarAuditoria } from "@/lib/services/auditoria.service";
import { track } from "@/lib/services/analytics.service";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: {
    entidad?: string;
    actorId?: string;
    desde?: string;
    hasta?: string;
    page?: string;
  };
}

export default async function AdminAuditoriaPage({ searchParams }: PageProps) {
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const desde = searchParams?.desde ? new Date(searchParams.desde) : undefined;
  const hasta = searchParams?.hasta ? new Date(searchParams.hasta) : undefined;

  const result = await listarAuditoria({
    entidad: searchParams?.entidad || undefined,
    actorId: searchParams?.actorId || undefined,
    desde,
    hasta,
    page,
    pageSize: 50,
  });

  const session = await auth();
  void track({
    evento: "admin_auditoria_visto",
    userId: session?.user?.id,
  });

  return (
    <>
      <AdminTopbar
        title="Auditoría"
        description="Trail completo de acciones admin destructivas · 100% retention · 2 años (Ley Protección Datos PE)"
        breadcrumbs={[{ label: "Sistema" }, { label: "Auditoría" }]}
      />

      <AdminCard title="Filtros" bodyPadding="md" className="mb-4">
        <AuditoriaFiltros
          initialEntidad={searchParams?.entidad ?? ""}
          initialActorId={searchParams?.actorId ?? ""}
        />
      </AdminCard>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-admin-section text-dark">Entradas</h2>
          <span className="text-admin-meta text-muted-d">
            {result.total.toLocaleString("es-PE")} totales · página {result.page} de{" "}
            {Math.max(1, Math.ceil(result.total / result.pageSize))}
          </span>
        </div>
        <AuditoriaTabla rows={result.rows} />
        <Paginador
          page={result.page}
          totalPages={Math.max(1, Math.ceil(result.total / result.pageSize))}
          searchParams={searchParams ?? {}}
        />
      </section>
    </>
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
    if (searchParams.entidad) usp.set("entidad", searchParams.entidad);
    if (searchParams.actorId) usp.set("actorId", searchParams.actorId);
    if (searchParams.desde) usp.set("desde", searchParams.desde);
    if (searchParams.hasta) usp.set("hasta", searchParams.hasta);
    usp.set("page", String(p));
    return `/admin/auditoria?${usp.toString()}`;
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
