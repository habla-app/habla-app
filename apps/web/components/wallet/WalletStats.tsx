// Lote 6C-fix7: 5 mini stats debajo del hero, alineadas con los 5 grupos
// del filtro del historial (mismo emoji y mismo orden):
//   Compras (💳)        — totales.comprado     — gold
//   Inscripciones (⚽)   — totales.inscripciones — purple
//   Premios (🏆)        — totales.ganado       — green
//   Canjes (🎁)         — totales.canjeado     — blue
//   Bonus (⭐)          — totales.bonos        — orange
// Layout: 2 cols (mobile) → 3+2 (sm) → 5 (lg).

interface Props {
  comprado: number;
  inscripciones: number;
  ganado: number;
  canjeado: number;
  bonos: number;
}

export function WalletStats({
  comprado,
  inscripciones,
  ganado,
  canjeado,
  bonos,
}: Props) {
  return (
    <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Stat icon="💳" color="gold" value={comprado} label="Compras" />
      <Stat icon="⚽" color="purple" value={inscripciones} label="Inscripciones" />
      <Stat icon="🏆" color="green" value={ganado} label="Premios" />
      <Stat icon="🎁" color="blue" value={canjeado} label="Canjes" />
      <Stat
        icon="⭐"
        color="orange"
        value={bonos}
        label="Bonus"
        className="col-span-2 sm:col-span-1"
      />
    </section>
  );
}

function Stat({
  icon,
  color,
  value,
  label,
  className = "",
}: {
  icon: string;
  color: "gold" | "green" | "purple" | "blue" | "orange";
  value: number;
  label: string;
  className?: string;
}) {
  const colorClass =
    color === "gold"
      ? "text-brand-gold-dark"
      : color === "green"
        ? "text-alert-success-text"
        : color === "purple"
          ? "text-accent-mundial-dark"
          : color === "blue"
            ? "text-brand-blue-main"
            : "text-brand-orange";
  return (
    <div
      className={`rounded-md border border-light bg-card p-4 text-center shadow-sm ${className}`}
    >
      <div aria-hidden className="mb-1 text-[22px] leading-none">
        {icon}
      </div>
      <div
        className={`font-display text-[22px] font-black leading-none ${colorClass}`}
      >
        {value.toLocaleString("es-PE")}{" "}
        <span aria-hidden className="text-[0.75em]">
          🪙
        </span>
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
        {label}
      </div>
    </div>
  );
}
