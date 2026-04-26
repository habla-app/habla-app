// 3 mini stats debajo del hero (mockup `.wallet-stats .wstat`):
// Ganadas en premios (green), Lukas compradas (gold), Gastadas en combinadas (purple).
// Responsive: 1 col (mobile) → 2+1 (sm–lg) → 3 iguales (lg+).

interface Props {
  ganadas: number;
  compradas: number;
  gastadoEnCombinadas: number;
}

export function WalletStats({ ganadas, compradas, gastadoEnCombinadas }: Props) {
  return (
    <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Stat icon="🏆" color="green" value={ganadas} label="Ganadas en premios" />
      <Stat icon="💳" color="gold" value={compradas} label="Lukas compradas" />
      <Stat
        icon="⚽"
        color="purple"
        value={gastadoEnCombinadas}
        label="Gastadas en combinadas"
        className="sm:col-span-2 lg:col-span-1"
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
  color: "gold" | "green" | "purple";
  value: number;
  label: string;
  className?: string;
}) {
  const colorClass =
    color === "gold"
      ? "text-brand-gold-dark"
      : color === "green"
        ? "text-alert-success-text"
        : "text-accent-mundial-dark";
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
