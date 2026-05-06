"use client";
// Botón "↻ Actualizar cuotas" (per-partido o global). Lote V.14.1.
//
// Click → POST /api/v1/admin/agente/sesion/iniciar → recibe URL del
// Custom URL Protocol → window.location.href = URL → Windows lanza el
// agente local → procesa los jobs → cierra solo.
//
// V.14.1: tras disparar el protocol, inicia polling cada 5s al endpoint
// `GET /agente/sesion/estado?token=xxx` para detectar cuándo el agente
// terminó. Cuando la sesión termina (jobsRestantes=0 o token expiró),
// hace `router.refresh()` automáticamente — el admin no necesita F5.
// Timeout duro 5min para abortar si algo se cuelga.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";

interface PropsPerPartido {
  scope: "partido";
  partidoId: string;
  label?: string;
  compact?: boolean;
}

interface PropsGlobal {
  scope: "global";
  partidosCount: number;
  label?: string;
  expanded?: boolean;
}

type Props = PropsPerPartido | PropsGlobal;

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1_000; // 5min

interface EstadoSesion {
  ok: boolean;
  terminada: boolean;
  jobsRestantes: number;
  jobsTotalesEnSesion: number;
  jobsProcesados: number;
}

export function CuotasRefreshBtn(props: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<{
    procesados: number;
    total: number;
  } | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadlineRef = useRef<number>(0);

  // Cleanup del interval si el componente desmonta
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  function startPolling(token: string) {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS;

    const tick = async () => {
      try {
        if (Date.now() > pollDeadlineRef.current) {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          setFeedback("⚠ El agente tomó más de 5min. Refrescá manualmente.");
          setProgreso(null);
          return;
        }
        const res = await authedFetch(
          `/api/v1/admin/agente/sesion/estado?token=${encodeURIComponent(token)}`,
        );
        if (!res.ok) {
          // No abortamos — puede ser un blip transitorio
          return;
        }
        const data = (await res.json()) as EstadoSesion;
        if (data.terminada) {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          setFeedback(`✓ Cuotas actualizadas (${data.jobsTotalesEnSesion} jobs)`);
          setProgreso(null);
          router.refresh();
          // Limpiar feedback tras 5s
          setTimeout(() => setFeedback(null), 5000);
        } else {
          setProgreso({
            procesados: data.jobsProcesados,
            total: data.jobsTotalesEnSesion,
          });
        }
      } catch {
        /* ignore — siguiente tick lo reintenta */
      }
    };

    // Tick inmediato + interval
    void tick();
    pollIntervalRef.current = setInterval(tick, POLL_INTERVAL_MS);
  }

  async function handleClick() {
    setLoading(true);
    setError(null);
    setFeedback(null);
    setProgreso(null);
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
      if (!data.urlProtocol || !data.token) {
        throw new Error("Backend no devolvió URL del protocolo o token.");
      }
      setFeedback(
        `Lanzando agente local · ${data.jobsTotales} jobs encolados...`,
      );
      // Disparar el Custom URL Protocol
      window.location.href = data.urlProtocol;
      // Iniciar polling automático del estado
      startPolling(data.token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const isPolling = pollIntervalRef.current !== null;

  if (props.scope === "global") {
    const expanded = props.expanded ?? true;
    return (
      <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
        <button
          type="button"
          className="btn btn-aprobar btn-xs"
          onClick={handleClick}
          disabled={loading || isPolling || props.partidosCount === 0}
          style={{ whiteSpace: "nowrap" }}
        >
          {loading
            ? "Lanzando..."
            : isPolling
              ? `Procesando${progreso ? ` ${progreso.procesados}/${progreso.total}` : "..."}`
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
        disabled={loading || isPolling}
        title={
          isPolling
            ? "Procesando..."
            : "Actualizar cuotas de este partido"
        }
        style={{
          whiteSpace: "nowrap",
          fontSize: compact ? 10 : 12,
          padding: compact ? "2px 6px" : "4px 10px",
        }}
      >
        {loading
          ? "..."
          : isPolling
            ? progreso
              ? `${progreso.procesados}/${progreso.total}`
              : "..."
            : props.label ?? "↻"}
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
