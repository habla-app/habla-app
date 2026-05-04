"use client";
// RefreshCasaBtn — Lote V fase V.5.
//
// Botón ↻ por casa en la sección "Captura de cuotas" del admin partido.
// Encola un job individual para esa casa via authedFetch.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";

interface Props {
  partidoId: string;
  casa: string;
  /** Si está desactivado (sin event ID), el botón muestra estado pero
   *  igual permite click — el endpoint devuelve 422 explícito. */
  disabled?: boolean;
}

export function RefreshCasaBtn({ partidoId, casa, disabled }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function ejecutar() {
    if (submitting || disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      const resp = await authedFetch(
        `/api/v1/admin/partidos/${partidoId}/cuotas/refresh-casa`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ casa }),
        },
      );
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        setError(
          (data?.error?.message as string | undefined) ??
            "No se pudo encolar el refresh.",
        );
        setSubmitting(false);
        return;
      }
    } catch {
      setError("Error de red.");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    router.refresh();
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button
        type="button"
        onClick={() => void ejecutar()}
        disabled={submitting || disabled}
        className="btn btn-ghost btn-xs"
        style={{
          fontSize: 12,
          opacity: submitting || disabled ? 0.5 : 1,
          cursor: submitting || disabled ? "not-allowed" : "pointer",
        }}
        title="Forzar refresh de esta casa"
      >
        {submitting ? "…" : "↻"}
      </button>
      {error ? (
        <span style={{ fontSize: 11, color: "var(--pred-wrong)" }}>
          {error}
        </span>
      ) : null}
    </span>
  );
}
