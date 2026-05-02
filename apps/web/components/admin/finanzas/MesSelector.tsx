"use client";

// MesSelector — selector de mes (último 12 meses) para finanzas. Lote G.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";

interface Props {
  mesActual: string;
}

function formatYM(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function MesSelector({ mesActual }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const ahora = new Date();
  const opciones: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    opciones.push(formatYM(d));
  }

  function buildHref(mes: string) {
    const p = new URLSearchParams(searchParams?.toString() ?? "");
    p.set("mes", mes);
    return `${pathname}?${p.toString()}`;
  }

  return (
    <select
      value={mesActual}
      onChange={(e) => {
        if (typeof window !== "undefined") {
          window.location.href = buildHref(e.target.value);
        }
      }}
      className={cn(
        "rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-meta font-bold text-dark",
      )}
    >
      {opciones.map((m) => (
        <option key={m} value={m}>
          {m === formatYM(ahora) ? `${m} (en curso)` : m}
        </option>
      ))}
    </select>
  );
}
