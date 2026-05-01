"use client";

// FiltrosTabs — tabs horizontales con scroll-x para /mis-predicciones.
// Spec: docs/ux-spec/03-pista-usuario-autenticada/mis-predicciones.spec.md.
//
// 5 tabs: Todas | Mes en curso | Ganadas | Pendientes | Falladas. El estado
// vive en URL via `?tab=...` para que la navegación SSR funcione bien con
// router.refresh() y server components. Cada tab muestra el count entre
// paréntesis cuando está disponible.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export type MisPrediccionesTab =
  | "todas"
  | "mes-actual"
  | "ganadas"
  | "pendientes"
  | "falladas";

interface FiltrosTabsProps {
  active: MisPrediccionesTab;
  counts: Partial<Record<MisPrediccionesTab, number>>;
}

const TABS: ReadonlyArray<{ id: MisPrediccionesTab; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "mes-actual", label: "Mes en curso" },
  { id: "ganadas", label: "Ganadas" },
  { id: "pendientes", label: "Pendientes" },
  { id: "falladas", label: "Falladas" },
];

export function FiltrosTabs({ active, counts }: FiltrosTabsProps) {
  const searchParams = useSearchParams();

  function buildHref(tab: MisPrediccionesTab): string {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (tab === "todas") params.delete("tab");
    else params.set("tab", tab);
    params.delete("page");
    const qs = params.toString();
    return `/mis-predicciones${qs ? `?${qs}` : ""}`;
  }

  return (
    <nav
      aria-label="Filtros de predicciones"
      className="sticky top-14 z-sticky border-b border-light bg-card px-4 py-2"
    >
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => {
          const isActive = active === t.id;
          const count = counts[t.id];
          return (
            <Link
              key={t.id}
              href={buildHref(t.id)}
              className={cn(
                "touch-target inline-flex items-center whitespace-nowrap rounded-full border px-3.5 text-label-md font-bold transition-colors",
                isActive
                  ? "border-brand-blue-dark bg-brand-blue-dark text-white"
                  : "border-light bg-subtle text-dark hover:border-brand-blue-main",
              )}
            >
              {t.label}
              {count !== undefined ? ` (${count})` : ""}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
