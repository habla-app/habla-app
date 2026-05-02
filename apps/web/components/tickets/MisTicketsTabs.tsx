"use client";
// Tabs del /mis-combinadas con navegación por URL
// (?tab=activas|mes-actual|historico). Replica `.mc-tabs` del mockup.
//
// Lote 5 (May 2026): se agregó el tab "Mes en curso" — tickets de torneos
// finalizados del mes calendario en curso, con sus `puntosFinales`
// congelados. Reemplaza al tab "Ganadas" que filtraba por top 10 (esa
// info ahora está en la stat pill "Aciertos" + en /comunidad).

import { useRouter, useSearchParams } from "next/navigation";

export type TicketsTab = "activas" | "mes-actual" | "historico";

interface MisTicketsTabsProps {
  active: TicketsTab;
  counts: { activas: number; mesActual: number; historico: number };
}

const TABS: Array<{ value: TicketsTab; label: string; icon: string }> = [
  { value: "activas", label: "Activas", icon: "live" },
  { value: "mes-actual", label: "Mes en curso", icon: "📅" },
  { value: "historico", label: "Histórico", icon: "📜" },
];

export function MisTicketsTabs({ active, counts }: MisTicketsTabsProps) {
  const router = useRouter();
  const sp = useSearchParams();

  function setTab(tab: TicketsTab) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (tab === "activas") params.delete("tab");
    else params.set("tab", tab);
    router.replace(`/mis-predicciones${params.toString() ? `?${params.toString()}` : ""}`);
  }

  const countByValue: Record<TicketsTab, number> = {
    activas: counts.activas,
    "mes-actual": counts.mesActual,
    historico: counts.historico,
  };

  return (
    <div
      role="tablist"
      aria-label="Mis combinadas tabs"
      className="mb-5 flex gap-2 overflow-x-auto border-b border-light pb-px"
    >
      {TABS.map((t) => {
        const selected = active === t.value;
        const count = countByValue[t.value];
        return (
          <button
            role="tab"
            aria-selected={selected}
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`inline-flex flex-shrink-0 items-center gap-2 border-b-[3px] px-4 py-3 font-display text-[14px] font-bold uppercase tracking-[0.03em] transition-colors ${
              selected
                ? "border-brand-gold text-dark"
                : "border-transparent text-muted-d hover:text-brand-blue-main"
            }`}
          >
            {t.icon === "live" ? (
              <span
                aria-hidden
                className="block h-[7px] w-[7px] animate-pulse-dot rounded-full bg-urgent-critical"
              />
            ) : (
              <span aria-hidden>{t.icon}</span>
            )}
            {t.label}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                selected
                  ? "bg-brand-gold text-black"
                  : "bg-subtle text-muted-d"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
