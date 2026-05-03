// RazonamientoDetalladoCard — Lote M v3.2.
// Spec: docs/habla-mockup-v3.2.html § page-fijas-detail .pick-socios-razon.
//
// Razonamiento extenso del análisis (forma reciente, lesiones, H2H, value
// matemático, factores cualitativos). Solo Socios. ~300-500 palabras.

interface Props {
  texto: string;
}

export function RazonamientoDetalladoCard({ texto }: Props) {
  const parrafos = texto
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <section
      aria-label="Razonamiento detallado del análisis"
      className="rounded-md border border-light bg-card p-5 shadow-sm md:p-6"
    >
      <header className="mb-3">
        <p className="mb-1 text-label-sm font-bold uppercase tracking-[0.06em] text-brand-gold-dark">
          🧠 Solo Socios
        </p>
        <h3 className="font-display text-display-md font-extrabold text-dark md:text-display-lg">
          Razonamiento estadístico
        </h3>
      </header>
      <div className="space-y-3 text-body-md leading-[1.7] text-body">
        {parrafos.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </section>
  );
}
