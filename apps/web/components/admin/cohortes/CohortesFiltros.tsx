"use client";

// CohortesFiltros — Lote P (May 2026): filtros literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-cohortes (líneas 7411-7423).
// Dos `<select class="admin-filter-select">`: métrica + granularidad.

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, type ChangeEvent } from "react";

import type { MetricaCohorteSemanal, GranularidadCohorte } from "@/lib/services/cohortes-semanal.service";

interface Props {
  metricaActual: MetricaCohorteSemanal;
  granularidadActual: GranularidadCohorte;
}

const METRICAS: ReadonlyArray<{ value: MetricaCohorteSemanal; label: string }> = [
  { value: "retention", label: "Métrica: Retention" },
  { value: "ftd", label: "Métrica: Conversion to FTD" },
  { value: "socios", label: "Métrica: Conversion to Socios" },
];

const GRANULARIDAD: ReadonlyArray<{ value: GranularidadCohorte; label: string }> = [
  { value: "semanal", label: "Granularidad: Semanal" },
  { value: "diaria", label: "Granularidad: Diaria" },
  { value: "mensual", label: "Granularidad: Mensual" },
];

export function CohortesFiltros({ metricaActual, granularidadActual }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const cambiar = (key: "metrica" | "granularidad", value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set(key, value);
    startTransition(() => {
      router.push(`/admin/cohortes?${params.toString()}`);
    });
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <select
        className="admin-filter-select"
        value={metricaActual}
        disabled={pending}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => cambiar("metrica", e.target.value)}
      >
        {METRICAS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <select
        className="admin-filter-select"
        value={granularidadActual}
        disabled={pending}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => cambiar("granularidad", e.target.value)}
      >
        {GRANULARIDAD.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>
    </div>
  );
}
