"use client";
// ReDiscoveryBtn — Lote V fase V.6.
//
// Botón "🔍 Re-ejecutar discovery" del header de la sección Captura de
// cuotas. Llama al endpoint POST /admin/partidos/[id]/cuotas/discovery
// vía authedFetch (regla 9). Al terminar, hace router.refresh() para que
// la sección se re-renderice con los eventIds nuevos visibles.
//
// Feedback inline al lado del botón (no toasts — la vista admin no usa
// toasts en otros botones de esta sección, ver RefreshPartidoBtn).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";

interface Props {
  partidoId: string;
}

interface Resumen {
  resueltas?: { casa: string }[];
  sinResolver?: string[];
  fallidas?: { casa: string }[];
  skipeadasPorManual?: string[];
  skipeadasPorAutomaticoPrevio?: string[];
}

export function ReDiscoveryBtn({ partidoId }: Props) {
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
        `/api/v1/admin/partidos/${partidoId}/cuotas/discovery`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = (await resp.json().catch(() => null)) as
        | (Resumen & { error?: { message?: string } })
        | null;
      if (!resp.ok) {
        setError(
          data?.error?.message ?? "No se pudo ejecutar discovery.",
        );
        setSubmitting(false);
        return;
      }
      const r = (data?.resueltas?.length as number | undefined) ?? 0;
      const s = (data?.sinResolver?.length as number | undefined) ?? 0;
      const f = (data?.fallidas?.length as number | undefined) ?? 0;
      const m = (data?.skipeadasPorManual?.length as number | undefined) ?? 0;
      const partes = [`${r} resueltas`];
      if (s > 0) partes.push(`${s} sin resolver`);
      if (f > 0) partes.push(`${f} con error`);
      if (m > 0) partes.push(`${m} manual`);
      setResultado(partes.join(" · "));
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
        title="Re-ejecuta discovery automático sobre las 7 casas. Respeta MANUAL."
      >
        {submitting ? "Buscando…" : "🔍 Re-ejecutar discovery"}
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
