// /admin/alarmas — gestión de alarmas KPI + manuales. Lote G.

import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import { AlarmasActivasList } from "@/components/admin/alarmas/AlarmasActivasList";
import { AlarmasConfigTabla } from "@/components/admin/alarmas/AlarmasConfigTabla";
import { AlarmasHistoricoTabla } from "@/components/admin/alarmas/AlarmasHistoricoTabla";
import { CrearAlarmaManualButton } from "@/components/admin/alarmas/CrearAlarmaManualButton";
import {
  contarAlarmasActivas,
  listarHistoricoAlarmas,
  obtenerAlarmasActivas,
  obtenerConfigThresholds,
} from "@/lib/services/alarmas.service";
import { obtenerCatalogoKPIs } from "@/lib/services/kpis-metadata";
import { track } from "@/lib/services/analytics.service";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminAlarmasPage() {
  const [activas, configs, historico, totalActivas] = await Promise.all([
    obtenerAlarmasActivas(),
    obtenerConfigThresholds(),
    listarHistoricoAlarmas({ soloDesactivadas: true, pageSize: 50 }),
    contarAlarmasActivas(),
  ]);

  const session = await auth();
  void track({
    evento: "admin_alarma_visto",
    userId: session?.user?.id,
  });

  const catalogoKPIs = obtenerCatalogoKPIs();

  return (
    <>
      <AdminTopbar
        title="Alarmas"
        description={`${totalActivas} ${totalActivas === 1 ? "activa" : "activas"} · ${historico.total} en histórico`}
        breadcrumbs={[{ label: "Análisis" }, { label: "Alarmas" }]}
        actions={<CrearAlarmaManualButton />}
      />

      <section className="mb-8">
        <h2 className="mb-3 text-admin-section text-dark">
          {totalActivas === 0 ? "🟢" : "🔴"} Activas{" "}
          <span className="text-muted-d">({totalActivas})</span>
        </h2>
        <AlarmasActivasList alarmas={activas} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-admin-section text-dark">
          ⚙ Configuración thresholds
        </h2>
        <AlarmasConfigTabla configs={configs} catalogoKPIs={catalogoKPIs} />
      </section>

      <section>
        <h2 className="mb-3 text-admin-section text-dark">📊 Histórico</h2>
        <AlarmasHistoricoTabla alarmas={historico.rows} />
      </section>
    </>
  );
}
