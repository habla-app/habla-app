"use client";

// PartidoFiltrosCells — Lote O (May 2026): toggle controles para Filtro 1
// y Filtro 2 en la fila de /admin/partidos. Replica el mockup
// `docs/habla-mockup-v3.2.html` § admin-page-partidos: cada toggle es un
// `<div class="toggle-switch on/off"><div class="toggle-thumb"/></div>`.
// Hace PATCH /api/v1/admin/partidos/[id]/filtros tras el click y refresca
// la vista con `router.refresh()`.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";

interface PartidoFiltrosCellsProps {
  partidoId: string;
  mostrarAlPublico: boolean;
  elegibleLiga: boolean;
  estadoAnalisis: string | null;
}

type Cargando = "filtro1" | "filtro2" | null;

export function PartidoFiltrosCells({
  partidoId,
  mostrarAlPublico,
  elegibleLiga,
  estadoAnalisis,
}: PartidoFiltrosCellsProps) {
  const router = useRouter();
  const [cargando, setCargando] = useState<Cargando>(null);
  const [optimistaF1, setOptimistaF1] = useState(mostrarAlPublico);
  const [optimistaF2, setOptimistaF2] = useState(elegibleLiga);

  async function toggle(filtro: "filtro1" | "filtro2") {
    if (cargando) return;
    if (filtro === "filtro2" && !optimistaF1) return;
    setCargando(filtro);
    const nuevo = filtro === "filtro1" ? !optimistaF1 : !optimistaF2;
    if (filtro === "filtro1") setOptimistaF1(nuevo);
    else setOptimistaF2(nuevo);
    try {
      const body =
        filtro === "filtro1"
          ? { mostrarAlPublico: nuevo }
          : { elegibleLiga: nuevo };
      const res = await authedFetch(`/api/v1/admin/partidos/${partidoId}/filtros`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("PATCH fallido");
      router.refresh();
    } catch {
      if (filtro === "filtro1") setOptimistaF1(!nuevo);
      else setOptimistaF2(!nuevo);
    } finally {
      setCargando(null);
    }
  }

  return (
    <>
      <td style={{ textAlign: "center", background: "#F8FAFD" }}>
        <button
          type="button"
          onClick={() => toggle("filtro1")}
          aria-pressed={optimistaF1}
          aria-label={`${optimistaF1 ? "Desactivar" : "Activar"} Filtro 1`}
          style={{ background: "transparent", border: "none", padding: 0, cursor: cargando ? "wait" : "pointer" }}
          disabled={cargando !== null}
        >
          <div className={`toggle-switch ${optimistaF1 ? "on" : "off"}`}>
            <div className="toggle-thumb" />
          </div>
        </button>
      </td>
      <td style={{ textAlign: "center" }}>{renderEstadoFreeCell(estadoAnalisis, optimistaF1)}</td>
      <td style={{ textAlign: "center" }}>{renderEstadoSociosCell(estadoAnalisis, optimistaF1)}</td>
      <td style={{ textAlign: "center", background: "#FFFAEB" }}>
        {optimistaF1 ? (
          <button
            type="button"
            onClick={() => toggle("filtro2")}
            aria-pressed={optimistaF2}
            aria-label={`${optimistaF2 ? "Desactivar" : "Activar"} Filtro 2`}
            style={{ background: "transparent", border: "none", padding: 0, cursor: cargando ? "wait" : "pointer" }}
            disabled={cargando !== null}
          >
            <div className={`toggle-switch ${optimistaF2 ? "on" : "off"}`}>
              <div className="toggle-thumb" />
            </div>
          </button>
        ) : (
          <span style={{ color: "rgba(0,16,80,.42)", fontSize: 11 }}>Bloqueado</span>
        )}
      </td>
    </>
  );
}

function renderEstadoFreeCell(estado: string | null, filtro1Activo: boolean): JSX.Element {
  if (!filtro1Activo) return <span className="adm-pill adm-pill-gray">—</span>;
  if (estado === "APROBADO") return <span className="adm-pill adm-pill-green">✓ Listo</span>;
  if (estado === "PENDIENTE") return <span className="adm-pill adm-pill-amber">Pendiente</span>;
  if (estado === "RECHAZADO") return <span className="adm-pill adm-pill-red">Sin análisis</span>;
  if (estado === "ARCHIVADO") return <span className="adm-pill adm-pill-gray">Archivado</span>;
  return <span className="adm-pill adm-pill-red">Sin análisis</span>;
}

function renderEstadoSociosCell(estado: string | null, filtro1Activo: boolean): JSX.Element {
  if (!filtro1Activo) return <span className="adm-pill adm-pill-gray">—</span>;
  if (estado === "APROBADO") return <span className="adm-pill adm-pill-green">✓ Aprobado</span>;
  if (estado === "PENDIENTE") return <span className="adm-pill adm-pill-amber">Pendiente</span>;
  if (estado === "RECHAZADO") return <span className="adm-pill adm-pill-red">Sin pick</span>;
  if (estado === "ARCHIVADO") return <span className="adm-pill adm-pill-gray">Archivado</span>;
  return <span className="adm-pill adm-pill-red">Sin pick</span>;
}
