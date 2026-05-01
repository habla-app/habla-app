// /admin/channel-whatsapp — métricas Channel WhatsApp Premium. Lote F.
// Spec: docs/ux-spec/05-pista-admin-operacion/channel-whatsapp.spec.md.

import {
  obtenerStatsMembresia,
  obtenerEngagementUltimos30d,
  obtenerPicksEnviadosRecientes,
  obtenerUltimoSync,
  obtenerAlertasLeakChannel,
} from "@/lib/services/channel-whatsapp.service";
import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import { ChannelWhatsAppView } from "@/components/admin/channel/ChannelWhatsAppView";

export const dynamic = "force-dynamic";

export default async function ChannelWhatsAppAdminPage() {
  const [stats, engagement, picksRecientes, ultimoSync, alertasLeak] =
    await Promise.all([
      obtenerStatsMembresia(),
      obtenerEngagementUltimos30d(),
      obtenerPicksEnviadosRecientes({ take: 20 }),
      obtenerUltimoSync(),
      obtenerAlertasLeakChannel(),
    ]);

  return (
    <>
      <AdminTopbar
        title="Channel WhatsApp"
        description={`Habla! Picks · ${stats.suscriptoresActivos} suscriptores activos · ${stats.miembrosUnidos} unidos al Channel`}
        breadcrumbs={[{ label: "Operación" }, { label: "Channel WhatsApp" }]}
      />
      <ChannelWhatsAppView
        stats={stats}
        engagement={engagement}
        picksRecientes={picksRecientes}
        ultimoSync={ultimoSync}
        alertasLeak={alertasLeak}
      />
    </>
  );
}
