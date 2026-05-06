"use client";

// PartidoFiltrosCells — Lote V.14 (May 2026).
//
// Renderiza las 5 celdas de la tabla /admin/partidos en este orden:
//   1. Cuotas (estado captura + botón ↻)
//   2. Análisis Free (estado del análisis del motor de fijas)
//   3. Análisis Socios (estado del PickPremium)
//   4. Filtro 1 (toggle, disabled si faltan prerrequisitos)
//   5. Filtro 2 (toggle, bloqueado si Filtro 1 OFF)
//
// PATCH /api/v1/admin/partidos/[id]/filtros valida los prerequisitos antes
// de activar Filtro 1; si falta algo devuelve 409 con `bloqueantes`. Este
// componente muestra un mensaje claro al admin en ese caso.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";
import { CuotasCelda } from "./CuotasCelda";
import type { CuotasResumen } from "@/lib/services/admin-partidos.service";

interface Props {
  partidoId: string;
  mostrarAlPublico: boolean;
  elegibleLiga: boolean;
  estadoAnalisis: string | null;
  estadoAnalisisSocios: string | null;
  cuotas: CuotasResumen;
  filtro1Listo: boolean;
  filtro1Bloqueantes: string[];
}

type Cargando = "filtro1" | "filtro2" | null;

export function PartidoFiltrosCells({
  partidoId,
  mostrarAlPublico,
  elegibleLiga,
  estadoAnalisis,
  estadoAnalisisSocios,
  cuotas,
  filtro1Listo,
  filtro1Bloqueantes,
}: Props) {
  const router = useRouter();
  const [cargando, setCargando] = useState<Cargando>(null);
  const [optimistaF1, setOptimistaF1] = useState(mostrarAlPublico);
  const [optimistaF2, setOptimistaF2] = useState(elegibleLiga);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtro 1 está deshabilitado para ACTIVAR si no se cumplen prerequisitos.
  // Para DESACTIVAR está siempre habilitado (admin puede apagar en cualquier momento).
  const filtro1Disabled = !optimistaF1 && !filtro1Listo;

  async function toggle(filtro: "filtro1" | "filtro2") {
    if (cargando) return;
    if (filtro === "filtro2" && !optimistaF1) return;
    if (filtro === "filtro1" && filtro1Disabled) {
      setErrorMsg(
        `No se puede activar Filtro 1: ${humanBloqueantes(filtro1Bloqueantes).join(" · ")}`,
      );
      setTimeout(() => setErrorMsg(null), 5000);
      return;
    }
    setCargando(filtro);
    setErrorMsg(null);
    const nuevo = filtro === "filtro1" ? !optimistaF1 : !optimistaF2;
    if (filtro === "filtro1") setOptimistaF1(nuevo);
    else setOptimistaF2(nuevo);
    try {
      const body =
        filtro === "filtro1"
          ? { mostrarAlPublico: nuevo }
          : { elegibleLiga: nuevo };
      const res = await authedFetch(
        `/api/v1/admin/partidos/${partidoId}/filtros`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error?.message ?? `PATCH fallido (${res.status})`;
        const bloqueantes = err.error?.bloqueantes as string[] | undefined;
        if (bloqueantes && bloqueantes.length > 0) {
          setErrorMsg(`${msg} · ${humanBloqueantes(bloqueantes).join(" · ")}`);
        } else {
          setErrorMsg(msg);
        }
        setTimeout(() => setErrorMsg(null), 6000);
        throw new Error(msg);
      }
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
      <td style={{ textAlign: "center" }}>
        <CuotasCelda partidoId={partidoId} cuotas={cuotas} />
      </td>
      <td style={{ textAlign: "center" }}>
        {renderEstadoFreeCell(estadoAnalisis)}
      </td>
      <td style={{ textAlign: "center" }}>
        {renderEstadoSociosCell(estadoAnalisisSocios)}
      </td>
      <td style={{ textAlign: "center", background: "#F8FAFD" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <button
            type="button"
            onClick={() => toggle("filtro1")}
            aria-pressed={optimistaF1}
            aria-label={`${optimistaF1 ? "Desactivar" : "Activar"} Filtro 1`}
            disabled={cargando !== null || filtro1Disabled}
            title={
              filtro1Disabled
                ? `Faltan: ${humanBloqueantes(filtro1Bloqueantes).join(", ")}`
                : optimistaF1
                  ? "Click para apagar (oculta del público)"
                  : "Click para activar (visible al público)"
            }
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor:
                cargando !== null
                  ? "wait"
                  : filtro1Disabled
                    ? "not-allowed"
                    : "pointer",
              opacity: filtro1Disabled ? 0.5 : 1,
            }}
          >
            <div className={`toggle-switch ${optimistaF1 ? "on" : "off"}`}>
              <div className="toggle-thumb" />
            </div>
          </button>
          {errorMsg && (
            <span
              style={{
                fontSize: 9,
                color: "var(--pred-wrong, #dc2626)",
                maxWidth: 180,
                lineHeight: 1.2,
              }}
            >
              {errorMsg}
            </span>
          )}
        </div>
      </td>
      <td style={{ textAlign: "center", background: "#FFFAEB" }}>
        {optimistaF1 ? (
          <button
            type="button"
            onClick={() => toggle("filtro2")}
            aria-pressed={optimistaF2}
            aria-label={`${optimistaF2 ? "Desactivar" : "Activar"} Filtro 2`}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: cargando ? "wait" : "pointer",
            }}
            disabled={cargando !== null}
          >
            <div className={`toggle-switch ${optimistaF2 ? "on" : "off"}`}>
              <div className="toggle-thumb" />
            </div>
          </button>
        ) : (
          <span style={{ color: "rgba(0,16,80,.42)", fontSize: 11 }}>
            Bloqueado
          </span>
        )}
      </td>
    </>
  );
}

function renderEstadoFreeCell(estado: string | null): JSX.Element {
  if (estado === "APROBADO") return <span className="adm-pill adm-pill-green">✓ Aprobado</span>;
  if (estado === "PENDIENTE") return <span className="adm-pill adm-pill-amber">Pendiente</span>;
  if (estado === "RECHAZADO") return <span className="adm-pill adm-pill-red">Rechazado</span>;
  if (estado === "ARCHIVADO") return <span className="adm-pill adm-pill-gray">Archivado</span>;
  return <span className="adm-pill adm-pill-gray">—</span>;
}

function renderEstadoSociosCell(estado: string | null): JSX.Element {
  if (estado === "APROBADO") return <span className="adm-pill adm-pill-green">✓ Aprobado</span>;
  if (estado === "PENDIENTE") return <span className="adm-pill adm-pill-amber">Pendiente</span>;
  if (estado === "RECHAZADO") return <span className="adm-pill adm-pill-red">Rechazado</span>;
  return <span className="adm-pill adm-pill-gray">—</span>;
}

/** Convierte códigos `cuotas_no_completas:PARCIAL` a texto humano. */
function humanBloqueantes(bloqueantes: string[]): string[] {
  return bloqueantes.map((b) => {
    if (b.startsWith("cuotas_no_completas")) return "Cuotas incompletas";
    if (b.startsWith("analisis_free_no_aprobado")) return "Análisis Free sin aprobar";
    if (b === "analisis_socios_no_aprobado") return "Análisis Socios sin aprobar";
    return b;
  });
}
