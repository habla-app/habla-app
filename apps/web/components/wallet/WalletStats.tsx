// 3 mini stats debajo del hero (mockup `.wallet-stats .wstat`):
// comprado (gold), ganado (green), canjeado (purple).
//
// Server Component puro — no interactúa con store.

interface Props {
  comprado: number;
  ganado: number;
  canjeado: number;
}

export function WalletStats({ comprado, ganado, canjeado }: Props) {
  return (
    <section className="mb-6 grid grid-cols-3 gap-3">
      <Stat icon="💳" color="gold" value={comprado} label="Total comprado" />
      <Stat icon="🏆" color="green" value={ganado} label="Total ganado" />
      <Stat icon="🎁" color="purple" value={canjeado} label="Total canjeado" />
    </section>
  );
}

function Stat({
  icon,
  color,
  value,
  label,
}: {
  icon: string;
  color: "gold" | "green" | "purple";
  value: number;
  label: string;
}) {
  const colorClass =
    color === "gold"
      ? "text-brand-gold-dark"
      : color === "green"
        ? "text-alert-success-text"
        : "text-accent-mundial-dark";
  return (
    <div className="rounded-md border border-light bg-card p-4 text-center shadow-sm">
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
