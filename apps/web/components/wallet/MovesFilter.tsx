"use client";
// 6 chips filter (mockup `.moves-filter .mfc`). Client-side only — no
// roundtrip al server. El chip activo usa tint blue-main (a diferencia del
// gold del resto de filtros del app — es el matiz del mockup).

export type MoveFiltro =
  | "TODOS"
  | "COMPRAS"
  | "INSCRIPCIONES"
  | "PREMIOS"
  | "CANJES"
  | "BONOS";

const OPTIONS: ReadonlyArray<{
  value: MoveFiltro;
  label: string;
  icon?: string;
}> = [
  { value: "TODOS", label: "Todos" },
  { value: "COMPRAS", label: "Compras", icon: "💳" },
  { value: "INSCRIPCIONES", label: "Inscripciones", icon: "⚽" },
  { value: "PREMIOS", label: "Premios", icon: "🏆" },
  { value: "CANJES", label: "Canjes", icon: "🎁" },
  { value: "BONOS", label: "Bonos", icon: "⭐" },
];

interface Props {
  value: MoveFiltro;
  onChange: (next: MoveFiltro) => void;
}

export function MovesFilter({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Filtrar historial por tipo"
      className="mb-3.5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={
              active
                ? "flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-brand-blue-main bg-brand-blue-main px-3 py-1.5 text-xs font-semibold text-white"
                : "flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-light bg-card px-3 py-1.5 text-xs font-semibold text-muted-d transition hover:border-brand-gold hover:text-brand-gold-dark"
            }
          >
            {opt.icon ? <span aria-hidden>{opt.icon}</span> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
