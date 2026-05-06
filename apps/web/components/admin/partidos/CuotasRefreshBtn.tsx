"use client";
// Botón "↻ Actualizar cuotas" (per-partido o global). Lote V.14.
//
// Click → POST /api/v1/admin/agente/sesion/iniciar → recibe URL del
// Custom URL Protocol → window.location.href = URL → Windows lanza el
// agente local → procesa los jobs → cierra solo.
//
// Mientras el agente procesa, este componente NO bloquea la UI; el admin
// puede pulsar otros botones o navegar. La actualización de la fila se
// refleja después con `router.refresh()` cuando el admin recarga la vista.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";

interface PropsPerPartido {
  scope: "partido";
  partidoId: string;
  /** Texto del botón. Default "↻". */
  label?: string;
  /** Estilo compacto en celda de tabla. */
  compact?: boolean;
}

interface PropsGlobal {
  scope: "global";
  partidosCount: number;
  /** Texto del botón. */
  label?: string;
  /** Si true, muestra label + count (ej. "Actualizar todos los partidos con Filtro 1 (3)") */
  expanded?: boolean;
}

type Props = PropsPerPartido | PropsGlobal;

export function CuotasRefreshBtn(props: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const body =
        props.scope === "partido"
          ? { scope: "partido", partidoId: props.partidoId }
          : { scope: "global" };
      const res = await authedFetch("/api/v1/admin/agente/sesion/iniciar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        token?: string;
        urlProtocol?: string;
        partidoIds?: string[];
        jobsTotales?: number;
        mensaje?: string;
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        throw new Error(data.error?.message ?? `HTTP ${res.status}`);
      }
      if (data.jobsTotales === 0) {
        setFeedback(data.mensaje ?? "No hay jobs para procesar.");
        return;
      }
      if (!data.urlProtocol) {
        throw new Error("Backend no devolvió URL del protocolo.");
      }
      // Disparar el Custom URL Protocol — Windows abre el agente.
      // Browser puede mostrar un prompt "¿Permitís abrir esta app?" la
      // primera vez. Después de aceptarlo no vuelve a preguntar.
      setFeedback(
        `✓ ${data.jobsTotales} jobs encolados. Lanzando agente local...`,
      );
      window.location.href = data.urlProtocol;
      // Tras 6s, refrescar la vista para que el admin vea los cambios
      // cuando el agente termine (pollea el polling del backend).
      setTimeout(() => {
        router.refresh();
      }, 6000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (props.scope === "global") {
    const expanded = props.expanded ?? true;
    return (
      <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
        <button
          type="button"
          className="btn btn-aprobar btn-xs"
          onClick={handleClick}
          disabled={loading || props.partidosCount === 0}
          style={{ whiteSpace: "nowrap" }}
        >
          {loading
            ? "Lanzando..."
            : expanded
              ? `↻ Actualizar todos los partidos con Filtro 1 (${props.partidosCount})`
              : props.label ?? `↻ Actualizar (${props.partidosCount})`}
        </button>
        {feedback && (
          <span style={{ fontSize: 11, color: "#0052CC" }}>{feedback}</span>
        )}
        {error && (
          <span style={{ fontSize: 11, color: "var(--pred-wrong, #dc2626)" }}>
            {error}
          </span>
        )}
      </div>
    );
  }

  const compact = props.compact ?? true;
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={handleClick}
        disabled={loading}
        title="Actualizar cuotas de este partido"
        style={{
          whiteSpace: "nowrap",
          fontSize: compact ? 10 : 12,
          padding: compact ? "2px 6px" : "4px 10px",
        }}
      >
        {loading ? "..." : props.label ?? "↻"}
      </button>
      {feedback && (
        <span style={{ fontSize: 9, color: "#0052CC" }}>{feedback}</span>
      )}
      {error && (
        <span style={{ fontSize: 9, color: "var(--pred-wrong, #dc2626)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
