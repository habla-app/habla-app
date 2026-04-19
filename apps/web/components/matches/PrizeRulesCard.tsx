// Widget "🏆 Cómo se pagan los premios" para el sidebar de /matches.
// Hotfix #6 Ítem 1.5. Server component estático — no depende de sesión
// ni del torneo.
//
// Copy corto para no competir con los otros widgets del sidebar.
// Tokens del design system (§14) — sin hex hardcodeados.

export function PrizeRulesCard() {
  return (
    <section
      className="overflow-hidden rounded-md border border-light bg-card shadow-sm"
      data-testid="prize-rules-card"
    >
      <div className="flex items-center gap-2 border-b border-light bg-widget-top-head px-3.5 py-3">
        <span aria-hidden className="text-[15px]">
          🏆
        </span>
        <span className="font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-dark">
          Cómo se pagan los premios
        </span>
      </div>
      <div className="space-y-2 px-3.5 py-3 text-[12px] leading-snug text-body">
        <p>
          El pozo se reparte entre el <strong>top 10%</strong> de puestos.
          El 1° se lleva al menos el <strong>45%</strong> del bote.
        </p>
        <p className="text-[11px] italic text-muted-d">
          Si empatás en puntos con otros jugadores, se reparten los premios
          de las posiciones que ocupan.
        </p>
      </div>
    </section>
  );
}
