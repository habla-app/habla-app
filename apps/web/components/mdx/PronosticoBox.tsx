// PronosticoBox — Lote 8.
//
// Caja destacada con el pronóstico editorial de un partido. Diseñada para
// insertarse dentro del flujo de un artículo (.mdx) y romper visualmente
// con el cuerpo del texto. Estilo lúdico/vibrante alineado al mockup
// (`docs/habla-mockup-completo.html`): hero azul oscuro con acento
// dorado, tipografía display, contraste alto.
//
// `confianza` es 1-5. Renderizamos como barras (no estrellas) para no
// confundir con el rating de afiliados.

interface Props {
  equipo1: string;
  equipo2: string;
  prediccion: string;
  /** 1-5 — del editor que firma el pronóstico. */
  confianza: number;
}

export function PronosticoBox({
  equipo1,
  equipo2,
  prediccion,
  confianza,
}: Props) {
  const c = Math.max(1, Math.min(5, Math.round(confianza)));

  return (
    <aside
      role="note"
      aria-label={`Pronóstico editorial: ${equipo1} vs ${equipo2}`}
      className="my-8 overflow-hidden rounded-md border border-brand-gold/40 bg-hero-blue text-white shadow-md"
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-brand-gold">
          🎯 Pronóstico editorial
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-white/60">
          {equipo1} vs {equipo2}
        </span>
      </header>

      <div className="px-5 py-5">
        <p className="m-0 font-display text-[20px] font-extrabold leading-tight text-white md:text-[24px]">
          {prediccion}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/60">
            Confianza
          </span>
          <div
            className="flex items-center gap-1"
            aria-label={`Confianza ${c} de 5`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                aria-hidden
                className={`h-2 w-6 rounded-sm ${
                  n <= c ? "bg-brand-gold" : "bg-white/15"
                }`}
              />
            ))}
          </div>
          <span className="font-mono text-[12px] font-bold tabular-nums text-white/80">
            {c}/5
          </span>
        </div>
      </div>
    </aside>
  );
}
