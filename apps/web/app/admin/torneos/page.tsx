// /admin/torneos — gestión de torneos. Lote F (May 2026).
//
// En Lote 5.1 esta vista vivía dentro de `/admin` (raíz). Lote F mueve
// el dashboard de KPIs a `/admin/dashboard` y deja `/admin/torneos` como
// la vista dedicada de gestión de torneos (auto-import, manual, listado).
import { AdminTorneosPanel } from "@/components/admin/AdminTorneosPanel";
import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";

export const dynamic = "force-dynamic";

export default function AdminTorneosPage() {
  return (
    <>
      <AdminTopbar
        title="Torneos"
        description="Importá partidos de api-football y creá torneos sobre los que estén disponibles."
        breadcrumbs={[
          { label: "Contenido" },
          { label: "Torneos" },
        ]}
      />
      <AdminTorneosPanel />
    </>
  );
}
