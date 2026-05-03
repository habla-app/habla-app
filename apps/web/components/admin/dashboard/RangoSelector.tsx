"use client";

// RangoSelector — Lote O (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-rango-selector (líneas 4949-4954).
// HTML idéntico al mockup, clases del mockup (admin-rango-selector /
// admin-rango-btn / admin-rango-btn.active) que viven en
// `apps/web/app/mockup-styles.css` desde el Lote R.
//
// Labels literales del mockup: "7d", "30d", "Mes actual", "Mes anterior".
// Estado en URL param `?rango=...` para que el rango sea linkeable +
// bookmark-able.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Rango } from "@/lib/services/admin-kpis.service";

const PRESETS: ReadonlyArray<{ value: Rango; label: string }> = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "mes_actual", label: "Mes actual" },
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
    <div className="admin-rango-selector">
      {PRESETS.map((p) => {
        const active = p.value === rangoActual;
        return (
          <Link
            key={p.value}
            href={buildHref(p.value)}
            className={`admin-rango-btn${active ? " active" : ""}`}
            aria-pressed={active}
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}
