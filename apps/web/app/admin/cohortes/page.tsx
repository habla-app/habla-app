// /admin/cohortes — análisis de cohortes mensuales. Lote G.

import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import { CohorteHeatmap } from "@/components/admin/cohortes/CohorteHeatmap";
import { MetricSelector } from "@/components/admin/cohortes/MetricSelector";
import { CohorteResumenCards } from "@/components/admin/cohortes/CohorteResumenCards";
import { CohorteSegmentos } from "@/components/admin/cohortes/CohorteSegmentos";
import {
  obtenerCohortesMensuales,
  type MetricaCohorte,
} from "@/lib/services/cohortes.service";
import { track } from "@/lib/services/analytics.service";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const METRICS_VALIDAS: ReadonlyArray<MetricaCohorte> = [
  "prediccion",
  "ftd",
  "premium",
  "activo",
];

const METRIC_LABEL: Record<MetricaCohorte, string> = {
  prediccion: "1ra predicción",
  ftd: "FTD reportado",
  premium: "Premium",
  activo: "Activo (pageview)",
};

interface PageProps {
  searchParams?: { metric?: string };
}

export default async function AdminCohortesPage({ searchParams }: PageProps) {
  const metric: MetricaCohorte = METRICS_VALIDAS.includes(
    searchParams?.metric as MetricaCohorte,
  )
    ? (searchParams!.metric as MetricaCohorte)
    : "ftd";

  const data = await obtenerCohortesMensuales(metric, 12);
  const session = await auth();
  void track({
    evento: "admin_cohortes_visto",
    userId: session?.user?.id,
    props: { metric },
  });

  return (
    <>
      <AdminTopbar
        title="Análisis de cohortes"
        description="Comportamiento de usuarios agrupados por mes de registro · Últimos 12 meses"
        breadcrumbs={[{ label: "Análisis" }, { label: "Cohortes" }]}
        actions={<MetricSelector metricActual={metric} />}
      />

      <CohorteResumenCards resumen={data.resumen} />

      <section className="mb-6">
        <CohorteHeatmap
          cohortes={data.cohortes}
          metricLabel={METRIC_LABEL[metric]}
        />
        <p className="mt-2 text-admin-meta text-muted-d">
          Verde fuerte = top 25% del periodo · Rojo fuerte = bottom 10% ·
          &ldquo;—&rdquo; = cohorte en curso o sin datos suficientes.
        </p>
      </section>

      <section>
        <CohorteSegmentos segmentos={data.segmentos} />
      </section>
    </>
  );
}
