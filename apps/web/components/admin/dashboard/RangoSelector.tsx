"use client";

// RangoSelector — selector de rango temporal para el dashboard. Lote F.
// Spec: docs/ux-spec/05-pista-admin-operacion/dashboard.spec.md.
//
// 4 presets canónicos: Últimos 7 / Últimos 30 / Mes en curso / Mes anterior.
// Estado en URL param `?rango=...` para que el rango sea linkeable +
// bookmark-able.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Rango } from "@/lib/services/admin-kpis.service";
import { cn } from "@/lib/utils/cn";

const PRESETS: ReadonlyArray<{ value: Rango; label: string }> = [
  { value: "7d", label: "Últimos 7d" },
  { value: "30d", label: "Últimos 30d" },
  { value: "mes_actual", label: "Mes en curso" },
  { value: "mes_anterior", label: "Mes anterior" },
];

interface RangoSelectorProps {
  rangoActual: Rango;
}

export function RangoSelector({ rangoActual }: RangoSelectorProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(r: Rango) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("rango", r);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-sm border border-admin-table-border bg-admin-card-bg p-0.5">
      {PRESETS.map((p) => {
        const active = p.value === rangoActual;
        return (
          <Link
            key={p.value}
            href={buildHref(p.value)}
            aria-pressed={active}
            className={cn(
              "rounded-sm px-3 py-1.5 text-admin-meta font-bold transition-colors",
              active
                ? "bg-brand-blue-main text-white"
                : "text-muted-d hover:text-dark",
            )}
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}
