// AnalisisProfundoCard — Lote M v3.2.
// Spec: docs/habla-mockup-v3.2.html § page-fijas-detail (bloques goles +
// tarjetas, ambos solo Socios).
//
// Renderiza los bloques "análisis profundo de goles" y "análisis profundo
// de tarjetas" con la misma estructura visual: card con header, números
// destacados arriba, explicación markdown abajo + lista de factores.

interface AnalisisGolesShape {
  goles_esperados_local?: number | string;
  goles_esperados_visita?: number | string;
  explicacion?: string;
  factores?: string[];
}

interface AnalisisTarjetasShape {
  tarjetas_esperadas_total?: number | string;
  riesgo_roja?: "BAJO" | "MEDIO" | "ALTO" | string;
  explicacion?: string;
  factores?: string[];
}

export function AnalisisGolesCard({
  data,
  equipoLocal,
  equipoVisita,
}: {
  data: AnalisisGolesShape;
  equipoLocal: string;
  equipoVisita: string;
}) {
  const golesLocal = numero(data.goles_esperados_local);
  const golesVisita = numero(data.goles_esperados_visita);
  return (
    <section
      aria-label="Análisis profundo de goles"
      className="rounded-md border border-light bg-card p-5 shadow-sm md:p-6"
    >
      <header className="mb-4">
        <p className="mb-1 text-label-sm font-bold uppercase tracking-[0.06em] text-brand-gold-dark">
          ⚽ Solo Socios
        </p>
        <h3 className="font-display text-display-md font-extrabold text-dark md:text-display-lg">
          Análisis profundo de goles
        </h3>
      </header>

      {golesLocal !== null && golesVisita !== null ? (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Big number={golesLocal} label={`xG ${equipoLocal}`} />
          <Big number={golesVisita} label={`xG ${equipoVisita}`} />
        </div>
      ) : null}

      {data.explicacion ? (
        <p className="mb-3 text-body-md leading-[1.65] text-body">
          {data.explicacion}
        </p>
      ) : null}

      {data.factores && data.factores.length > 0 ? (
        <FactoresList factores={data.factores} />
      ) : null}
    </section>
  );
}

export function AnalisisTarjetasCard({ data }: { data: AnalisisTarjetasShape }) {
  const total = numero(data.tarjetas_esperadas_total);
  return (
    <section
      aria-label="Análisis profundo de tarjetas"
      className="rounded-md border border-light bg-card p-5 shadow-sm md:p-6"
    >
      <header className="mb-4">
        <p className="mb-1 text-label-sm font-bold uppercase tracking-[0.06em] text-brand-gold-dark">
          🟨 Solo Socios
        </p>
        <h3 className="font-display text-display-md font-extrabold text-dark md:text-display-lg">
          Análisis profundo de tarjetas
        </h3>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3">
        {total !== null ? (
          <Big number={total} label="Tarjetas esperadas" precision={1} />
        ) : null}
        {data.riesgo_roja ? <Riesgo nivel={data.riesgo_roja} /> : null}
      </div>

      {data.explicacion ? (
        <p className="mb-3 text-body-md leading-[1.65] text-body">
          {data.explicacion}
        </p>
      ) : null}

      {data.factores && data.factores.length > 0 ? (
        <FactoresList factores={data.factores} />
      ) : null}
    </section>
  );
}

function Big({
  number,
  label,
  precision = 2,
}: {
  number: number;
  label: string;
  precision?: number;
}) {
  return (
    <div className="rounded-sm bg-subtle/60 px-3 py-3 text-center">
      <p className="font-display text-display-lg font-black leading-none text-brand-blue-main">
        {number.toFixed(precision)}
      </p>
      <p className="mt-1 text-label-sm uppercase tracking-[0.04em] text-muted-d">
        {label}
      </p>
    </div>
  );
}

function Riesgo({ nivel }: { nivel: string }) {
  const upper = nivel.toUpperCase();
  const cfg =
    upper === "ALTO"
      ? {
          color: "text-urgent-critical",
          bg: "bg-urgent-critical-bg",
        }
      : upper === "MEDIO"
        ? { color: "text-urgent-high-dark", bg: "bg-urgent-high-bg" }
        : { color: "text-alert-success-text", bg: "bg-alert-success-bg" };
  return (
    <div className={`rounded-sm px-3 py-3 text-center ${cfg.bg}`}>
      <p
        className={`font-display text-display-md font-black leading-none ${cfg.color}`}
      >
        {upper}
      </p>
      <p className="mt-1 text-label-sm uppercase tracking-[0.04em] text-muted-d">
        Riesgo de roja
      </p>
    </div>
  );
}

function FactoresList({ factores }: { factores: string[] }) {
  return (
    <ul className="mt-2 space-y-1.5 text-body-sm text-body">
      {factores.map((f, i) => (
        <li key={i} className="flex items-start gap-2">
          <span aria-hidden className="mt-0.5 text-brand-gold-dark">
            ▸
          </span>
          <span>{f}</span>
        </li>
      ))}
    </ul>
  );
}

function numero(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
