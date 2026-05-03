// /admin/picks — Lote O (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-picks (líneas 6898-7105).
//
// Renombre del legacy /admin/picks-premium con tabs Free/Socios. Cubre
// validación humana de los dos entregables del v3.2 por partido:
//   - Análisis Free (AnalisisPartido del Lote L)
//   - Análisis Socios (PickPremium del Lote E, mantiene flujo de canal)
//
// Cero auto-publicación: la aprobación es siempre humana. Auditoría 100%
// vía endpoints /api/v1/admin/partidos/[id]/{aprobar,rechazar}-analisis y
// /api/v1/admin/picks-premium/[id]/{aprobar,rechazar}.

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  listarColaPartidosV32,
  obtenerContadoresColaV32,
  obtenerDetallePartidoCola,
  type FiltroEstadoCola,
} from "@/lib/services/admin-cola-validacion.service";
import { PicksColaViewV32 } from "@/components/admin/picks/PicksColaViewV32";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cola de validación · Admin Habla!" };

const ESTADOS_VALIDOS: ReadonlyArray<FiltroEstadoCola> = [
  "PENDIENTE",
  "APROBADO",
  "RECHAZADO",
  "TODOS",
];

interface PageProps {
  searchParams?: { id?: string; estado?: string };
}

export default async function AdminPicksPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/admin/picks");

  const filtroEstado: FiltroEstadoCola = ESTADOS_VALIDOS.includes(
    searchParams?.estado as FiltroEstadoCola,
  )
    ? (searchParams!.estado as FiltroEstadoCola)
    : "PENDIENTE";

  const [cola, contadores] = await Promise.all([
    listarColaPartidosV32({ estado: filtroEstado }),
    obtenerContadoresColaV32(),
  ]);

  const partidoActivoId = searchParams?.id ?? cola[0]?.partidoId ?? null;
  const detalle = partidoActivoId ? await obtenerDetallePartidoCola(partidoActivoId) : null;

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-breadcrumbs">
          <span>Inicio</span>
          <span>Motor de Fijas</span>
          <span>Cola de validación</span>
        </div>
        <div className="admin-topbar-row">
          <div>
            <h1 className="admin-page-title">Cola de validación</h1>
            <p className="admin-page-subtitle">
              Análisis Free (1X2) + Análisis Socios (combinada) por cada partido del Filtro 1. La redacción es lo único editable.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "rgba(0,16,80,.58)" }}>
            Editor: <strong style={{ color: "#001050" }}>{session.user.email}</strong>
            <span className="adm-pill adm-pill-green">Hoy: {contadores.aprobados} aprobados</span>
          </div>
        </div>
      </div>

      <PicksColaViewV32
        cola={cola}
        detalle={detalle}
        contadores={contadores}
        filtroEstado={filtroEstado}
      />
    </>
  );
}
