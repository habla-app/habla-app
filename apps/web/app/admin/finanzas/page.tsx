// /admin/finanzas — Revenue, MRR, costos, margen, CAC, LTV. Lote G.

import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import { RevenueResumenCards } from "@/components/admin/finanzas/RevenueResumenCards";
import { RevenueDesagregado } from "@/components/admin/finanzas/RevenueDesagregado";
import { CostosTabla } from "@/components/admin/finanzas/CostosTabla";
import { ComisionesTabla } from "@/components/admin/finanzas/ComisionesTabla";
import { MesSelector } from "@/components/admin/finanzas/MesSelector";
import {
  calcularMargenOperativo,
  formatYearMonth,
  obtenerCACPromedio,
  obtenerComisionesMes,
  obtenerCostosMes,
  obtenerLTVPromedio,
  obtenerMRRMensual,
  obtenerRevenueMes,
  obtenerRevenueUltimosMeses,
} from "@/lib/services/finanzas.service";
import { prisma } from "@habla/db";
import { track } from "@/lib/services/analytics.service";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: { mes?: string };
}

function esMesValido(s: string): boolean {
  return /^\d{4}-\d{2}$/.test(s);
}

export default async function AdminFinanzasPage({ searchParams }: PageProps) {
  const mesActual = formatYearMonth(new Date());
  const mes =
    searchParams?.mes && esMesValido(searchParams.mes)
      ? searchParams.mes
      : mesActual;

  const [
    revenueMes,
    revenue12m,
    mrr12m,
    costos,
    comisiones,
    afiliados,
    margen,
    cac,
    ltv,
  ] = await Promise.all([
    obtenerRevenueMes(mes),
    obtenerRevenueUltimosMeses(12),
    obtenerMRRMensual(12),
    obtenerCostosMes(mes),
    obtenerComisionesMes(mes),
    prisma.afiliado.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { ordenDestacado: "asc" },
    }),
    calcularMargenOperativo(mes),
    obtenerCACPromedio(mes),
    obtenerLTVPromedio(),
  ]);

  const ltvCacRatio =
    ltv.ltv !== null && cac.cac !== null && cac.cac > 0 ? ltv.ltv / cac.cac : null;

  const session = await auth();
  void track({
    evento: "admin_finanzas_visto",
    userId: session?.user?.id,
    props: { mes },
  });

  const mrrUltimo = mrr12m[mrr12m.length - 1]?.total ?? 0;

  return (
    <>
      <AdminTopbar
        title="Finanzas"
        description={`Salud económica · Mes ${mes === mesActual ? `${mes} (en curso)` : mes}`}
        breadcrumbs={[{ label: "Análisis" }, { label: "Finanzas" }]}
        actions={<MesSelector mesActual={mes} />}
      />

      <RevenueResumenCards
        revenueMes={revenueMes.total}
        mrr={mrrUltimo}
        margenPct={margen.margenPct}
        ltvCacRatio={ltvCacRatio}
      />

      <section className="mb-6">
        <RevenueDesagregado data={revenue12m} />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <CostosTabla
          mes={mes}
          costos={costos}
          totalRevenue={revenueMes.total}
        />
        <ComisionesTabla
          mes={mes}
          comisiones={comisiones}
          afiliados={afiliados.map((a) => ({ id: a.id, nombre: a.nombre }))}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AdminCard title="CAC" bodyPadding="md">
          <div className="text-kpi-value-md text-dark tabular-nums">
            {cac.cac === null ? "—" : `S/ ${cac.cac.toLocaleString("es-PE")}`}
          </div>
          <div className="mt-2 text-admin-meta text-muted-d">
            Spend marketing: S/ {cac.spend.toLocaleString("es-PE")} ·
            Nuevos suscriptores: {cac.nuevosSuscriptores}
          </div>
          {cac.cac === null && (
            <p className="mt-2 text-admin-meta text-muted-d">
              Cargá la categoría <code>marketing_paid</code> en costos del mes
              para calcular CAC.
            </p>
          )}
        </AdminCard>
        <AdminCard title="LTV (Lifetime Value)" bodyPadding="md">
          <div className="text-kpi-value-md text-dark tabular-nums">
            {ltv.ltv === null ? "—" : `S/ ${ltv.ltv.toLocaleString("es-PE")}`}
          </div>
          <div className="mt-2 text-admin-meta text-muted-d">
            Duración prom: {ltv.duracionMesesProm ?? "—"}m · Precio mensualizado:{" "}
            S/ {ltv.precioMensualProm?.toLocaleString("es-PE") ?? "—"}
          </div>
          {ltv.ltv === null && (
            <p className="mt-2 text-admin-meta text-muted-d">
              Necesitan acumularse suscripciones canceladas para estimar LTV.
            </p>
          )}
        </AdminCard>
      </section>
    </>
  );
}
