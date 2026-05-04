"use client";
// AlertaMarcarVistaBtn — Lote V fase V.5.
//
// Botón "marcar visto" en cada fila de la sección Alertas de cambios.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";

interface Props {
  alertaId: string;
}

export function AlertaMarcarVistaBtn({ alertaId }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function ejecutar() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await authedFetch(`/api/v1/admin/motor-cuotas/alertas/${alertaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vista: true }),
      });
    } catch {
      /* fallthrough — router.refresh re-render */
    }
    setSubmitting(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void ejecutar()}
      disabled={submitting}
      className="btn btn-ghost btn-xs"
      style={{ fontSize: 11 }}
    >
      {submitting ? "…" : "marcar visto"}
    </button>
  );
}
