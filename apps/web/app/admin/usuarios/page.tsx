// /admin/usuarios — stub. La gestión de usuarios queda para Lote G
// (`docs/ux-spec/06-pista-admin-analisis/sistema-usuarios.spec.md`).
// Mientras tanto mostramos un placeholder con link al admin.
import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";

export default function AdminUsuariosPage() {
  return (
    <>
      <AdminTopbar
        title="Usuarios"
        description="Vista pendiente — implementación completa en Lote G."
        breadcrumbs={[{ label: "Sistema" }, { label: "Usuarios" }]}
      />
      <div className="rounded-md border border-dashed border-admin-table-border bg-admin-card-bg p-8 text-center text-admin-body text-muted-d">
        La vista de gestión de usuarios (búsqueda, edición, ban, eliminación
        con anonimización) se construye en el Lote G del roadmap A-J.
      </div>
    </>
  );
}
