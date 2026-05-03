"use client";

// KpisRangoSelector — Lote P (May 2026): rango selector literal del
// mockup `.admin-rango-selector` para `/admin/kpis`.
// Botones: 7d / 30d / 90d / 12m. Push de query param `rango`.

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import type { RangoKpi } from "@/lib/services/kpis-free-premium.service";

const OPCIONES: ReadonlyArray<{ value: RangoKpi; label: string }> = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "12m", label: "12m" },
];

interface Props {
  rangoActual: RangoKpi;
}

export function KpisRangoSelector({ rangoActual }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const cambiar = (nuevo: RangoKpi) => {
    if (nuevo === rangoActual) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("rango", nuevo);
    startTransition(() => {
      router.push(`/admin/kpis?${params.toString()}`);
    });
  };

  return (
    <div className="admin-rango-selector">
      {OPCIONES.map((o) => (
        <button
          type="button"
          key={o.value}
          className={`admin-rango-btn${o.value === rangoActual ? " active" : ""}`}
          onClick={() => cambiar(o.value)}
          disabled={pending}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
