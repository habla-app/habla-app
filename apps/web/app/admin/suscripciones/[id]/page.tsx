// /admin/suscripciones/[id] — detalle de suscripción. Lote F (May 2026).
// Spec: docs/ux-spec/05-pista-admin-operacion/suscripciones.spec.md.

import { notFound } from "next/navigation";
import { obtenerDetalleSuscripcionAdmin } from "@/lib/services/suscripciones.service";
import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import { SuscripcionDetalleView } from "@/components/admin/suscripciones/SuscripcionDetalleView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function SuscripcionDetallePage({ params }: PageProps) {
  const detalle = await obtenerDetalleSuscripcionAdmin(params.id);
  if (!detalle) notFound();

  return (
    <>
      <AdminTopbar
        title={detalle.nombre}
        description={`${detalle.email} · @${detalle.username}`}
        breadcrumbs={[
          { label: "Operación" },
          { label: "Suscripciones", href: "/admin/suscripciones" },
          { label: detalle.nombre },
        ]}
      />
      <SuscripcionDetalleView detalle={detalle} />
    </>
  );
}
