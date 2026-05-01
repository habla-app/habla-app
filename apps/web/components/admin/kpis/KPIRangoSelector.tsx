"use client";

// KPIRangoSelector — selector 7d/30d/90d/365d para drill-down. Lote G.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { RangoDetalle } from "@/lib/services/kpi-detalle.service";
import { cn } from "@/lib/utils/cn";

const PRESETS: ReadonlyArray<{ value: RangoDetalle; label: string }> = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "365d", label: "365d" },
];

interface Props {
  rangoActual: RangoDetalle;
}

export function KPIRangoSelector({ rangoActual }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(r: RangoDetalle) {
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
