// /admin/afiliados/nuevo — crear afiliado (Lote 7).
//
// Server page mínima: header + AfiliadoForm en modo "crear". Los detalles
// del form (validación, payload, navegación post-submit) viven en el
// client component.

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AfiliadoForm } from "@/components/admin/AfiliadoForm";

export const dynamic = "force-dynamic";

export default function AdminAfiliadoNuevoPage() {
  return (
    <>
      <AdminPageHeader
        icon="✨"
        title="Nuevo afiliado"
        description="Cargá un operador autorizado por MINCETUR. Por defecto queda activo y visible en /go/[slug] + componentes MDX."
      />
      <AfiliadoForm modo="crear" />
    </>
  );
}
