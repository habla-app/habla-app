// /admin/partidos/[id] — Lote V fase V.5 (May 2026).
//
// Vista detalle de un partido en admin. Por ahora se enfoca en la sección
// "Captura de cuotas" del Lote V (con sus 7 bloques + alertas). Puede
// extenderse en lotes futuros con el detalle de filtros, análisis, etc.
//
// Server component. Reutiliza shell de AdminLayoutShell del Lote O.

import { notFound } from "next/navigation";

import { prisma } from "@habla/db";
import { CapturaCuotasSection } from "@/components/admin/cuotas/CapturaCuotasSection";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
  searchParams?: { alertas?: string; noVistas?: string };
}

const LIMA_TZ = "America/Lima";

function fechaLima(d: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: LIMA_TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export async function generateMetadata({ params }: PageProps) {
  const partido = await prisma.partido.findUnique({
    where: { id: params.id },
    select: { equipoLocal: true, equipoVisita: true },
  });
  if (!partido) return { title: "Partido · Admin Habla!" };
  return {
    title: `${partido.equipoLocal} vs ${partido.equipoVisita} · Admin Habla!`,
  };
}

export default async function AdminPartidoDetalle({ params, searchParams }: PageProps) {
  const partido = await prisma.partido.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      liga: true,
      equipoLocal: true,
      equipoVisita: true,
      fechaInicio: true,
      estado: true,
      mostrarAlPublico: true,
      elegibleLiga: true,
    },
  });
  if (!partido) notFound();

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-breadcrumbs">
          <span>Inicio</span>
          <span>Motor de Fijas</span>
          <a href="/admin/partidos">Partidos</a>
          <span>Detalle</span>
        </div>
        <div className="admin-topbar-row">
          <div>
            <h1 className="admin-page-title">
              {partido.equipoLocal} vs {partido.equipoVisita}
            </h1>
            <p className="admin-page-subtitle">
              {partido.liga} · {fechaLima(partido.fechaInicio)} · Estado:{" "}
              {partido.estado}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/admin/partidos" className="btn btn-ghost btn-xs">
              ← Volver al listado
            </a>
            <a
              href="/admin/motor-cuotas"
              className="btn btn-ghost btn-xs"
            >
              📊 Motor de cuotas
            </a>
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,16,80,.06)",
          borderRadius: 8,
          padding: 16,
          marginBottom: 12,
          fontSize: 12,
          color: "var(--text-muted-d)",
          display: "flex",
          gap: 18,
        }}
      >
        <span>
          <strong style={{ color: "var(--text-dark)" }}>Filtro 1:</strong>{" "}
          {partido.mostrarAlPublico ? "ON · visible al público" : "OFF · oculto"}
        </span>
        <span>
          <strong style={{ color: "var(--text-dark)" }}>Filtro 2:</strong>{" "}
          {partido.elegibleLiga ? "ON · elegible Liga" : "OFF · no elegible"}
        </span>
      </div>

      <CapturaCuotasSection
        partidoId={partido.id}
        searchParams={searchParams}
      />
    </>
  );
}
