"use client";
// LiveSwitcher — tabs superiores con los 2-3 partidos en vivo. Click
// cambia el torneo activo; el LiveMatchView hace leave/join en el WS.
// Replica `.ls-tab` del mockup.

interface LiveSwitcherTab {
  torneoId: string;
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  golesLocal: number;
  golesVisita: number;
  round: string | null;
  estado: "EN_VIVO" | "FINALIZADO";
}

interface LiveSwitcherProps {
  tabs: LiveSwitcherTab[];
  active: string;
  onChange: (torneoId: string) => void;
}

export function LiveSwitcher({ tabs, active, onChange }: LiveSwitcherProps) {
  // Bug #10: el switcher solo muestra partidos EN_VIVO. Si no hay
  // ninguno (o solo uno, el usuario no necesita cambiar), ocultamos.
  if (tabs.length <= 1) return null;
  return (
    <div
      role="tablist"
      aria-label="Partidos en vivo"
      className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin"
    >
      {tabs.map((t) => {
        const selected = t.torneoId === active;
        return (
          <button
            role="tab"
            aria-selected={selected}
            key={t.torneoId}
            type="button"
            onClick={() => onChange(t.torneoId)}
            className={`flex min-w-[220px] flex-shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-left transition-all ${
              selected
                ? "bg-dark-surface text-white shadow-md"
                : "border border-light bg-card text-dark hover:border-brand-blue-main"
            }`}
          >
            <span
              aria-hidden
              className={`h-[8px] w-[8px] flex-shrink-0 rounded-full ${
                t.estado === "EN_VIVO"
                  ? "animate-pulse-dot bg-urgent-critical"
                  : "bg-brand-green"
              }`}
            />
            <div className="min-w-0 flex-1">
              <div
                className={`truncate text-[10px] font-bold uppercase tracking-[0.06em] ${
                  selected ? "text-white/70" : "text-muted-d"
                }`}
              >
                {t.liga}
                {t.round && <> · {t.round}</>}
              </div>
              <div className="truncate font-display text-[13px] font-extrabold uppercase">
                {t.equipoLocal} vs {t.equipoVisita}
              </div>
            </div>
            <div
              className={`flex flex-shrink-0 flex-col items-end ${selected ? "text-white" : "text-dark"}`}
            >
              <div className="font-display text-[15px] font-black leading-none">
                {t.golesLocal}—{t.golesVisita}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
