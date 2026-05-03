"use client";

// EmbudoRangoSelector — Lote P (May 2026): rango selector literal del
// mockup `.admin-rango-selector` para `/admin/embudo`.
// Botones: 7d / 30d / Mes actual / 90d. Push de query param `rango`.

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import type { RangoEmbudo } from "@/lib/services/embudo.service";

const OPCIONES: ReadonlyArray<{ value: RangoEmbudo; label: string }> = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "mes_actual", label: "Mes actual" },
  { value: "90d", label: "90d" },
];

interface Props {
  rangoActual: RangoEmbudo;
}

export function EmbudoRangoSelector({ rangoActual }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const cambiar = (nuevo: RangoEmbudo) => {
    if (nuevo === rangoActual) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("rango", nuevo);
    startTransition(() => {
      router.push(`/admin/embudo?${params.toString()}`);
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
