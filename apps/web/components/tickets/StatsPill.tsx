// StatsPill — pill de la `.stats-summary` de /mis-combinadas.
// Mockup `.stat-pill`: barra lateral izquierda de 4px coloreada por tono
// (played=blue, won=gold, accuracy/net=green, best=mundial).
//
// Alineación: padding horizontal uniforme (px-4 a ambos lados) + flex-col
// items-center para que ícono / valor / label estén centrados horizontalmente
// dentro del pill. La barra ::before queda como decoración absoluta y no
// desplaza el contenido.

interface StatsPillProps {
  icon: string;
  value: string;
  label: string;
  tone?: "neutral" | "gold" | "green" | "purple";
}

const VALUE_TONE: Record<string, string> = {
  neutral: "text-dark",
  gold: "text-brand-gold-dark",
  green: "text-alert-success-text",
  purple: "text-accent-mundial-dark",
};

const STRIPE_TONE: Record<string, string> = {
  neutral: "bg-brand-blue-main",
  gold: "bg-brand-gold",
  green: "bg-brand-green",
  purple: "bg-accent-mundial",
};

export function StatsPill({
  icon,
  value,
  label,
  tone = "neutral",
}: StatsPillProps) {
  const wonTint = tone === "gold" ? "bg-gradient-to-br from-white to-[#FFFDF5]" : "bg-card";
  return (
    <div
      className={`relative flex flex-col items-center overflow-hidden rounded-md border border-light px-4 py-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${wonTint}`}
    >
      <span
        aria-hidden
        className={`absolute bottom-0 left-0 top-0 w-1 ${STRIPE_TONE[tone] ?? STRIPE_TONE.neutral}`}
      />
      <div aria-hidden className="mb-1.5 text-center text-[24px] leading-none">
        {icon}
      </div>
      <div
        className={`text-center font-display text-[30px] font-black leading-none ${VALUE_TONE[tone] ?? VALUE_TONE.neutral}`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-center text-[11px] font-bold uppercase leading-tight tracking-[0.06em] text-muted-d">
        {label}
      </div>
    </div>
  );
}
