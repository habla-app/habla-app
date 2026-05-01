// /admin/afiliados/nuevo — crear afiliado. Lote F (refactor visual sobre Lote 7).
import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import { AfiliadoForm } from "@/components/admin/AfiliadoForm";

export const dynamic = "force-dynamic";

export default function AdminAfiliadoNuevoPage() {
  return (
    <>
      <AdminTopbar
        title="Nuevo afiliado"
        description="Cargá un operador autorizado por MINCETUR. Por defecto queda activo y visible en /go/[slug] + componentes MDX."
        breadcrumbs={[
          { label: "Operación" },
          { label: "Afiliados", href: "/admin/afiliados" },
          { label: "Nuevo" },
        ]}
      />
      <AfiliadoForm modo="crear" />
    </>
  );
}
