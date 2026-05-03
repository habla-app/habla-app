// AnalisisBasicoCard — Lote M v3.2.
// Spec: docs/habla-mockup-v3.2.html § page-fijas-detail .analisis-section.
//
// Análisis básico (forma reciente, H2H, lesiones). Visible Free + Socios.
// Texto Markdown que viene de AnalisisPartido.analisisBasico — se renderiza
// como párrafos sin librería extra (el contenido es controlado por el
// editor admin, no es input del usuario).

interface Props {
  texto: string;
}

export function AnalisisBasicoCard({ texto }: Props) {
  const parrafos = texto
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <section
      aria-label="Análisis básico"
      className="rounded-md border border-light bg-card p-5 shadow-sm md:p-6"
    >
      <header className="mb-3">
        <p className="text-label-sm font-bold uppercase tracking-[0.06em] text-brand-blue-main">
          📈 Análisis básico
        </p>
        <h2 className="font-display text-display-sm font-extrabold text-dark md:text-display-md">
          Forma reciente, H2H y lesiones
        </h2>
      </header>
      <div className="space-y-3 text-body-md leading-[1.65] text-body">
        {parrafos.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </section>
  );
}
