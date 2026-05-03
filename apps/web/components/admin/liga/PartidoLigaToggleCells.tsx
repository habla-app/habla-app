"use client";

// PartidoLigaToggleCells — Lote O (May 2026): celdas client del listado de
// /admin/liga-admin. Replica el toggle "Visible al público" + las acciones
// "Sacar de Liga" / "Forzar visible" del mockup.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";

interface Props {
  partidoId: string;
  visible: boolean;
  visibilidadOverride: "forzar_visible" | "forzar_oculto" | null;
  combinadas: number;
  estadoMatch: "PROGRAMADO" | "EN_VIVO" | "FINALIZADO";
}

export function PartidoLigaToggleCells({
  partidoId,
  visible,
  visibilidadOverride,
  combinadas,
  estadoMatch,
}: Props) {
  const router = useRouter();
  const [optimista, setOptimista] = useState(visible);
  const [override, setOverride] = useState(visibilidadOverride);
  const [cargando, setCargando] = useState(false);

  async function patchOverride(nuevo: "forzar_visible" | "forzar_oculto" | null) {
    if (cargando) return;
    setCargando(true);
    setOverride(nuevo);
    if (nuevo === "forzar_visible") setOptimista(true);
    if (nuevo === "forzar_oculto") setOptimista(false);
    if (nuevo === null) setOptimista(visible);
    try {
      const res = await authedFetch(`/api/v1/admin/partidos/${partidoId}/filtros`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibilidadOverride: nuevo }),
      });
      if (!res.ok) throw new Error("Falló");
      router.refresh();
    } catch {
      setOptimista(visible);
      setOverride(visibilidadOverride);
    } finally {
      setCargando(false);
    }
  }

  async function sacarDeLiga() {
    if (cargando) return;
    if (!confirm("¿Sacar este partido de la Liga Habla! del mes? Esta acción es irreversible para el ranking del mes.")) return;
    setCargando(true);
    try {
      const res = await authedFetch(`/api/v1/admin/partidos/${partidoId}/filtros`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elegibleLiga: false }),
      });
      if (!res.ok) throw new Error("Falló");
      router.refresh();
    } catch {
      // noop
    } finally {
      setCargando(false);
    }
  }

  const estadoBadge =
    estadoMatch === "EN_VIVO" ? (
      <span className="adm-pill adm-pill-blue">En curso</span>
    ) : estadoMatch === "FINALIZADO" ? (
      <span className="adm-pill adm-pill-gray">Terminado</span>
    ) : optimista ? (
      <span className="adm-pill adm-pill-green">Visible</span>
    ) : (
      <span className="adm-pill adm-pill-gray">Falta &gt;7 días</span>
    );

  return (
    <>
      <td style={{ textAlign: "center" }}>
        <button
          type="button"
          onClick={() => patchOverride(optimista ? "forzar_oculto" : "forzar_visible")}
          aria-pressed={optimista}
          aria-label={`${optimista ? "Ocultar" : "Hacer visible"} en Liga`}
          style={{ background: "transparent", border: "none", padding: 0, cursor: cargando ? "wait" : "pointer" }}
          disabled={cargando}
        >
          <div className={`toggle-switch ${optimista ? "on" : "off"}`}>
            <div className="toggle-thumb" />
          </div>
        </button>
        {override && (
          <div style={{ fontSize: 9, color: "rgba(0,16,80,.42)", marginTop: 4 }}>(forzado)</div>
        )}
      </td>
      <td style={{ textAlign: "center", fontWeight: 700 }}>
        {combinadas > 0 ? combinadas.toLocaleString("es-PE") : <span style={{ color: "rgba(0,16,80,.42)" }}>—</span>}
      </td>
      <td style={{ textAlign: "center" }}>{estadoBadge}</td>
      <td>
        {!optimista && override !== "forzar_visible" ? (
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={() => patchOverride("forzar_visible")}
            disabled={cargando}
          >
            Forzar visible
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-rechazar btn-xs"
            onClick={sacarDeLiga}
            disabled={cargando}
          >
            Sacar de Liga
          </button>
        )}
      </td>
    </>
  );
}
