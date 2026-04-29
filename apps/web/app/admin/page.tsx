// /admin — dashboard del panel admin (Lote 5.1).
//
// Auth check ya lo hace el layout (admin/layout.tsx). Acá sólo presentación:
// header consistente + AdminTorneosPanel (gestión de torneos + auto-import).
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTorneosPanel } from "@/components/admin/AdminTorneosPanel";

export default function AdminPage() {
  return (
    <>
      <AdminPageHeader
        icon="🏠"
        title="Dashboard"
        description="Importá partidos de api-football y creá torneos sobre los que estén disponibles. El leaderboard mensual y los premios viven en sus propias secciones."
      />
      <AdminTorneosPanel />
    </>
  );
}
