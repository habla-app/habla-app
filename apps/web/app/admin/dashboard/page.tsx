// /admin/dashboard — Lote O (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-dashboard (líneas 4938-5278).
// HTML idéntico al mockup, clases del mockup que viven en
// `apps/web/app/mockup-styles.css` desde el Lote R.
//
// 6 secciones KPI ordenadas igual que el mockup:
//   1. 📥 Captación (4 KPIs)
//   2. ⚡ Productos B y C (4 KPIs)
//   3. 🎯 Conversión (4 KPIs)
//   4. 🔄 Retención (4 KPIs)
//   5. 🤖 Motor de fijas (8 KPIs · drill-down a /admin/motor)
//   6. 🏆 Liga Habla! (4 KPIs)
//
// Las 4 primeras vienen de los servicios existentes (Lote F). Las 2
// nuevas (Motor + Liga) se agregaron en `admin-kpis.service.ts` para el
// Lote O. La sección "Económicos" del Lote F NO existe en el mockup — se
// quita del dashboard (sigue accesible vía /admin/finanzas).

import {
  obtenerAlarmasActivas,
  obtenerKpisCaptacion,
  obtenerKpisConversion,
  obtenerKpisLiga,
  obtenerKpisMotor,
  obtenerKpisProductos,
  obtenerKpisRetencion,
  type Rango,
} from "@/lib/services/admin-kpis.service";
import { AlarmaBanner } from "@/components/admin/dashboard/AlarmaBanner";
import { KPISeccion } from "@/components/admin/dashboard/KPISeccion";
import { RangoSelector } from "@/components/admin/dashboard/RangoSelector";

export const dynamic = "force-dynamic";

const RANGOS_VALIDOS: ReadonlyArray<Rango> = ["7d", "30d", "mes_actual", "mes_anterior"];

interface PageProps {
  searchParams?: { rango?: string };
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const rango: Rango = RANGOS_VALIDOS.includes(searchParams?.rango as Rango)
    ? (searchParams!.rango as Rango)
    : "30d";

  const [captacion, productos, conversion, retencion, motor, liga, alarmas] =
    await Promise.all([
      obtenerKpisCaptacion(rango),
      obtenerKpisProductos(rango),
      obtenerKpisConversion(rango),
      obtenerKpisRetencion(rango),
      obtenerKpisMotor(rango),
      obtenerKpisLiga(rango),
      obtenerAlarmasActivas(),
    ]);

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-breadcrumbs">
          <span>Inicio</span>
          <span>Dashboard</span>
        </div>
        <div className="admin-topbar-row">
          <div>
            <h1 className="admin-page-title">Dashboard</h1>
            <p className="admin-page-subtitle">Vista global · KPIs estratégicos del negocio</p>
          </div>
          <RangoSelector rangoActual={rango} />
        </div>
      </div>

      <AlarmaBanner alarmas={alarmas} />

      <KPISeccion grupo={captacion} meta="Etapas 0-2 del embudo" />
      <KPISeccion grupo={productos} meta="Engagement · Sincronía B↔C" />
      <KPISeccion grupo={conversion} meta="Pasos críticos del embudo" />
      <KPISeccion grupo={retencion} />
      <KPISeccion grupo={motor} meta="Salud del sistema automático de análisis" drillDownHref="/admin/motor" />
      <KPISeccion grupo={liga} meta="Engagement gamificación · partidos elegibles" />
    </>
  );
}
