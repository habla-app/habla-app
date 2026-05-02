// /admin/kpis — drill-down de KPIs. Lote G.
//
// Sin ?metric= → grid de selección con todos los KPIs agrupados por
// categoría. Con ?metric=<id> → detail view: header + chart histórico +
// breakdown por dimensión + acciones sugeridas según status.

import { notFound } from "next/navigation";

import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import { KPISelectorGrid } from "@/components/admin/kpis/KPISelectorGrid";
import { KPIDetalleHeader } from "@/components/admin/kpis/KPIDetalleHeader";
import { KPIChart } from "@/components/admin/kpis/KPIChart";
import { BreakdownTabla } from "@/components/admin/kpis/BreakdownTabla";
import { AccionesSugeridas } from "@/components/admin/kpis/AccionesSugeridas";
import { KPIRangoSelector } from "@/components/admin/kpis/KPIRangoSelector";
import {
  obtenerKPIDetalle,
  type RangoDetalle,
} from "@/lib/services/kpi-detalle.service";
import { track } from "@/lib/services/analytics.service";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const RANGOS_VALIDOS: ReadonlyArray<RangoDetalle> = ["7d", "30d", "90d", "365d"];

interface PageProps {
  searchParams?: { metric?: string; rango?: string };
}

export default async function AdminKPIsPage({ searchParams }: PageProps) {
  const metricId = searchParams?.metric;
  const rango: RangoDetalle = RANGOS_VALIDOS.includes(
    searchParams?.rango as RangoDetalle,
  )
    ? (searchParams!.rango as RangoDetalle)
    : "90d";

  const session = await auth();

  if (!metricId) {
    void track({
      evento: "admin_kpi_drill_down_visto",
      userId: session?.user?.id,
      props: { vista: "selector" },
    });
    return (
      <>
        <AdminTopbar
          title="KPIs detallado"
          description="Drill-down individual por KPI · Click para ver tendencia, breakdown y acciones."
          breadcrumbs={[{ label: "Análisis" }, { label: "KPIs" }]}
        />
        <KPISelectorGrid />
      </>
    );
  }

  const detalle = await obtenerKPIDetalle(metricId, rango);
  if (!detalle) notFound();

  void track({
    evento: "admin_kpi_drill_down_visto",
    userId: session?.user?.id,
    props: { metricId, rango },
  });

  return (
    <>
      <AdminTopbar
        title={detalle.meta.label}
        description={`Análisis · ${detalle.meta.descripcion.slice(0, 120)}`}
        breadcrumbs={[
          { label: "Análisis" },
          { label: "KPIs", href: "/admin/kpis" },
          { label: detalle.meta.label },
        ]}
        actions={<KPIRangoSelector rangoActual={rango} />}
      />

      <KPIDetalleHeader header={detalle.header} />

      <section className="mb-6">
        <KPIChart
          serie={detalle.historico}
          serieAnterior={detalle.historicoAnterior}
          target={detalle.meta.target}
          formato={detalle.meta.formato}
          status={detalle.header.status}
        />
      </section>

      {detalle.breakdown.length > 0 && (
        <section className="mb-6">
          <BreakdownTabla meta={detalle.meta} filas={detalle.breakdown} />
        </section>
      )}

      <section>
        <AccionesSugeridas meta={detalle.meta} status={detalle.header.status} />
      </section>
    </>
  );
}
