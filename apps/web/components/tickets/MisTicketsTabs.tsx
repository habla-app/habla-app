"use client";
// Tabs del /mis-combinadas con navegación por URL (?tab=activas|ganadas|historial).
// Replica `.mc-tabs` del mockup.

import { useRouter, useSearchParams } from "next/navigation";

export type TicketsTab = "activas" | "ganadas" | "historial";

interface MisTicketsTabsProps {
  active: TicketsTab;
  counts: { activas: number; ganadas: number; historial: number };
}

const TABS: Array<{ value: TicketsTab; label: string; icon: string }> = [
  { value: "activas", label: "Activas", icon: "live" },
  { value: "ganadas", label: "Ganadas", icon: "🏆" },
  { value: "historial", label: "Historial", icon: "📜" },
];

export function MisTicketsTabs({ active, counts }: MisTicketsTabsProps) {
  const router = useRouter();
  const sp = useSearchParams();

  function setTab(tab: TicketsTab) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (tab === "activas") params.delete("tab");
    else params.set("tab", tab);
    router.replace(`/mis-combinadas${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div
      role="tablist"
      aria-label="Mis combinadas tabs"
      className="mb-5 flex gap-2 overflow-x-auto border-b border-light pb-px"
    >
      {TABS.map((t) => {
        const selected = active === t.value;
        const count = counts[t.value];
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
