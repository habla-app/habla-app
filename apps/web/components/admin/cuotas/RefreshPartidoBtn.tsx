"use client";
// RefreshPartidoBtn — Lote V fase V.5.
//
// Botón "Forzar refresh ahora" del header de la sección Captura de cuotas.
// Encola los 7 scrapers para el partido vía authedFetch.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";

interface Props {
  partidoId: string;
}

export function RefreshPartidoBtn({ partidoId }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function ejecutar() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setResultado(null);
    try {
      const resp = await authedFetch(
        `/api/v1/admin/partidos/${partidoId}/cuotas/refresh`,
        { method: "POST" },
      );
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        setError(
          (data?.error?.message as string | undefined) ??
            "No se pudo encolar el refresh global.",
        );
        setSubmitting(false);
        return;
      }
      const enc = (data?.casasEncoladas as number | undefined) ?? 0;
      const sin = (data?.casasSinEventId as number | undefined) ?? 0;
      setResultado(
        `${enc} encoladas${sin > 0 ? ` · ${sin} sin event ID` : ""}`,
      );
    } catch {
      setError("Error de red.");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    router.refresh();
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        onClick={() => void ejecutar()}
        disabled={submitting}
        className="btn btn-ghost btn-xs"
      >
        {submitting ? "Encolando…" : "↻ Forzar refresh ahora"}
      </button>
      {resultado ? (
        <span style={{ fontSize: 11, color: "var(--pred-right)" }}>
          {resultado}
        </span>
      ) : null}
      {error ? (
        <span style={{ fontSize: 11, color: "var(--pred-wrong)" }}>
          {error}
        </span>
      ) : null}
    </span>
  );
}
