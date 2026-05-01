// /admin/dashboard — vista raíz del admin. Lote F (May 2026).
//
// Reemplaza al dashboard del Lote 6 (que era genérico: visitas/signups/errores).
// V3.1 organiza KPIs en 5 categorías canónicas con sistema semáforo
// (verde/ámbar/rojo) según target del plan de negocios v3.1.
//
// Las 5 categorías cargan en paralelo. Si alguna query falla, su KPI
// muestra "—" + status neutral (graceful degradation).

import {
  obtenerAlarmasActivas,
  obtenerKpisCaptacion,
  obtenerKpisConversion,
  obtenerKpisEconomicos,
  obtenerKpisProductos,
  obtenerKpisRetencion,
  type Rango,
} from "@/lib/services/admin-kpis.service";
import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import { AlarmaBanner } from "@/components/admin/dashboard/AlarmaBanner";
import { KPISeccion } from "@/components/admin/dashboard/KPISeccion";
import { RangoSelector } from "@/components/admin/dashboard/RangoSelector";

export const dynamic = "force-dynamic";

const RANGOS_VALIDOS: ReadonlyArray<Rango> = [
  "7d",
  "30d",
  "mes_actual",
  "mes_anterior",
];

interface PageProps {
  searchParams?: { rango?: string };
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const rango: Rango = RANGOS_VALIDOS.includes(searchParams?.rango as Rango)
    ? (searchParams!.rango as Rango)
    : "30d";

  const [captacion, productos, conversion, retencion, economicos, alarmas] =
    await Promise.all([
      obtenerKpisCaptacion(rango),
      obtenerKpisProductos(rango),
      obtenerKpisConversion(rango),
      obtenerKpisRetencion(rango),
      obtenerKpisEconomicos(rango),
      obtenerAlarmasActivas(),
    ]);

  return (
    <>
      <AdminTopbar
        title="Dashboard"
        description="Vista global · KPIs estratégicos del negocio"
        breadcrumbs={[{ label: "Inicio" }, { label: "Dashboard" }]}
        actions={<RangoSelector rangoActual={rango} />}
      />

      <AlarmaBanner alarmas={alarmas} />

      <KPISeccion grupo={captacion} />
      <KPISeccion grupo={productos} />
      <KPISeccion grupo={conversion} />
      <KPISeccion grupo={retencion} />
      <KPISeccion grupo={economicos} />
    </>
  );
}
