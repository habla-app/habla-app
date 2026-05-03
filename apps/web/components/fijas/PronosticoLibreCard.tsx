// PronosticoLibreCard — Lote M v3.2.
// Spec: docs/habla-mockup-v3.2.html § page-fijas-detail .resumen-ejecutivo.
//
// Header común a todos los estados de auth: pronóstico Habla! 1X2 +
// probabilidades + mejor cuota Local. Visible Free + Socios + Visitor.

interface Props {
  pronostico: "LOCAL" | "EMPATE" | "VISITA";
  probabilidades: { local?: number; empate?: number; visita?: number };
  mejorCuota: { mercado: string; cuota: number; casa: string };
  equipoLocal: string;
  equipoVisita: string;
}

export function PronosticoLibreCard({
  pronostico,
  probabilidades,
  mejorCuota,
  equipoLocal,
  equipoVisita,
}: Props) {
  const probLocal = probabilidades.local ?? 0;
  const probEmpate = probabilidades.empate ?? 0;
  const probVisita = probabilidades.visita ?? 0;

  return (
    <section
      aria-label="Pronóstico Habla!"
      className="rounded-md border border-light bg-card p-5 shadow-sm md:p-6"
    >
      <header className="mb-4">
        <p className="mb-1 text-label-sm font-bold uppercase tracking-[0.06em] text-brand-blue-main">
          🎯 Pronóstico Habla! · Gratis
        </p>
        <h2 className="font-display text-display-md font-extrabold text-dark md:text-display-lg">
          Gana {labelEquipo(pronostico, equipoLocal, equipoVisita)} ·{" "}
          <span className="text-brand-blue-main">{Math.round(probMaxPct(pronostico, probabilidades))}% prob</span>
        </h2>
      </header>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Cell
          label="Local"
          pct={Math.round(probLocal * 100)}
          highlighted={pronostico === "LOCAL"}
        />
        <Cell
          label="Empate"
          pct={Math.round(probEmpate * 100)}
          highlighted={pronostico === "EMPATE"}
        />
        <Cell
          label="Visita"
          pct={Math.round(probVisita * 100)}
          highlighted={pronostico === "VISITA"}
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-sm bg-brand-gold/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-label-sm uppercase tracking-[0.04em] text-muted-d">
            Mejor cuota {labelMercado(mejorCuota.mercado)} · {mejorCuota.casa}
          </p>
          <p className="font-display text-display-sm font-extrabold text-brand-gold-dark">
            @{mejorCuota.cuota.toFixed(2)}
          </p>
        </div>
        <span className="rounded-sm bg-brand-gold px-3 py-2 font-display text-label-sm font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn">
          Apostar →
        </span>
      </div>
    </section>
  );
}

function Cell({
  label,
  pct,
  highlighted,
}: {
  label: string;
  pct: number;
  highlighted: boolean;
}) {
  return (
    <div
      className={`rounded-sm border px-2.5 py-3 text-center ${
        highlighted
          ? "border-brand-blue-main bg-brand-blue-main text-white"
          : "border-light bg-subtle/40 text-dark"
      }`}
    >
      <p className="text-label-sm uppercase tracking-[0.04em] opacity-80">
        {label}
      </p>
      <p className="font-display text-display-sm font-extrabold leading-none">
        {pct}%
      </p>
    </div>
  );
}

function labelEquipo(
  p: "LOCAL" | "EMPATE" | "VISITA",
  local: string,
  visita: string,
): string {
  if (p === "LOCAL") return local;
  if (p === "VISITA") return visita;
  return "Empate";
}

function labelMercado(m: string): string {
  if (m === "LOCAL") return "Local";
  if (m === "VISITA") return "Visita";
  if (m === "EMPATE") return "Empate";
  return m;
}

function probMaxPct(
  pron: "LOCAL" | "EMPATE" | "VISITA",
  prob: { local?: number; empate?: number; visita?: number },
): number {
  const v =
    pron === "LOCAL"
      ? prob.local
      : pron === "EMPATE"
        ? prob.empate
        : prob.visita;
  return (v ?? 0) * 100;
}
