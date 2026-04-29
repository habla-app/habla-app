"use client";
// Selector de rango (1d / 7d / 30d) para /admin/dashboard. Cambia el
// query string `rango` y deja que la page server-rendered re-fetchee.

import Link from "next/link";

const RANGOS: ReadonlyArray<{ key: "1d" | "7d" | "30d"; label: string }> = [
  { key: "1d", label: "Hoy" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
];

export function DashboardRangoSelector({
  rangoActual,
}: {
  rangoActual: "1d" | "7d" | "30d";
}) {
  return (
    <div
      role="group"
      aria-label="Rango de fechas"
      className="inline-flex items-center overflow-hidden rounded-sm border border-light bg-card text-[12px] font-bold"
    >
      {RANGOS.map((r) => {
        const active = r.key === rangoActual;
        return (
          <Link
            key={r.key}
            href={`/admin/dashboard?rango=${r.key}`}
            aria-current={active ? "page" : undefined}
            className={`px-3 py-1.5 uppercase tracking-[0.04em] transition-colors ${
              active
                ? "bg-brand-blue-main text-white"
                : "text-muted-d hover:bg-subtle hover:text-dark"
            }`}
          >
            {r.label}
          </Link>
        );
      })}
    </div>
  );
}
