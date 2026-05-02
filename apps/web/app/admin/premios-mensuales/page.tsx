// /admin/premios-mensuales — herramienta interna (Lote 5).
//
// Lista los registros PremioMensual creados al cerrar leaderboards. Filtros
// por estado (PENDIENTE | COORDINADO | PAGADO | CANCELADO) y por mes.
// Cada fila tiene CRUD inline (estado + datosPago + notas) y un botón
// "Copiar template" con el texto canónico de respuesta para que Gustavo
// conteste el email del ganador desde Resend.
//
// Lote 5.1: auth y shell visual viven en admin/layout.tsx; esta page sólo
// renderiza header + panel client.

import {
  listarPremios,
  PREMIO_PRIMER_PUESTO,
  type EstadoPremio,
  esEstadoValido,
} from "@/lib/services/leaderboard.service";
import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import { AdminPremiosMensualesPanel } from "@/components/admin/AdminPremiosMensualesPanel";

export const dynamic = "force-dynamic";

interface Props {
  searchParams?: { estado?: string; mes?: string };
}

export default async function AdminPremiosMensualesPage({
  searchParams,
}: Props) {
  const estado: EstadoPremio | undefined =
    searchParams?.estado && esEstadoValido(searchParams.estado)
      ? searchParams.estado
      : undefined;
  const mes = searchParams?.mes;

  const premios = await listarPremios({ estado, mes });

  return (
    <>
      <AdminTopbar
        title="Premios mensuales"
        description="Top 10 del leaderboard · Flujo guiado: solicitar datos → marcar pagado → adjuntar comprobante. Cada acción queda en auditoría."
        breadcrumbs={[{ label: "Operación" }, { label: "Premios mensuales" }]}
      />
      <AdminPremiosMensualesPanel
        premios={premios.map((p) => ({
          ...p,
          // pasamos `creadoEn` y `pagadoEn` como ISO strings para evitar
          // problemas de serialización entre RSC y Client Component.
          creadoEn: p.creadoEn.toISOString(),
          pagadoEn: p.pagadoEn ? p.pagadoEn.toISOString() : null,
        }))}
        filtroEstado={estado ?? "TODOS"}
        filtroMes={mes ?? ""}
        premioPrimerPuesto={PREMIO_PRIMER_PUESTO}
      />
    </>
  );
}
