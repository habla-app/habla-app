// StatsPill — pill de la `.stats-summary` de /mis-combinadas. Replica
// `.stat-pill` del mockup.

interface StatsPillProps {
  icon: string;
  value: string;
  label: string;
  tone?: "neutral" | "gold" | "green" | "purple";
}

const TONE: Record<string, string> = {
  neutral: "text-dark",
  gold: "text-brand-gold-dark",
  green: "text-brand-green",
  purple: "text-accent-mundial-dark",
};

export function StatsPill({
  icon,
  value,
  label,
  tone = "neutral",
}: StatsPillProps) {
  return (
    <div className="rounded-md border border-light bg-card px-4 py-3 shadow-sm">
      <div aria-hidden className="mb-1 text-[22px] leading-none">
        {icon}
      </div>
      <div
        className={`font-display text-[26px] font-black leading-none ${TONE[tone] ?? TONE.neutral}`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-d">
        {label}
      </div>
    </div>
  );
}
