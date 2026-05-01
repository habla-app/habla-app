// /admin/suscripciones — listing + filtros. Lote F (May 2026).
// Spec: docs/ux-spec/05-pista-admin-operacion/suscripciones.spec.md.

import {
  listarSuscripcionesAdmin,
  obtenerStatsSuscripciones,
} from "@/lib/services/suscripciones.service";
import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import { SuscripcionesView } from "@/components/admin/suscripciones/SuscripcionesView";

export const dynamic = "force-dynamic";

const ESTADOS_VALIDOS = [
  "PENDIENTE",
  "ACTIVA",
  "CANCELANDO",
  "VENCIDA",
  "REEMBOLSADA",
  "FALLIDA",
] as const;

const PLANES_VALIDOS = ["MENSUAL", "TRIMESTRAL", "ANUAL"] as const;

interface PageProps {
  searchParams?: {
    estado?: string;
    plan?: string;
    q?: string;
    page?: string;
  };
}

export default async function SuscripcionesAdminPage({ searchParams }: PageProps) {
  const estado = ESTADOS_VALIDOS.includes(
    searchParams?.estado as (typeof ESTADOS_VALIDOS)[number],
  )
    ? (searchParams!.estado as (typeof ESTADOS_VALIDOS)[number])
    : undefined;
  const plan = PLANES_VALIDOS.includes(
    searchParams?.plan as (typeof PLANES_VALIDOS)[number],
  )
    ? (searchParams!.plan as (typeof PLANES_VALIDOS)[number])
    : undefined;

  const page = Math.max(1, Number(searchParams?.page) || 1);

  const [stats, listado] = await Promise.all([
    obtenerStatsSuscripciones(),
    listarSuscripcionesAdmin({
      estado,
      plan,
      q: searchParams?.q,
      page,
      pageSize: 50,
    }),
  ]);

  return (
    <>
      <AdminTopbar
        title="Suscripciones"
        description={`${stats.totalActivas} activas · MRR S/ ${(stats.mrrCentimos / 100).toLocaleString("es-PE", { maximumFractionDigits: 0 })}`}
        breadcrumbs={[{ label: "Operación" }, { label: "Suscripciones" }]}
      />
      <SuscripcionesView
        stats={stats}
        rows={listado.rows}
        total={listado.total}
        page={listado.page}
        pageSize={listado.pageSize}
        filtroEstado={estado ?? null}
        filtroPlan={plan ?? null}
        filtroQ={searchParams?.q ?? ""}
      />
    </>
  );
}
