// /admin/mobile-vitals — Lighthouse + CWV monitoring. Lote G.

import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import { VitalsResumenCards } from "@/components/admin/vitals/VitalsResumenCards";
import { VitalsCharts } from "@/components/admin/vitals/VitalsCharts";
import { RutasPeorPerformance } from "@/components/admin/vitals/RutasPeorPerformance";
import { LighthouseHistorico } from "@/components/admin/vitals/LighthouseHistorico";
import { LighthouseManualButton } from "@/components/admin/vitals/LighthouseManualButton";
import {
  obtenerLighthouseHistorico,
  obtenerRutasPeorPerformance,
  obtenerVitalsAgregadas,
  obtenerVitalsCharts,
} from "@/lib/services/vitals.service";
import { track } from "@/lib/services/analytics.service";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminMobileVitalsPage() {
  const [agregadas, charts, rutasPeor, lighthouseHist] = await Promise.all([
    obtenerVitalsAgregadas("30d"),
    obtenerVitalsCharts("30d"),
    obtenerRutasPeorPerformance("30d", 20),
    obtenerLighthouseHistorico(50),
  ]);

  const session = await auth();
  void track({
    evento: "admin_vitals_visto",
    userId: session?.user?.id,
  });

  const tienePsiKey = !!process.env.PAGESPEED_API_KEY;

  return (
    <>
      <AdminTopbar
        title="Mobile Vitals"
        description={`Performance real de usuarios · Últimos 30 días · ${agregadas.samples.toLocaleString("es-PE")} samples`}
        breadcrumbs={[{ label: "Análisis" }, { label: "Mobile Vitals" }]}
        actions={tienePsiKey ? <LighthouseManualButton /> : null}
      />

      {!tienePsiKey && (
        <div
          role="status"
          className="mb-6 rounded-md border border-status-amber bg-status-amber-bg p-3 text-admin-body text-status-amber-text"
        >
          ⚠ <strong>PAGESPEED_API_KEY no configurada</strong>. Lighthouse no
          puede correr — los Core Web Vitals igual se capturan desde el
          cliente. Configurar en Railway → Settings → Variables.
        </div>
      )}

      {agregadas.samples < 10 && (
        <div
          role="status"
          className="mb-6 rounded-md border border-admin-table-border bg-admin-card-bg p-3 text-admin-body text-muted-d"
        >
          📊 Recolectando datos. Stats útiles disponibles después de ~1 semana
          de tráfico real.
        </div>
      )}

      <VitalsResumenCards agregadas={agregadas} />

      <section className="mb-6">
        <VitalsCharts charts={charts} />
      </section>

      <section className="mb-6">
        <RutasPeorPerformance rutas={rutasPeor} />
      </section>

      <section>
        <LighthouseHistorico filas={lighthouseHist} />
      </section>
    </>
  );
}
