"use client";

// MetricSelector — tabs para cambiar la métrica del heatmap. Lote G.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { MetricaCohorte } from "@/lib/services/cohortes.service";
import { cn } from "@/lib/utils/cn";

const TABS: ReadonlyArray<{ value: MetricaCohorte; label: string; emoji: string }> = [
  { value: "prediccion", label: "1ra predicción", emoji: "🎯" },
  { value: "ftd", label: "FTD reportado", emoji: "💵" },
  { value: "premium", label: "Premium", emoji: "⭐" },
  { value: "activo", label: "Activo", emoji: "👁" },
];

interface Props {
  metricActual: MetricaCohorte;
}

export function MetricSelector({ metricActual }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(m: MetricaCohorte) {
    const p = new URLSearchParams(searchParams?.toString() ?? "");
    p.set("metric", m);
    return `${pathname}?${p.toString()}`;
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-admin-table-border bg-admin-card-bg p-1">
      {TABS.map((t) => {
        const active = t.value === metricActual;
        return (
          <Link
            key={t.value}
            href={buildHref(t.value)}
            aria-pressed={active}
            className={cn(
              "rounded-sm px-3 py-1.5 text-admin-meta font-bold transition-colors",
              active
                ? "bg-brand-blue-main text-white"
                : "text-muted-d hover:text-dark",
            )}
          >
            <span aria-hidden className="mr-1">
              {t.emoji}
            </span>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
