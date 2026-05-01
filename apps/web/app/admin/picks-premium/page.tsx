// /admin/picks-premium — vista CRÍTICA de validación de picks. Lote F.
// Spec: docs/ux-spec/05-pista-admin-operacion/picks-premium.spec.md.
//
// Layout 2 paneles: cola izquierda (PicksColaSidebar) + detalle derecho
// (PickDetalleView). Atajos de teclado A/R/E/↑↓/Esc cableados en el
// componente cliente <PicksPremiumView>.

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  listarColaPicks,
  obtenerContadoresColaPicks,
  obtenerDetallePickAdmin,
  obtenerStatsEditor,
  type FiltroEstadoPick,
} from "@/lib/services/picks-premium-admin.service";
import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import { KbdHint } from "@/components/ui/admin/KbdHint";
import { PicksPremiumView } from "@/components/admin/picks/PicksPremiumView";

export const dynamic = "force-dynamic";

const ESTADOS_VALIDOS: ReadonlyArray<FiltroEstadoPick> = [
  "PENDIENTE",
  "APROBADO",
  "RECHAZADO",
  "TODOS",
];

interface PageProps {
  searchParams?: { id?: string; estado?: string };
}

export default async function PicksPremiumAdminPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/admin/picks-premium");

  const filtroEstado: FiltroEstadoPick = ESTADOS_VALIDOS.includes(
    searchParams?.estado as FiltroEstadoPick,
  )
    ? (searchParams!.estado as FiltroEstadoPick)
    : "PENDIENTE";

  const [cola, contadores, statsEditor] = await Promise.all([
    listarColaPicks({ estado: filtroEstado }),
    obtenerContadoresColaPicks(),
    obtenerStatsEditor(session.user.id),
  ]);

  const pickActivoId = searchParams?.id ?? cola[0]?.id ?? null;
  const pickActivo = pickActivoId
    ? await obtenerDetallePickAdmin(pickActivoId)
    : null;

  return (
    <>
      <AdminTopbar
        title="Picks Premium"
        description={`Validación de picks generados por Claude API · Aciertos histórico: ${
          statsEditor.porcentajeAcierto !== null
            ? `${statsEditor.porcentajeAcierto}%`
            : "—"
        } (${statsEditor.picksGanados}/${statsEditor.picksGanados + statsEditor.picksPerdidos})`}
        breadcrumbs={[{ label: "Operación" }, { label: "Picks Premium" }]}
        actions={
          <span className="hidden items-center gap-1 text-admin-meta text-muted-d md:flex">
            Atajos:
            <KbdHint>A</KbdHint> Aprobar
            <KbdHint>R</KbdHint> Rechazar
            <KbdHint>E</KbdHint> Editar
            <KbdHint>↑↓</KbdHint> Navegar
          </span>
        }
      />

      <PicksPremiumView
        cola={cola}
        pickActivo={pickActivo}
        contadores={contadores}
        statsEditor={statsEditor}
        filtroEstado={filtroEstado}
        editorEmail={session.user.email ?? ""}
      />
    </>
  );
}
